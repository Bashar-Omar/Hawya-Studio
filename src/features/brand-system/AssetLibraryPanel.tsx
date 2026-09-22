import { FileUp, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { Button } from "@/components/ui/button";
import type { Asset, AssetKind } from "@/domain/assets/asset";
import type { ProjectId } from "@/domain/project/hawya-project";
import { useI18n } from "@/i18n/I18nProvider";

const FILTER_KINDS: Array<"all" | AssetKind> = ["all", "logo", "vector", "image", "mockup", "font"];

function AssetCard({
  asset,
  usage,
  projectId,
  onRefresh,
}: {
  asset: Asset;
  usage: number;
  projectId: ProjectId;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { t } = useI18n();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTags = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.updateAssetTags.execute(projectId, asset.id, tags.split(","));
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const replace = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const intendedKind =
        asset.kind === "logo"
          ? "logo"
          : asset.kind === "vector"
            ? "vector"
            : asset.kind === "font"
              ? "font"
              : asset.kind === "mockup"
                ? "mockup"
                : "image";
      const source = await runtime.assetFiles.read(file, intendedKind);
      await runtime.replaceAsset.execute(projectId, asset.id, source);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.deleteAsset.execute(projectId, asset.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="asset-card">
      <div className="asset-card__head">
        <div>
          <span className="status-chip">{asset.kind}</span>
          <h3>{asset.name}</h3>
          <p>{asset.originalFilename}</p>
        </div>
        <span className="asset-usage">{t("brand.assets.used", { count: usage })}</span>
      </div>
      <dl className="asset-meta">
        <div>
          <dt>{t("brand.assets.mime")}</dt>
          <dd>{asset.mime}</dd>
        </div>
        <div>
          <dt>{t("brand.assets.size")}</dt>
          <dd>{Math.max(1, Math.round(asset.byteLength / 1024))} KB</dd>
        </div>
        <div>
          <dt>{t("brand.assets.hash")}</dt>
          <dd title={asset.contentHash}>{asset.contentHash.slice(0, 12)}…</dd>
        </div>
      </dl>
      {asset.security.sanitized ? (
        <p className="asset-security">
          <ShieldCheck aria-hidden="true" size={15} />
          {t("brand.assets.sanitized")}
          {asset.security.rejectedFeatures?.length
            ? ` · ${asset.security.rejectedFeatures.join(", ")}`
            : ""}
        </p>
      ) : null}
      <label className="field-stack">
        <span className="field-label">{t("brand.assets.tags")}</span>
        <input
          className="text-input"
          value={tags}
          onChange={(event) => setTags(event.currentTarget.value)}
          placeholder={t("brand.assets.tagsPlaceholder")}
        />
      </label>
      <div className="asset-card__actions">
        <Button size="sm" variant="secondary" onClick={() => void saveTags()} disabled={busy}>
          <Save aria-hidden="true" size={14} />
          {t("common.save")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => replaceRef.current?.click()}
          disabled={busy}
        >
          <RefreshCw aria-hidden="true" size={14} />
          {t("brand.assets.replace")}
        </Button>
        <input
          ref={replaceRef}
          className="sr-only"
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp,.ttf,.otf,.woff,.woff2"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void replace(file);
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void remove()}
          disabled={busy || usage > 0}
        >
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

export function AssetLibraryPanel({
  projectId,
  view,
  onRefresh,
}: {
  projectId: ProjectId;
  view: BrandSystemView;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"all" | AssetKind>("all");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assets = view.snapshot.assets.filter(
    (asset) =>
      (kind === "all" || asset.kind === kind) &&
      (!tag.trim() ||
        asset.tags.some((item) => item.toLowerCase().includes(tag.trim().toLowerCase()))),
  );

  const importFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const source = await runtime.assetFiles.read(file);
      await runtime.importAsset.execute(projectId, source);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="brand-panel" aria-labelledby="asset-library-title">
      <div className="brand-panel__heading">
        <div>
          <h2 id="asset-library-title">{t("brand.assets.title")}</h2>
          <p>{t("brand.assets.body")}</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp aria-hidden="true" size={16} />
          {t("brand.assets.import")}
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </div>
      <div className="brand-filters">
        <label className="field-stack">
          <span className="field-label">{t("brand.assets.typeFilter")}</span>
          <select
            className="text-input"
            value={kind}
            onChange={(event) => setKind(event.currentTarget.value as "all" | AssetKind)}
          >
            {FILTER_KINDS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? t("brand.assets.all") : value}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.assets.tagFilter")}</span>
          <input
            className="text-input"
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
          />
        </label>
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {assets.length ? (
        <div className="asset-grid">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              usage={view.assetUsage[asset.id] ?? 0}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="brand-empty">{t("brand.assets.empty")}</div>
      )}
    </section>
  );
}
