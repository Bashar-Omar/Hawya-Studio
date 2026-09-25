export async function registerHawyaServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return undefined;
  }

  const scope = import.meta.env.BASE_URL;
  try {
    return await navigator.serviceWorker.register(`${scope}sw.js`, {
      scope,
      updateViaCache: "none",
    });
  } catch {
    return undefined;
  }
}
