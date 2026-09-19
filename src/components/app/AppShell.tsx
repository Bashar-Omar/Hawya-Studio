import { Menu, PanelLeftClose } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { joinClassNames } from "@/shared/ui/utils";

import { appMetadata } from "@/app/app-metadata";
import { AppLink } from "@/app/routes/RouterProvider";
import { appRoutes } from "@/app/routes/route-config";
import { CommandMenu } from "@/components/app/CommandMenu";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { NavigationRail } from "@/components/app/NavigationRail";
import { SkipLink } from "@/components/app/SkipLink";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";

interface AppShellProps {
  title: string;
  subtitle?: string;
  railPanel?: ReactNode;
  inspector?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  children,
  inspector,
  railPanel,
  status,
  subtitle,
  title,
}: AppShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div
      className={joinClassNames(
        "app-shell",
        Boolean(railPanel) && "app-shell--with-panel",
        Boolean(inspector) && "app-shell--with-inspector",
      )}
    >
      <SkipLink />
      <header className="app-shell__topbar">
        <div className="app-shell__brand-area">
          <Button
            className="mobile-nav-trigger"
            size="icon"
            variant="ghost"
            onClick={() => setNavigationOpen(true)}
            aria-label={t("nav.openNavigation")}
            title={t("nav.openNavigation")}
          >
            <Menu aria-hidden="true" size={19} strokeWidth={1.8} />
          </Button>
          <AppLink className="app-wordmark" href={appRoutes.landing} aria-label={appMetadata.name}>
            <span className="app-mark" aria-hidden="true">
              هـ
            </span>
            <span className="app-wordmark__text">{appMetadata.name}</span>
          </AppLink>
        </div>
        <div className="app-shell__topbar-title" aria-live="polite">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <div className="app-shell__actions">
          <LanguageSwitcher compact />
          <CommandMenu />
        </div>
      </header>

      <aside className="app-shell__rail">
        <NavigationRail />
      </aside>

      {railPanel ? <aside className="app-shell__panel">{railPanel}</aside> : null}

      <main className="app-shell__main" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {inspector ? <aside className="app-shell__inspector">{inspector}</aside> : null}

      <footer className="app-shell__statusbar">
        <span>{status ?? t("studio.shell.status")}</span>
        <span>{t("app.localFirst")}</span>
      </footer>

      <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
        <DialogContent closeLabel={t("nav.closeNavigation")} className="mobile-navigation-dialog">
          <DialogTitle className="mobile-navigation-title">
            {t("studio.shell.railTitle")}
          </DialogTitle>
          <NavigationRail onNavigate={() => setNavigationOpen(false)} />
          <div className="mobile-navigation-footer">
            <PanelLeftClose aria-hidden="true" size={17} />
            <span>{appMetadata.name}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
