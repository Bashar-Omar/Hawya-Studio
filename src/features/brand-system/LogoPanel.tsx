import { FileUp, Save, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { Button } from "@/components/ui/button";
import type { LogoVariant } from "@/domain/brand/brand-system";
import type { LocalizedString } from "@/domain/common/primitives";
import type { ProjectId } from "@/domain/project/hawya-project";
import { useI18n } from "@/i18n/I18nProvider";

const ROLES: LogoVariant["role"][] = [
  "primary",
  "secondary",
  "logomark",
  "wordmark",
  "monochrome",
  "reversed",
  "custom",
];

function localizedName(
  existing: LocalizedString,
  locale: "en" | "ar",
  value: string,
): LocalizedString {
  return locale === "ar" ? { ...existing, ar: value } : { ...existing, en: value };
}

function LogoRow({
  variant,
  projectId,
  view,
  onRefresh,
}: {
  variant: LogoVariant;
  projectId: ProjectId;
  view: BrandSystemView;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { locale, t } = useI18n();
  const initialName = variant.name[locale] ?? variant.name.en ?? variant.name.ar ?? "";
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<LogoVariant["role"]>(variant.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPrimary = view.snapshot.project.brand.logos.primaryLogoId === variant.id;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.logoVariants.update(projectId, variant.id, {
        name: localizedName(variant.name, locale, name.trim()),
        role,
        assetId: variant.assetId,
        ...(variant.preferredBackground
          ? { preferredBackground: variant.preferredBackground }
          : {}),
        ...(variant.usage ? { usage: variant.usage } : {}),
      });
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.logoVariants.remove(projectId, variant.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.logoVariants.setPrimary(projectId, variant.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="brand-row-card">
      <div className="brand-row-card__main">
        <label className="field-stack">
          <span className="field-label">{t("brand.logos.name")}</span>
          <input
            className="text-input"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.logos.role")}</span>
          <select
            className="text-input"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value as LogoVariant["role"])}
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="brand-row-card__meta">
          <span>{t("brand.logos.asset")}</span>
          <code>{variant.assetId.slice(0, 8)}</code>
        </div>
      </div>
      <div className="brand-row-card__actions">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void save()}
          disabled={busy || !name.trim()}
        >
          <Save aria-hidden="true" size={14} />
          {t("common.save")}
        </Button>
        <Button
          size="sm"
          variant={isPrimary ? "secondary" : "ghost"}
          onClick={() => void makePrimary()}
          disabled={busy || isPrimary}
        >
          <Star aria-hidden="true" size={14} />
          {isPrimary ? t("brand.logos.primary") : t("brand.logos.makePrimary")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
          <Trash2 aria-hidden="true" size={14} />
          {t("common.delete")}
        </Button>
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function LogoPanel({
  projectId,
  view,
  onRefresh,
}: {
  projectId: ProjectId;
  view: BrandSystemView;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { locale, t } = useI18n();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<LogoVariant["role"]>("primary");
  const [assetId, setAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidateAssets = view.snapshot.assets.filter((asset) =>
    ["logo", "vector", "image"].includes(asset.kind),
  );

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const source = await runtime.assetFiles.read(file, "logo");
      const result = await runtime.importAsset.execute(projectId, source);
      setAssetId(result.asset.id);
      if (!name) setName(result.asset.name);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const add = async () => {
    if (!assetId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await runtime.logoVariants.add(projectId, {
        name: locale === "ar" ? { ar: name.trim() } : { en: name.trim() },
        role,
        assetId,
      });
      setName("");
      setAssetId("");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="brand-panel" aria-labelledby="logo-panel-title">
      <div className="brand-panel__heading">
        <div>
          <h2 id="logo-panel-title">{t("brand.logos.title")}</h2>
          <p>{t("brand.logos.body")}</p>
        </div>
        <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={busy}>
          <FileUp aria-hidden="true" size={16} />
          {t("brand.logos.uploadAsset")}
        </Button>
        <input
          ref={uploadRef}
          className="sr-only"
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      <div className="brand-form-grid">
        <label className="field-stack">
          <span className="field-label">{t("brand.logos.name")}</span>
          <input
            className="text-input"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.logos.role")}</span>
          <select
            className="text-input"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value as LogoVariant["role"])}
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.logos.asset")}</span>
          <select
            className="text-input"
            value={assetId}
            onChange={(event) => setAssetId(event.currentTarget.value)}
          >
            <option value="">{t("brand.logos.selectAsset")}</option>
            {candidateAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <div className="brand-form-grid__action">
          <Button onClick={() => void add()} disabled={busy || !name.trim() || !assetId}>
            {t("brand.logos.add")}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="brand-stack">
        {view.snapshot.project.brand.logos.variants.map((variant) => (
          <LogoRow
            key={variant.id}
            variant={variant}
            projectId={projectId}
            view={view}
            onRefresh={onRefresh}
          />
        ))}
        {view.snapshot.project.brand.logos.variants.length === 0 ? (
          <div className="brand-empty">{t("brand.logos.empty")}</div>
        ) : null}
      </div>
    </section>
  );
}
