import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

const SHORTCUTS = [
  ["Select tool", "V"],
  ["Hand / pan", "H · Space drag"],
  ["Text", "T"],
  ["Rectangle", "R"],
  ["Place asset", "I"],
  ["Undo", "Mod+Z"],
  ["Redo", "Shift+Mod+Z · Ctrl+Y"],
  ["Duplicate", "Mod+D"],
  ["Delete", "Delete · Backspace"],
  ["Group", "Mod+G"],
  ["Ungroup", "Shift+Mod+G"],
  ["Fit page", "Mod+0"],
  ["100%", "Mod+1"],
  ["Zoom", "+ / -"],
  ["Nudge", "Arrow · Shift+Arrow"],
  ["Disable snapping", "Hold Alt/Option"],
  ["Cancel / exit text edit", "Escape"],
] as const;

function platformModifier() {
  if (typeof navigator === "undefined") return "Ctrl/Cmd";
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "Cmd" : "Ctrl";
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const modifier = platformModifier();

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);
  const rows = useMemo(
    () =>
      SHORTCUTS.filter(([label, shortcut]) =>
        `${label} ${shortcut}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  if (!open) return null;
  return (
    <div className="editor-dialog-backdrop">
      <button
        type="button"
        className="editor-dialog-backdrop__dismiss"
        aria-label={t("editor.close")}
        onClick={onClose}
      />
      <section
        className="editor-shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-shortcuts-title"
      >
        <header className="editor-shortcuts-dialog__header">
          <div>
            <p className="panel-kicker">Keyboard</p>
            <h2 id="editor-shortcuts-title">{t("editor.shortcuts")}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("editor.close")}
          </Button>
        </header>
        <input
          ref={searchRef}
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("editor.shortcutsSearch")}
        />
        <div className="editor-shortcuts-list">
          {rows.map(([label, shortcut]) => (
            <div key={label}>
              <span>{label}</span>
              <kbd>{shortcut.replaceAll("Mod", modifier)}</kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
