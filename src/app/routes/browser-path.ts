export interface BrowserLocationPath {
  pathname: string;
  hash: string;
}

export function normalizeAppBasePath(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${withLeadingSlash.replace(/\/+$/, "")}/`;
}

export function usesHashRouting(baseUrl: string): boolean {
  return normalizeAppBasePath(baseUrl) !== "/";
}

export function browserPathForAppPath(appPath: string, baseUrl: string): string {
  if (!appPath.startsWith("/")) {
    throw new Error(`Application paths must be absolute: ${appPath}`);
  }

  const basePath = normalizeAppBasePath(baseUrl);
  if (basePath === "/") return appPath;
  return `${basePath}#${appPath}`;
}

export function appPathFromBrowserLocation(
  location: BrowserLocationPath,
  baseUrl: string,
): string {
  if (!usesHashRouting(baseUrl)) return location.pathname || "/";
  const hashPath = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  return hashPath.startsWith("/") ? hashPath : "/";
}
