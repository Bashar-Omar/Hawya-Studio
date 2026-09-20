import { lazy, Suspense } from "react";

import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { projectIdFromPathname } from "@/app/routes/route-config";
import { RouterProvider, useRouter } from "@/app/routes/RouterProvider";
import { AboutPage } from "@/features/about/AboutPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { NewProjectPage } from "@/features/new-project/NewProjectPage";
import { StudioHomePage } from "@/features/project-library/StudioHomePage";
import { SettingsPage } from "@/features/settings/SettingsPage";

const BrandSystemPage = lazy(() => import("@/features/brand-system/BrandSystemPage"));
const GuideStudioPage = lazy(() => import("@/features/guide-studio/GuideStudioPage"));

function CurrentRoute() {
  const { pathname, routeId } = useRouter();
  const projectId = projectIdFromPathname(pathname);

  switch (routeId) {
    case "landing":
      return <LandingPage />;
    case "studio":
      return <StudioHomePage />;
    case "newProject":
      return <NewProjectPage {...(projectId ? { projectId } : {})} />;
    case "project":
      return projectId ? (
        <Suspense fallback={null}>
          <GuideStudioPage projectId={projectId} />
        </Suspense>
      ) : (
        <NotFoundPage />
      );
    case "brand":
      return projectId ? (
        <Suspense fallback={null}>
          <BrandSystemPage projectId={projectId} />
        </Suspense>
      ) : (
        <NotFoundPage />
      );
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
