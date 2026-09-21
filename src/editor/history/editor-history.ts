import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";

import type { GuidePage } from "@/domain/guide/guide-document";

enablePatches();

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  patches: Patch[];
  inversePatches: Patch[];
  affectedIds: string[];
  byteEstimate: number;
}

export interface HistoryMetadata {
  id: string;
  label: string;
  timestamp: number;
  affectedIds: string[];
}

const MAX_HISTORY_ENTRIES = 200;
const MAX_HISTORY_BYTES = 2 * 1024 * 1024;

function estimateBytes(patches: Patch[], inversePatches: Patch[]): number {
  return JSON.stringify([patches, inversePatches]).length * 2;
}

export class EditorHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private totalBytes = 0;

  constructor(private present: GuidePage) {}

  current(): GuidePage {
    return this.present;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undoLabel(): string | undefined {
    return this.past.at(-1)?.label;
  }

  redoLabel(): string | undefined {
    return this.future.at(-1)?.label;
  }

  commit(metadata: HistoryMetadata, recipe: (draft: Draft<GuidePage>) => void): GuidePage {
    const [next, patches, inversePatches] = produceWithPatches(this.present, recipe);
    if (patches.length === 0) return this.present;
    const entry: HistoryEntry = {
      ...metadata,
      patches,
      inversePatches,
      byteEstimate: estimateBytes(patches, inversePatches),
    };
    this.present = next;
    this.past.push(entry);
    this.totalBytes += entry.byteEstimate;
    this.future = [];
    this.trim();
    return this.present;
  }

  undo(): GuidePage | undefined {
    const entry = this.past.pop();
    if (!entry) return undefined;
    this.present = applyPatches(this.present, entry.inversePatches);
    this.future.push(entry);
    this.totalBytes -= entry.byteEstimate;
    return this.present;
  }

  redo(): GuidePage | undefined {
    const entry = this.future.pop();
    if (!entry) return undefined;
    this.present = applyPatches(this.present, entry.patches);
    this.past.push(entry);
    this.totalBytes += entry.byteEstimate;
    this.trim();
    return this.present;
  }

  stats() {
    return {
      undoEntries: this.past.length,
      redoEntries: this.future.length,
      byteEstimate: this.totalBytes,
    };
  }

  private trim() {
    while (this.past.length > MAX_HISTORY_ENTRIES || this.totalBytes > MAX_HISTORY_BYTES) {
      const removed = this.past.shift();
      if (!removed) break;
      this.totalBytes -= removed.byteEstimate;
    }
  }
}
