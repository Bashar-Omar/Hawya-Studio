import { FileUp, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import type { TextStyleInput } from "@/application/use-cases/manage-text-styles";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { Button } from "@/components/ui/button";
import { resolveTextStyleColor } from "@/domain/brand/brand-references";
import type { TextStyleToken } from "@/domain/brand/brand-system";
import type { ProjectId } from "@/domain/project/hawya-project";
import { useI18n } from "@/i18n/I18nProvider";

const STYLE_ROLES: TextStyleToken["role"][] = [
  "display",
  "h1",
  "h2",
  "h3",
  "body",
  "body-small",
  "caption",
  "button",
  "custom",
];

function TextStyleRow({
  style,
  projectId,
  view,
  onRefresh,
}: {
  style: TextStyleToken;
  projectId: ProjectId;
  view: BrandSystemView;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { t } = useI18n();
  const font = view.snapshot.project.brand.typography.fonts.find(
    (item) => item.id === style.fontRefId,
  );
  const [fontSize, setFontSize] = useState(style.fontSize);
  const [lineHeight, setLineHeight] = useState(style.lineHeight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!font) return null;
  const resolvedColor = resolveTextStyleColor(style, view.snapshot.project.brand.colors.tokens);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: _id, ...input } = style;
      await runtime.textStyles.update(projectId, style.id, { ...input, fontSize, lineHeight });
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
      await runtime.textStyles.remove(projectId, style.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="type-style-card">
      <div
        className="type-style-sample"
        data-color-token-id={style.colorTokenId}
        dir={style.direction === "auto" ? undefined : style.direction}
        style={{
          fontFamily: runtime.fontRegistry.familyName(font),
          fontSize: `${Math.min(48, style.fontSize)}px`,
          lineHeight: `${style.lineHeight}px`,
          ...(resolvedColor ? { color: resolvedColor } : {}),
        }}
      >
        هوية بصرية · Brand Identity
      </div>
      <div className="brand-form-grid brand-form-grid--compact">
        <div className="field-stack">
          <span className="field-label">{t("brand.type.styleName")}</span>
          <span className="readonly-value">{style.name}</span>
        </div>
        <label className="field-stack">
          <span className="field-label">{t("brand.type.size")}</span>
          <input
            className="text-input"
            type="number"
            min="1"
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.currentTarget.value))}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.type.lineHeight")}</span>
          <input
            className="text-input"
            type="number"
            min="0.5"
            step="0.05"
            value={lineHeight}
            onChange={(event) => setLineHeight(Number(event.currentTarget.value))}
          />
        </label>
      </div>
      <div className="brand-row-card__actions">
        <Button size="sm" variant="secondary" onClick={() => void save()} disabled={busy}>
          <Save aria-hidden="true" size={14} />
          {t("common.save")}
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

export function TypographyPanel({
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
  const [licenseNote, setLicenseNote] = useState("");
  const [styleName, setStyleName] = useState("Body");
  const [styleRole, setStyleRole] = useState<TextStyleToken["role"]>("body");
  const [fontRefId, setFontRefId] = useState("");
  const [colorTokenId, setColorTokenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFont = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const source = await runtime.assetFiles.read(file, "font");
      const result = await runtime.importFont.execute(projectId, source, licenseNote);
      setFontRefId(result.font.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addStyle = async () => {
    if (!fontRefId || !styleName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input: TextStyleInput = {
        name: styleName.trim(),
        role: styleRole,
        fontRefId,
        fontSize: styleRole === "body" ? 16 : 32,
        lineHeight: styleRole === "body" ? 24 : 38.4,
        letterSpacing: 0,
        direction: "auto",
        ...(colorTokenId ? { colorTokenId } : {}),
      };
      await runtime.textStyles.add(projectId, input);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const fonts = view.snapshot.project.brand.typography.fonts;
  const styles = view.snapshot.project.brand.typography.styles;
  return (
    <section className="brand-panel" aria-labelledby="type-panel-title">
      <div className="brand-panel__heading">
        <div>
          <h2 id="type-panel-title">{t("brand.type.title")}</h2>
          <p>{t("brand.type.body")}</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp aria-hidden="true" size={16} />
          {t("brand.type.upload")}
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importFont(file);
          }}
        />
      </div>
      <label className="field-stack brand-license-note">
        <span className="field-label">{t("brand.type.license")}</span>
        <input
          className="text-input"
          value={licenseNote}
          onChange={(event) => setLicenseNote(event.currentTarget.value)}
          placeholder={t("brand.type.licensePlaceholder")}
        />
        <span className="field-help">{t("brand.type.rightsReminder")}</span>
      </label>
      {fonts.length ? (
        <div className="font-grid">
          {fonts.map((font) => {
            const coverage = font.coverage?.arabic as
              | { ratio?: number; hasGsub?: boolean; hasGpos?: boolean }
              | undefined;
            const ratio = coverage?.ratio ?? 0;
            return (
              <article className="font-card" key={font.id}>
                <div className="font-card__head">
                  <h3>{font.familyName}</h3>
                  <span className={`status-chip ${ratio < 0.9 ? "status-chip--warning" : ""}`}>
                    {t("brand.type.arabicCoverage", { percent: Math.round(ratio * 100) })}
                  </span>
                </div>
                <p
                  data-font-family={runtime.fontRegistry.familyName(font)}
                  style={{ fontFamily: runtime.fontRegistry.familyName(font) }}
                  className="font-sample"
                  lang="ar"
                  dir="rtl"
                >
                  الهوية تبدأ من التفاصيل
                </p>
                <p className="font-card__meta">
                  {font.subfamilyName ?? "—"} · {font.weight ?? "—"} · GSUB{" "}
                  {coverage?.hasGsub ? "✓" : "—"} · GPOS {coverage?.hasGpos ? "✓" : "—"}
                </p>
                {font.licenseNote ? <p className="font-card__meta">{font.licenseNote}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="brand-empty">{t("brand.type.emptyFonts")}</div>
      )}
      <div className="brand-subsection">
        <h3>{t("brand.type.styles")}</h3>
        <div className="brand-form-grid">
          <label className="field-stack">
            <span className="field-label">{t("brand.type.styleName")}</span>
            <input
              className="text-input"
              value={styleName}
              onChange={(event) => setStyleName(event.currentTarget.value)}
            />
          </label>
          <label className="field-stack">
            <span className="field-label">{t("brand.type.styleRole")}</span>
            <select
              className="text-input"
              value={styleRole}
              onChange={(event) =>
                setStyleRole(event.currentTarget.value as TextStyleToken["role"])
              }
            >
              {STYLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span className="field-label">{t("brand.type.font")}</span>
            <select
              className="text-input"
              value={fontRefId}
              onChange={(event) => setFontRefId(event.currentTarget.value)}
            >
              <option value="">{t("brand.type.selectFont")}</option>
              {fonts.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.familyName}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span className="field-label">{t("brand.type.color")}</span>
            <select
              className="text-input"
              value={colorTokenId}
              onChange={(event) => setColorTokenId(event.currentTarget.value)}
            >
              <option value="">{t("brand.type.inheritColor")}</option>
              {view.snapshot.project.brand.colors.tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name.en ?? token.name.ar}
                </option>
              ))}
            </select>
          </label>
          <div className="brand-form-grid__action">
            <Button
              onClick={() => void addStyle()}
              disabled={busy || !fontRefId || !styleName.trim()}
            >
              {t("brand.type.addStyle")}
            </Button>
          </div>
        </div>
        <div className="brand-stack">
          {styles.map((style) => (
            <TextStyleRow
              key={style.id}
              style={style}
              projectId={projectId}
              view={view}
              onRefresh={onRefresh}
            />
          ))}
          {styles.length === 0 ? (
            <div className="brand-empty">{t("brand.type.emptyStyles")}</div>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
