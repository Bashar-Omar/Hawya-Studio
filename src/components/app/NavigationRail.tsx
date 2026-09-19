import { Info, LayoutGrid, Settings } from "lucide-react";

import { AppLink, useRouter } from "@/app/routes/RouterProvider";
import { appRoutes } from "@/app/routes/route-config";
import { useI18n } from "@/i18n/I18nProvider";

const navItems = [
  { id: "studio", href: appRoutes.studio, labelKey: "nav.home", Icon: LayoutGrid },
  { id: "settings", href: appRoutes.settings, labelKey: "nav.settings", Icon: Settings },
  { id: "about", href: appRoutes.about, labelKey: "nav.about", Icon: Info },
] as const;

export function NavigationRail({ onNavigate }: { onNavigate?: () => void }) {
  const { routeId } = useRouter();
  const { t } = useI18n();

  return (
    <nav className="navigation-rail" aria-label={t("studio.shell.railTitle")}>
      {navItems.map(({ href, Icon, id, labelKey }) => {
        const active = routeId === id;
        return (
          <AppLink
            className="navigation-rail__item"
            data-active={active ? "true" : "false"}
            href={href}
            key={id}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{t(labelKey)}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}
