import { Archive, CircleAlert, HardDrive, RefreshCw } from "lucide-react";

import type { StorageDiagnostics } from "@/application/ports/storage-manager";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export type EditorRecoveryAction = "export" | "retry" | "diagnostics";

export interface EditorStorageFailureState {
  message: string;
  diagnostics?: StorageDiagnostics;
  actionError?: string;
}

function formatBytes(value: number | undefined, locale: "en" | "ar"): string {
  if (value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(amount)} ${units[unit]}`;
}

export function EditorStorageRecovery({
  failure,
  busy,
  onExport,
  onRetry,
  onDiagnostics,
}: {
  failure: EditorStorageFailureState;
  busy: EditorRecoveryAction | null;
  onExport: () => void;
  onRetry: () => void;
  onDiagnostics: () => void;
}) {
  const { locale, t } = useI18n();
  const diagnostics = failure.diagnostics;

  return (
    <section className="editor-storage-failure" role="alert" aria-live="assertive">
      <div className="editor-storage-failure__heading">
        <CircleAlert aria-hidden="true" size={20} />
        <div>
          <h2>{t("editor.storageFailure.title")}</h2>
          <p>{t("editor.storageFailure.body")}</p>
        </div>
      </div>

      <p className="editor-storage-failure__cause">
        {t("editor.storageFailure.cause", { message: failure.message })}
      </p>

      {diagnostics ? (
        <div className="editor-storage-failure__diagnostics">
          {diagnostics.supported ? (
            <>
              <p>
                {t("editor.storageFailure.usage", {
                  usage: formatBytes(diagnostics.usage, locale),
                  quota: formatBytes(diagnostics.quota, locale),
                })}
              </p>
              <p>
                {diagnostics.persisted === true
                  ? t("editor.storageFailure.persisted")
                  : t("editor.storageFailure.bestEffort")}
              </p>
            </>
          ) : (
            <p>{t("editor.storageFailure.diagnosticsUnavailable")}</p>
          )}
        </div>
      ) : null}

      {failure.actionError ? (
        <p className="editor-storage-failure__action-error">{failure.actionError}</p>
      ) : null}

      <div className="editor-storage-failure__actions">
        <Button size="sm" onClick={onExport} disabled={busy !== null}>
          <Archive aria-hidden="true" size={15} />
          {t("editor.storageFailure.export")}
        </Button>
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={busy !== null}>
          <RefreshCw aria-hidden="true" size={15} />
          {t("editor.storageFailure.retry")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiagnostics} disabled={busy !== null}>
          <HardDrive aria-hidden="true" size={15} />
          {t("editor.storageFailure.diagnostics")}
        </Button>
      </div>
    </section>
  );
}
