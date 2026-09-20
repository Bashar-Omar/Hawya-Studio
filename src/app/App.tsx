import { lazy, Suspense } from "react";

import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { projectIdFromPathname } from "@/app/routes/route-config";
import { RouterProvider, useRouter } from "@/app/routes/RouterProvider";
import { AboutPage } from "@/features/about/AboutPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { NewProjectPage } from "@/features/new-project/NewProjectPage";
import { ProjectGuideShellPage } from "@/features/project-library/ProjectGuideShellPage";
import { StudioHomePage } from "@/features/project-library/StudioHomePage";
import { SettingsPage } from "@/features/settings/SettingsPage";

const BrandSystemPage = lazy(() => import("@/features/brand-system/BrandSystemPage"));

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
      return projectId ? <ProjectGuideShellPage projectId={projectId} /> : <NotFoundPage />;
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
