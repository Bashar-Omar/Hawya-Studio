import { describe, expect, it } from "vitest";

import {
  brandSystemPath,
  editorPath,
  exportCenterPath,
  matchRoute,
  mockupStudioPath,
  printPath,
  newProjectPath,
  pageIdFromPathname,
  projectIdFromPathname,
  projectPath,
} from "@/app/routes/route-config";
import { projectIdSchema } from "@/domain/project/hawya-project";

const projectId = projectIdSchema.parse("00000000-0000-4000-8000-000000000123");
const pageId = projectIdSchema.parse("00000000-0000-4000-8000-000000000456");

describe("app route matching", () => {
  it("normalizes trailing slashes without hiding unknown routes", () => {
    expect(matchRoute("/")).toBe("landing");
    expect(matchRoute("/studio/")).toBe("studio");
    expect(matchRoute("/studio/new")).toBe("newProject");
    expect(matchRoute("/settings")).toBe("settings");
    expect(matchRoute("/missing")).toBe("not-found");
  });

  it("matches validated dynamic project, setup and brand routes", () => {
    expect(matchRoute(newProjectPath(projectId))).toBe("newProject");
    expect(matchRoute(projectPath(projectId))).toBe("project");
    expect(matchRoute(brandSystemPath(projectId))).toBe("brand");
    expect(matchRoute(editorPath(projectId, pageId))).toBe("editor");
    expect(matchRoute(exportCenterPath(projectId))).toBe("export");
    expect(matchRoute(mockupStudioPath(projectId))).toBe("mockups");
    expect(matchRoute(printPath(projectId))).toBe("print");
    expect(projectIdFromPathname(newProjectPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(projectPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(brandSystemPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(editorPath(projectId, pageId))).toBe(projectId);
    expect(projectIdFromPathname(exportCenterPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(mockupStudioPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(printPath(projectId))).toBe(projectId);
    expect(pageIdFromPathname(editorPath(projectId, pageId))).toBe(pageId);
    expect(matchRoute("/studio/projects/not-a-uuid")).toBe("not-found");
    expect(matchRoute("/studio/projects/not-a-uuid/brand")).toBe("not-found");
    expect(matchRoute("/studio/projects/not-a-uuid/export")).toBe("not-found");
    expect(matchRoute("/studio/projects/not-a-uuid/mockups")).toBe("not-found");
    expect(matchRoute("/studio/projects/not-a-uuid/print")).toBe("not-found");
    expect(matchRoute(`/studio/projects/${projectId}/editor/not-a-uuid`)).toBe("not-found");
  });
});
