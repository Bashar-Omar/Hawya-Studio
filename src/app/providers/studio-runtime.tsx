import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";

import {
  createStudioRuntime,
  type StudioRuntime,
} from "@/infrastructure/runtime/create-studio-runtime";

const StudioRuntimeContext = createContext<StudioRuntime | null>(null);

export function StudioRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useMemo(() => createStudioRuntime(), []);

  useEffect(() => () => runtime.database.close(), [runtime]);

  return <StudioRuntimeContext.Provider value={runtime}>{children}</StudioRuntimeContext.Provider>;
}

export function useStudioRuntime(): StudioRuntime {
  const runtime = useContext(StudioRuntimeContext);
  if (!runtime) {
    throw new Error("useStudioRuntime must be used within StudioRuntimeProvider");
  }
  return runtime;
}
