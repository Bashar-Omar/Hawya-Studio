import {
  type AnchorHTMLAttributes,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { appPathFromBrowserLocation, browserPathForAppPath } from "@/app/routes/browser-path";
import { matchRoute, type MatchedRouteId } from "@/app/routes/route-config";

interface RouterContextValue {
  pathname: string;
  routeId: MatchedRouteId;
  navigate: (pathname: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  window.addEventListener("hawya:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("hawya:navigate", callback);
  };
}

function getSnapshot(): string {
  return appPathFromBrowserLocation(window.location, import.meta.env.BASE_URL);
}

function getServerSnapshot(): string {
  return "/";
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const pathname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const navigate = useCallback((nextPathname: string) => {
    if (getSnapshot() === nextPathname) {
      return;
    }

    window.history.pushState({}, "", browserPathForAppPath(nextPathname, import.meta.env.BASE_URL));
    window.dispatchEvent(new Event("hawya:navigate"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({ pathname, routeId: matchRoute(pathname), navigate }),
    [navigate, pathname],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within RouterProvider");
  }
  return context;
}

export function AppLink({
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigate(href);
  };

  return (
    <a
      href={browserPathForAppPath(href, import.meta.env.BASE_URL)}
      onClick={handleClick}
      {...props}
    />
  );
}
