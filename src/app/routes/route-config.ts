import { projectIdSchema, type ProjectId } from "@/domain/project/hawya-project";

export const appRoutes = {
  landing: "/",
  studio: "/studio",
  newProject: "/studio/new",
  settings: "/settings",
  about: "/about",
} as const;

export type AppRouteId = keyof typeof appRoutes;
export type MatchedRouteId = AppRouteId | "project" | "brand" | "not-found";

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function parseProjectId(segment: string | undefined): ProjectId | undefined {
  if (!segment) return undefined;
  const parsed = projectIdSchema.safeParse(segment);
  return parsed.success ? parsed.data : undefined;
}

export function newProjectPath(projectId?: ProjectId): string {
  return projectId ? `${appRoutes.newProject}/${projectId}` : appRoutes.newProject;
}

export function projectPath(projectId: ProjectId): string {
  return `/studio/projects/${projectId}`;
}

export function brandSystemPath(projectId: ProjectId): string {
  return `/studio/projects/${projectId}/brand`;
}

export function projectIdFromPathname(pathname: string): ProjectId | undefined {
  const parts = normalizePathname(pathname).split("/").filter(Boolean);
  if (parts[0] !== "studio") return undefined;
  if (parts[1] === "new" && parts.length === 3) return parseProjectId(parts[2]);
  if (
    parts[1] === "projects" &&
    (parts.length === 3 || (parts.length === 4 && parts[3] === "brand"))
  ) {
    return parseProjectId(parts[2]);
  }
  return undefined;
}

export function matchRoute(pathname: string): MatchedRouteId {
  const normalized = normalizePathname(pathname);
  const staticMatch = Object.entries(appRoutes).find(([, path]) => path === normalized);
  if (staticMatch) return staticMatch[0] as AppRouteId;

  const parts = normalized.split("/").filter(Boolean);
  if (
    parts[0] === "studio" &&
    parts[1] === "new" &&
    parts.length === 3 &&
    parseProjectId(parts[2])
  ) {
    return "newProject";
  }
  if (
    parts[0] === "studio" &&
    parts[1] === "projects" &&
    parts.length === 3 &&
    parseProjectId(parts[2])
  ) {
    return "project";
  }
  if (
    parts[0] === "studio" &&
    parts[1] === "projects" &&
    parts.length === 4 &&
    parts[3] === "brand" &&
    parseProjectId(parts[2])
  ) {
    return "brand";
  }
  return "not-found";
}
