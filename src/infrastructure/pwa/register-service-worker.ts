export async function registerHawyaServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return undefined;
  }

  try {
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return undefined;
  }
}
