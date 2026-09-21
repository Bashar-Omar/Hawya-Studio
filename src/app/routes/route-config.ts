import { pageIdSchema, type PageId } from "@/domain/guide/guide-document";
import { projectIdSchema, type ProjectId } from "@/domain/project/hawya-project";

export const appRoutes = {
  landing: "/",
  studio: "/studio",
  newProject: "/studio/new",
  settings: "/settings",
  about: "/about",
} as const;

export type AppRouteId = keyof typeof appRoutes;
export type MatchedRouteId =
  | AppRouteId
  | "project"
  | "brand"
  | "editor"
  | "export"
  | "print"
  | "not-found";

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

export function editorPath(projectId: ProjectId, pageId: PageId): string {
  return `/studio/projects/${projectId}/editor/${pageId}`;
}

export function exportCenterPath(projectId: ProjectId): string {
  return `/studio/projects/${projectId}/export`;
}

export function printPath(projectId: ProjectId): string {
  return `/studio/projects/${projectId}/print`;
}

export function pageIdFromPathname(pathname: string): PageId | undefined {
  const parts = normalizePathname(pathname).split("/").filter(Boolean);
  if (parts[0] !== "studio" || parts[1] !== "projects" || parts[3] !== "editor") return undefined;
  const parsed = pageIdSchema.safeParse(parts[4]);
  return parsed.success ? parsed.data : undefined;
}

export function projectIdFromPathname(pathname: string): ProjectId | undefined {
  const parts = normalizePathname(pathname).split("/").filter(Boolean);
  if (parts[0] !== "studio") return undefined;
  if (parts[1] === "new" && parts.length === 3) return parseProjectId(parts[2]);
  if (
    parts[1] === "projects" &&
    (parts.length === 3 ||
      (parts.length === 4 && ["brand", "export", "print"].includes(parts[3] ?? "")) ||
      (parts.length === 5 && parts[3] === "editor" && pageIdSchema.safeParse(parts[4]).success))
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
  if (
    parts[0] === "studio" &&
    parts[1] === "projects" &&
    parts.length === 5 &&
    parts[3] === "editor" &&
    parseProjectId(parts[2]) &&
    pageIdSchema.safeParse(parts[4]).success
  ) {
    return "editor";
  }
  if (
    parts[0] === "studio" &&
    parts[1] === "projects" &&
    parts.length === 4 &&
    parts[3] === "export" &&
    parseProjectId(parts[2])
  ) {
    return "export";
  }
  if (
    parts[0] === "studio" &&
    parts[1] === "projects" &&
    parts.length === 4 &&
    parts[3] === "print" &&
    parseProjectId(parts[2])
  ) {
    return "print";
  }
  return "not-found";
}
