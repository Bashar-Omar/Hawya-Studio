import { lazy, type ReactNode, Suspense } from "react";

import { NotFoundPage } from "@/app/routes/NotFoundPage";
import { pageIdFromPathname, projectIdFromPathname } from "@/app/routes/route-config";
import { RouterProvider, useRouter } from "@/app/routes/RouterProvider";
import { LandingPage } from "@/features/landing/LandingPage";
import { useI18n } from "@/i18n/I18nProvider";

const StudioRuntimeProvider = lazy(() =>
  import("@/app/providers/studio-runtime").then((module) => ({
    default: module.StudioRuntimeProvider,
  })),
);
const AboutPage = lazy(() =>
  import("@/features/about/AboutPage").then((module) => ({ default: module.AboutPage })),
);
const StudioHomePage = lazy(() =>
  import("@/features/project-library/StudioHomePage").then((module) => ({
    default: module.StudioHomePage,
  })),
);
const NewProjectPage = lazy(() =>
  import("@/features/new-project/NewProjectPage").then((module) => ({
    default: module.NewProjectPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const BrandSystemPage = lazy(() => import("@/features/brand-system/BrandSystemPage"));
const GuideStudioPage = lazy(() => import("@/features/guide-studio/GuideStudioPage"));
const EditorPage = lazy(() => import("@/features/editor/EditorPage"));
const ExportCenterPage = lazy(() => import("@/features/export/ExportCenterPage"));
const MockupStudioPage = lazy(() => import("@/features/mockup/MockupStudioPage"));
const PrintViewPage = lazy(() => import("@/features/export/PrintViewPage"));

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="route-loading" role="status" aria-live="polite">
      {t("common.loading")}
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function StudioRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <StudioRuntimeProvider>{children}</StudioRuntimeProvider>
    </Suspense>
  );
}

function CurrentRoute() {
  const { pathname, routeId } = useRouter();
  const projectId = projectIdFromPathname(pathname);
  const pageId = pageIdFromPathname(pathname);

  switch (routeId) {
    case "landing":
      return <LandingPage />;
    case "studio":
      return (
        <StudioRoute>
          <StudioHomePage />
        </StudioRoute>
      );
    case "newProject":
      return (
        <StudioRoute>
          <NewProjectPage {...(projectId ? { projectId } : {})} />
        </StudioRoute>
      );
    case "project":
      return projectId ? (
        <StudioRoute>
          <GuideStudioPage projectId={projectId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "brand":
      return projectId ? (
        <StudioRoute>
          <BrandSystemPage projectId={projectId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "editor":
      return projectId && pageId ? (
        <StudioRoute>
          <EditorPage projectId={projectId} pageId={pageId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "export":
      return projectId ? (
        <StudioRoute>
          <ExportCenterPage projectId={projectId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "mockups":
      return projectId ? (
        <StudioRoute>
          <MockupStudioPage projectId={projectId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "print":
      return projectId ? (
        <StudioRoute>
          <PrintViewPage projectId={projectId} />
        </StudioRoute>
      ) : (
        <NotFoundPage />
      );
    case "settings":
      return (
        <StudioRoute>
          <SettingsPage />
        </StudioRoute>
      );
    case "about":
      return (
        <LazyRoute>
          <AboutPage />
        </LazyRoute>
      );
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
