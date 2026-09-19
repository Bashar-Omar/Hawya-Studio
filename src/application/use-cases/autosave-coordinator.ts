import type { ISODateTime } from "@/domain/common/primitives";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import type { SaveProjectUseCase } from "@/application/use-cases/save-project";

export type SaveState =
  | { status: "saved"; savedAt?: ISODateTime }
  | { status: "local-changes" }
  | { status: "saving" }
  | { status: "save-failed"; error: Error };

type SaveStateListener = (state: SaveState) => void;

export class AutosaveCoordinator {
  private readonly listeners = new Set<SaveStateListener>();
  private pendingSnapshot: ProjectSnapshot | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private savePromise: Promise<ProjectSnapshot> | undefined;
  private state: SaveState = { status: "saved" };

  constructor(
    private readonly saveProject: SaveProjectUseCase,
    private readonly debounceMs = 800,
  ) {}

  getState(): SaveState {
    return this.state;
  }

  subscribe(listener: SaveStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  markDirty(snapshot: ProjectSnapshot): void {
    this.pendingSnapshot = snapshot;
    this.setState({ status: "local-changes" });
    this.schedule();
  }

  async flush(): Promise<ProjectSnapshot | undefined> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    let lastSaved: ProjectSnapshot | undefined;
    while (this.pendingSnapshot) {
      const saved = await this.savePending();
      if (!saved) {
        break;
      }
      lastSaved = saved;
    }
    return lastSaved;
  }

  async retry(): Promise<ProjectSnapshot | undefined> {
    return this.flush();
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.listeners.clear();
  }

  private schedule(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.savePending();
    }, this.debounceMs);
  }

  private async savePending(): Promise<ProjectSnapshot | undefined> {
    if (this.savePromise) {
      await this.savePromise.catch(() => undefined);
      if (!this.pendingSnapshot) {
        return undefined;
      }
    }

    const candidate = this.pendingSnapshot;
    if (!candidate) {
      return undefined;
    }
    this.pendingSnapshot = undefined;
    this.setState({ status: "saving" });

    const operation = this.saveProject.execute(candidate);
    this.savePromise = operation;
    try {
      const saved = await operation;
      if (this.pendingSnapshot) {
        this.setState({ status: "local-changes" });
        this.schedule();
      } else {
        this.setState({ status: "saved", savedAt: saved.project.metadata.updatedAt });
      }
      return saved;
    } catch (error) {
      this.pendingSnapshot = candidate;
      this.setState({
        status: "save-failed",
        error: error instanceof Error ? error : new Error("Unknown autosave failure"),
      });
      return undefined;
    } finally {
      if (this.savePromise === operation) {
        this.savePromise = undefined;
      }
    }
  }

  private setState(state: SaveState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
