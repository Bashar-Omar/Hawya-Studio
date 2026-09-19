import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { RouterProvider, useRouter } from "@/app/routes/RouterProvider";
import { AboutPage } from "@/features/about/AboutPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { StudioHomePage } from "@/features/project-library/StudioHomePage";
import { SettingsPage } from "@/features/settings/SettingsPage";

function CurrentRoute() {
  const { routeId } = useRouter();

  switch (routeId) {
    case "landing":
      return <LandingPage />;
    case "studio":
      return <StudioHomePage />;
    case "settings":
      return <SettingsPage />;
    case "about":
      return <AboutPage />;
    case "not-found":
      return <NotFoundPage />;
  }
}

export function App() {
  return (
    <RouterProvider>
      <CurrentRoute />
    </RouterProvider>
  );
}
