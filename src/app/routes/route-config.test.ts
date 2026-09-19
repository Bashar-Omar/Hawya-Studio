import { describe, expect, it } from "vitest";

import {
  matchRoute,
  newProjectPath,
  projectIdFromPathname,
  projectPath,
} from "@/app/routes/route-config";
import { projectIdSchema } from "@/domain/project/hawya-project";

const projectId = projectIdSchema.parse("00000000-0000-4000-8000-000000000123");

describe("app route matching", () => {
  it("normalizes trailing slashes without hiding unknown routes", () => {
    expect(matchRoute("/")).toBe("landing");
    expect(matchRoute("/studio/")).toBe("studio");
    expect(matchRoute("/studio/new")).toBe("newProject");
    expect(matchRoute("/settings")).toBe("settings");
    expect(matchRoute("/missing")).toBe("not-found");
  });

  it("matches validated dynamic project and setup routes", () => {
    expect(matchRoute(newProjectPath(projectId))).toBe("newProject");
    expect(matchRoute(projectPath(projectId))).toBe("project");
    expect(projectIdFromPathname(newProjectPath(projectId))).toBe(projectId);
    expect(projectIdFromPathname(projectPath(projectId))).toBe(projectId);
    expect(matchRoute("/studio/projects/not-a-uuid")).toBe("not-found");
  });
});
