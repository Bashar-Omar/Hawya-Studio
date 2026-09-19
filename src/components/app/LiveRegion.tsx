import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type Announce = (message: string) => void;

const LiveRegionContext = createContext<Announce | null>(null);

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const announce = useCallback((nextMessage: string) => {
    setMessage("");
    window.requestAnimationFrame(() => setMessage(nextMessage));
  }, []);
  const value = useMemo(() => announce, [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(LiveRegionContext);
  if (!announce) {
    throw new Error("useAnnounce must be used within LiveRegionProvider");
  }
  return announce;
}
