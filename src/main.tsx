import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { AppProviders } from "@/app/providers/AppProviders";
import { registerHawyaServiceWorker } from "@/infrastructure/pwa/register-service-worker";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Hawya Studio root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

void registerHawyaServiceWorker();
