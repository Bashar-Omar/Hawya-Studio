import {
  Archive,
  Copy,
  FileUp,
  FolderOpen,
  HardDrive,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ProjectLibraryItem } from "@/application/queries/project-library-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { newProjectPath, projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { useAnnounce } from "@/components/app/LiveRegion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import type { StorageDiagnostics } from "@/application/ports/storage-manager";
import { projectArchiveFilename } from "@/infrastructure/file-system/browser-project-files";

function formatBytes(value: number | undefined, locale: "en" | "ar"): string {
  if (value === undefined) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index === 0 ? 0 : 1 }).format(amount)} ${units[index]}`;
}

function ProjectCard({
  item,
  onChanged,
}: {
  item: ProjectLibraryItem;
  onChanged: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { locale, t } = useI18n();
  const announce = useAnnounce();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(item.metadata.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openProject = () => {
    navigate(item.setupDraft ? newProjectPath(item.id) : projectPath(item.id));
  };

  const rename = async () => {
    setBusy("rename");
    setError(null);
    try {
      await runtime.renameProject.execute(item.id, renameValue);
      setRenameOpen(false);
      announce(t("studio.project.renamed"));
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async () => {
    setBusy("duplicate");
    setError(null);
    try {
      const duplicateId = await runtime.duplicateProject.execute(
        item.id,
        t("studio.project.copyName", { name: item.metadata.name }),
      );
      announce(t("studio.project.duplicated"));
      await onChanged();
      navigate(item.setupDraft ? newProjectPath(duplicateId) : projectPath(duplicateId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(null);
    }
  };

  const exportBackup = async () => {
    setBusy("export");
    setError(null);
    try {
      const result = await runtime.exportProjectBackup.execute(item.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      runtime.projectFiles.download(result.value, projectArchiveFilename(item.metadata.name));
      announce(t("studio.project.exported"));
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      await runtime.deleteStudioProject.execute(item.id);
      setDeleteOpen(false);
      announce(t("studio.project.deleted"));
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(null);
    }
  };

  const updated = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(item.metadata.updatedAt));

  return (
    <article className="project-card">
      <button className="project-card__open" type="button" onClick={openProject}>
        <div className="project-card__thumb" aria-hidden="true">
          <FolderOpen size={24} strokeWidth={1.6} />
        </div>
        <div className="project-card__copy">
          <div className="project-card__title-row">
            <h2>{item.metadata.name}</h2>
            <span className={`status-chip ${item.setupDraft ? "status-chip--warning" : ""}`}>
              {item.setupDraft
                ? t("studio.project.setupInProgress")
                : t("studio.project.setupComplete")}
            </span>
          </div>
          {item.metadata.clientName ? (
            <p>{t("studio.project.client", { client: item.metadata.clientName })}</p>
          ) : null}
          <p className="project-card__meta">{t("studio.project.updated", { date: updated })}</p>
          <span
            className={
              item.backupRecommended ? "backup-state backup-state--warning" : "backup-state"
            }
          >
            {item.backupRecommended
              ? t("studio.project.backupRecommended")
              : t("studio.project.backupCurrent")}
          </span>
        </div>
      </button>

      <fieldset className="project-card__actions">
        <legend className="sr-only">
          {t("studio.project.actions", { name: item.metadata.name })}
        </legend>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRenameOpen(true)}
          disabled={busy !== null}
        >
          <Pencil aria-hidden="true" size={15} />
          {t("common.rename")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void duplicate()} disabled={busy !== null}>
          <Copy aria-hidden="true" size={15} />
          {t("common.duplicate")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void exportBackup()}
          disabled={busy !== null}
        >
          <Archive aria-hidden="true" size={15} />
          {t("common.backup")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          disabled={busy !== null}
        >
          <Trash2 aria-hidden="true" size={15} />
          {t("common.delete")}
        </Button>
      </fieldset>

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent closeLabel={t("dialog.close")}>
          <DialogTitle>{t("studio.rename.title")}</DialogTitle>
          <DialogDescription>{t("studio.rename.body")}</DialogDescription>
          <form
            className="dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              void rename();
            }}
          >
            <label className="field-label" htmlFor={`rename-${item.id}`}>
              {t("wizard.basic.projectName")}
            </label>
            <input
              id={`rename-${item.id}`}
              className="text-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.currentTarget.value)}
              required
              autoComplete="off"
            />
            <div className="dialog-actions">
              <DialogClose render={<Button variant="secondary">{t("common.cancel")}</Button>} />
              <Button type="submit" disabled={!renameValue.trim() || busy === "rename"}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent closeLabel={t("dialog.close")}>
          <DialogTitle>{t("studio.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("studio.delete.body", { name: item.metadata.name })}
          </DialogDescription>
          <div className="dialog-actions">
            <DialogClose render={<Button variant="secondary">{t("common.cancel")}</Button>} />
            <Button variant="danger" onClick={() => void remove()} disabled={busy === "delete"}>
              {t("studio.delete.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function StorageCard({
  diagnostics,
  onRequestPersistence,
}: {
  diagnostics: StorageDiagnostics | null;
  onRequestPersistence: () => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const usage = diagnostics?.usage;
  const quota = diagnostics?.quota;
  const usageText = diagnostics?.supported
    ? t("studio.storage.usage", {
        usage: formatBytes(usage, locale),
        quota: formatBytes(quota, locale),
      })
    : t("studio.storage.unavailable");

  return (
    <section className="information-card storage-card">
      <ShieldCheck aria-hidden="true" size={22} strokeWidth={1.7} />
      <div className="storage-card__copy">
        <h2>{t("studio.storage.title")}</h2>
        <p>{t("studio.storage.body")}</p>
        <p className="storage-card__diagnostic">{usageText}</p>
        <p className="storage-card__diagnostic">
          {diagnostics?.persisted === true
            ? t("studio.storage.persisted")
            : t("studio.storage.bestEffort")}
        </p>
      </div>
      {diagnostics?.supported && diagnostics.persisted !== true ? (
        <Button variant="secondary" size="sm" onClick={() => void onRequestPersistence()}>
          {t("studio.storage.request")}
        </Button>
      ) : null}
    </section>
  );
}

export function StudioHomePage() {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const announce = useAnnounce();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ProjectLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await runtime.projectLibrary.execute());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }, [runtime, t]);

  const refreshStorage = useCallback(async () => {
    setDiagnostics(await runtime.storageManager.diagnostics());
  }, [runtime]);

  useEffect(() => {
    void refresh();
    void refreshStorage();
  }, [refresh, refreshStorage]);

  const importArchive = async (file: File) => {
    setError(null);
    try {
      const bytes = await runtime.projectFiles.read(file);
      const result = await runtime.importProjectArchive.execute(bytes);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      announce(t("studio.project.imported"));
      await refresh();
      await refreshStorage();
      navigate(projectPath(result.value.project.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const requestPersistence = async () => {
    const result = await runtime.storageManager.requestPersistence();
    announce(result ? t("studio.storage.requestGranted") : t("studio.storage.requestNotGranted"));
    await refreshStorage();
  };

  const panel = (
    <div className="shell-panel-content">
      <p className="panel-kicker">{t("studio.shell.library")}</p>
      <h2>{t("studio.projects.title")}</h2>
      <div className="panel-note">
        <HardDrive aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>{t("app.localFirst")}</span>
      </div>
      <p className="panel-helper">{t("studio.projects.localOnly")}</p>
    </div>
  );

  return (
    <AppShell title={t("studio.title")} subtitle={t("studio.subtitle")} railPanel={panel}>
      <div className="page-content page-content--wide">
        <section className="page-heading project-library-heading">
          <div>
            <p className="eyebrow">{t("studio.projects.title")}</p>
            <h1>{t("studio.projects.heading")}</h1>
            <p>{t("studio.projects.body")}</p>
          </div>
          <div className="project-library-heading__actions">
            <Button onClick={() => navigate(newProjectPath())}>
              <Plus aria-hidden="true" size={16} />
              {t("studio.projects.create")}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <FileUp aria-hidden="true" size={16} />
              {t("studio.projects.open")}
            </Button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".hawya,application/zip"
              aria-label={t("studio.projects.open")}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void importArchive(file);
                }
              }}
            />
          </div>
        </section>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className="empty-project-state" aria-live="polite">
            <div className="empty-project-state__copy">
              <h2>{t("common.loading")}</h2>
            </div>
          </section>
        ) : items.length === 0 ? (
          <section className="empty-project-state" aria-labelledby="empty-project-title">
            <div className="empty-project-state__icon" aria-hidden="true">
              <FolderOpen size={30} strokeWidth={1.5} />
            </div>
            <div className="empty-project-state__copy">
              <h2 id="empty-project-title">{t("studio.projects.emptyTitle")}</h2>
              <p>{t("studio.projects.emptyBody")}</p>
            </div>
            <div className="empty-project-state__actions">
              <Button onClick={() => navigate(newProjectPath())}>
                <Plus aria-hidden="true" size={16} />
                {t("studio.projects.create")}
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <FileUp aria-hidden="true" size={16} />
                {t("studio.projects.open")}
              </Button>
            </div>
          </section>
        ) : (
          <section className="project-grid" aria-label={t("studio.projects.title")}>
            {items.map((item) => (
              <ProjectCard key={item.id} item={item} onChanged={refresh} />
            ))}
          </section>
        )}

        <StorageCard diagnostics={diagnostics} onRequestPersistence={requestPersistence} />
      </div>
    </AppShell>
  );
}
