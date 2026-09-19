import { describe, expect, it, vi } from "vitest";

import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { AutosaveCoordinator } from "@/application/use-cases/autosave-coordinator";
import { SaveProjectUseCase } from "@/application/use-cases/save-project";
import { type ISODateTime, isoDateTimeSchema } from "@/domain/common/primitives";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_SAVE_TIMESTAMP,
} from "../../../tests/fixtures/stage02/synthetic-project";

class FixedClock implements Clock {
  constructor(private readonly value: ISODateTime) {}
  now(): ISODateTime {
    return this.value;
  }
}

describe("AutosaveCoordinator", () => {
  it("exposes local-changes → saving → saved and retries a failed write", async () => {
    const fixture = await createSyntheticProjectFixture(new WebCryptoSha256Hasher());
    let attempts = 0;
    const save = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("quota simulation");
      }
    });
    const repository: ProjectRepository = {
      save,
      get: vi.fn(),
      listMetadata: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new SaveProjectUseCase(
      repository,
      new FixedClock(isoDateTimeSchema.parse(SYNTHETIC_SAVE_TIMESTAMP)),
    );
    const coordinator = new AutosaveCoordinator(useCase, 60_000);
    const states: string[] = [];
    const unsubscribe = coordinator.subscribe((state) => states.push(state.status));

    coordinator.markDirty(fixture.snapshot);
    expect(coordinator.getState().status).toBe("local-changes");
    expect(await coordinator.flush()).toBeUndefined();
    expect(coordinator.getState().status).toBe("save-failed");

    const retried = await coordinator.retry();
    expect(retried?.project.metadata.updatedAt).toBe(SYNTHETIC_SAVE_TIMESTAMP);
    expect(coordinator.getState()).toEqual({
      status: "saved",
      savedAt: SYNTHETIC_SAVE_TIMESTAMP,
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(states).toContain("saving");

    unsubscribe();
    coordinator.dispose();
  });
});
