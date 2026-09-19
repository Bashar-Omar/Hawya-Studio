import { Accessibility, FlaskConical, HardDrive, Keyboard, Languages, Palette } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ShortcutDialog } from "@/components/app/ShortcutDialog";
import { ThemeSwitcher } from "@/components/app/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export function SettingsPage() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { t } = useI18n();

  return (
    <AppShell title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div className="page-content settings-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">{t("settings.title")}</p>
            <h1>{t("settings.title")}</h1>
            <p>{t("settings.subtitle")}</p>
          </div>
        </header>

        <div className="settings-list">
          <section className="settings-row">
            <div className="settings-row__heading">
              <Languages aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.language.title")}</h2>
                <p>{t("settings.language.body")}</p>
              </div>
            </div>
            <LanguageSwitcher />
          </section>

          <section className="settings-row">
            <div className="settings-row__heading">
              <Palette aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.theme.title")}</h2>
                <p>{t("settings.theme.body")}</p>
              </div>
            </div>
            <ThemeSwitcher />
          </section>

          <section className="settings-row">
            <div className="settings-row__heading">
              <Keyboard aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.shortcuts.title")}</h2>
                <p>{t("settings.shortcuts.body")}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setShortcutsOpen(true)}>
              {t("settings.shortcuts.open")}
            </Button>
          </section>

          <section className="settings-row settings-row--informational">
            <div className="settings-row__heading">
              <HardDrive aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.storage.title")}</h2>
                <p>{t("settings.storage.body")}</p>
              </div>
            </div>
          </section>

          <section className="settings-row settings-row--informational">
            <div className="settings-row__heading">
              <Accessibility aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.accessibility.title")}</h2>
                <p>{t("settings.accessibility.body")}</p>
              </div>
            </div>
          </section>

          <section className="settings-row settings-row--informational">
            <div className="settings-row__heading">
              <FlaskConical aria-hidden="true" size={20} strokeWidth={1.7} />
              <div>
                <h2>{t("settings.experimental.title")}</h2>
                <p>{t("settings.experimental.body")}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
      <ShortcutDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </AppShell>
  );
}
