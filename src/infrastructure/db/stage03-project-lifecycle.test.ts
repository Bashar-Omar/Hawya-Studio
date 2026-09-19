import { afterEach, describe, expect, it } from "vitest";

import { createPersistenceRuntime } from "@/infrastructure/runtime/create-persistence-runtime";

const databaseNames: string[] = [];

async function cleanupDatabase(name: string): Promise<void> {
  const runtime = createPersistenceRuntime(name);
  runtime.database.close();
  await runtime.database.delete();
}

afterEach(async () => {
  for (const name of databaseNames.splice(0)) {
    await cleanupDatabase(name);
  }
});

describe("Stage 03 project lifecycle", () => {
  it("creates metadata-first library entries and persists resumable setup progress", async () => {
    const name = `hawya-stage03-resume-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const first = createPersistenceRuntime(name);

    const created = await first.createProject.execute({
      name: "North Star",
      defaultContentLocale: "en",
      enabledContentLocales: ["en", "ar"],
    });
    const projectId = created.project.id;

    const library = await first.projectLibrary.execute();
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      id: projectId,
      metadata: { name: "North Star" },
      setupDraft: { currentStep: "logo" },
    });

    await first.setupWizard.skip(projectId, "logo");
    first.database.close();

    const reopened = createPersistenceRuntime(name);
    const resumed = await reopened.setupWizard.load(projectId);
    expect(resumed?.draft.currentStep).toBe("colors");
    expect(resumed?.snapshot.project.metadata.name).toBe("North Star");

    const second = await reopened.createProject.execute({
      name: "Later Project",
      defaultContentLocale: "en",
      enabledContentLocales: ["en"],
    });
    await reopened.openProject.execute(projectId);
    const recentFirst = await reopened.projectLibrary.execute();
    expect(recentFirst[0]?.id).toBe(projectId);
    expect(recentFirst.some((item) => item.id === second.project.id)).toBe(true);
    reopened.database.close();
  });

  it("finishes setup with honest missing states and an empty guide shell", async () => {
    const name = `hawya-stage03-finish-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const runtime = createPersistenceRuntime(name);

    const created = await runtime.createProject.execute({
      name: "هوية محلية",
      clientName: "عميل",
      defaultContentLocale: "ar",
      enabledContentLocales: ["ar"],
    });
    const projectId = created.project.id;

    await runtime.setupWizard.skip(projectId, "logo");
    await runtime.setupWizard.completeColors(projectId, "#123456");
    await runtime.setupWizard.skip(projectId, "typography");
    await runtime.setupWizard.completeFoundation(projectId, { mission: "رسالة حقيقية" });
    const finished = await runtime.setupWizard.finish(projectId, "minimal");

    expect(await runtime.setupDrafts.get(projectId)).toBeUndefined();
    expect(finished.project.settings.guideProfile).toBe("minimal");
    expect(finished.project.guide.pageOrder).toEqual([]);
    expect(finished.project.brand.logos.variants).toEqual([]);
    expect(finished.project.brand.typography.styles).toEqual([]);
    expect(finished.project.brand.colors.tokens[0]).toMatchObject({
      role: "primary",
      srgbHex: "#123456",
      rgb: { r: 18, g: 52, b: 86 },
    });
    expect(finished.project.brand.identity.mission).toEqual({ ar: "رسالة حقيقية" });
    runtime.database.close();
  });

  it("renames, duplicates and deletes without bypassing repository boundaries", async () => {
    const name = `hawya-stage03-actions-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const runtime = createPersistenceRuntime(name);

    const created = await runtime.createProject.execute({
      name: "Action Project",
      defaultContentLocale: "en",
      enabledContentLocales: ["en"],
    });
    const sourceId = created.project.id;
    await runtime.renameProject.execute(sourceId, "Renamed Project");
    const duplicateId = await runtime.duplicateProject.execute(sourceId, "Renamed Project Copy");

    const listed = await runtime.projectLibrary.execute();
    expect(listed.map((item) => item.metadata.name).sort()).toEqual([
      "Renamed Project",
      "Renamed Project Copy",
    ]);
    expect(await runtime.setupDrafts.get(duplicateId)).toBeDefined();

    await runtime.deleteStudioProject.execute(sourceId);
    expect(await runtime.projects.get(sourceId)).toBeUndefined();
    expect(await runtime.setupDrafts.get(sourceId)).toBeUndefined();
    expect(await runtime.projects.get(duplicateId)).toBeDefined();
    runtime.database.close();
  });
});
