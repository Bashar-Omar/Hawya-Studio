export const appRoutes = {
  landing: "/",
  studio: "/studio",
  settings: "/settings",
  about: "/about",
} as const;

export type AppRouteId = keyof typeof appRoutes;
export type MatchedRouteId = AppRouteId | "not-found";

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.replace(/\/+$/, "") || "/";
}

export function matchRoute(pathname: string): MatchedRouteId {
  const normalized = normalizePathname(pathname);
  const match = Object.entries(appRoutes).find(([, path]) => path === normalized);
  return match ? (match[0] as AppRouteId) : "not-found";
}
