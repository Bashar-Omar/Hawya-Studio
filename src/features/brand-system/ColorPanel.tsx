import { Save, Trash2 } from "lucide-react";
import { useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import type { ColorTokenInput } from "@/application/use-cases/manage-color-tokens";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { Button } from "@/components/ui/button";
import type { ColorToken } from "@/domain/brand/brand-system";
import type { LocalizedString } from "@/domain/common/primitives";
import type { ProjectId } from "@/domain/project/hawya-project";
import { useI18n } from "@/i18n/I18nProvider";

const ROLES: ColorToken["role"][] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "supporting",
  "semantic",
  "custom",
];

type Cmyk = { c: number; m: number; y: number; k: number };

function localizedName(
  existing: LocalizedString,
  locale: "en" | "ar",
  value: string,
): LocalizedString {
  return locale === "ar" ? { ...existing, ar: value } : { ...existing, en: value };
}

function formatCmyk(value: Cmyk | undefined): string {
  return value ? `${value.c}, ${value.m}, ${value.y}, ${value.k}` : "";
}

function parseCmyk(value: string): Cmyk | undefined {
  if (!value.trim()) return undefined;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isFinite(part) || part < 0 || part > 100)
  ) {
    throw new Error("CMYK must contain four values from 0 to 100");
  }
  return { c: parts[0] ?? 0, m: parts[1] ?? 0, y: parts[2] ?? 0, k: parts[3] ?? 0 };
}

function ColorRow({
  token,
  usage,
  projectId,
  onRefresh,
}: {
  token: ColorToken;
  usage: number;
  projectId: ProjectId;
  onRefresh: () => Promise<void>;
}) {
  const runtime = useStudioRuntime();
  const { locale, t } = useI18n();
  const [name, setName] = useState(token.name[locale] ?? token.name.en ?? token.name.ar ?? "");
  const [hex, setHex] = useState(token.srgbHex);
  const [role, setRole] = useState<ColorToken["role"]>(token.role);
  const existingVerified = formatCmyk(token.print?.verifiedCmyk);
  const [verified, setVerified] = useState(existingVerified);
  const [pantone, setPantone] = useState(token.print?.pantoneName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextVerified =
        verified.trim() && verified.trim() !== existingVerified ? parseCmyk(verified) : undefined;
      const input: ColorTokenInput = {
        name: localizedName(token.name, locale, name.trim()),
        role,
        srgbHex: hex,
        alpha: token.alpha,
        ...(nextVerified ? { verifiedCmyk: nextVerified } : {}),
        ...(pantone.trim() ? { pantoneName: pantone.trim() } : {}),
        ...(token.usage ? { usage: token.usage } : {}),
      };
      await runtime.colorTokens.update(projectId, token.id, input);
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
      await runtime.colorTokens.remove(projectId, token.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const suggested = formatCmyk(token.print?.suggestedCmyk);
  return (
    <article className="color-token-card">
      <div
        className="color-token-card__swatch"
        style={{ background: token.srgbHex }}
        aria-label={token.srgbHex}
      />
      <div className="color-token-card__content">
        <div className="brand-form-grid brand-form-grid--compact">
          <label className="field-stack">
            <span className="field-label">{t("brand.colors.name")}</span>
            <input
              className="text-input"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label className="field-stack">
            <span className="field-label">HEX</span>
            <input
              className="text-input"
              value={hex}
              onChange={(event) => setHex(event.currentTarget.value)}
            />
          </label>
          <label className="field-stack">
            <span className="field-label">{t("brand.colors.role")}</span>
            <select
              className="text-input"
              value={role}
              onChange={(event) => setRole(event.currentTarget.value as ColorToken["role"])}
            >
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="field-stack">
            <span className="field-label">{t("brand.colors.references")}</span>
            <span className="readonly-value">{usage}</span>
          </div>
        </div>
        <div className="color-derived-grid">
          <span>
            RGB {token.rgb.r}, {token.rgb.g}, {token.rgb.b}
          </span>
          {token.hsl ? (
            <span>
              HSL {token.hsl.h.toFixed(1)}, {token.hsl.s.toFixed(1)}%, {token.hsl.l.toFixed(1)}%
            </span>
          ) : null}
          {token.oklch ? (
            <span>
              OKLCH {token.oklch.l.toFixed(3)} {token.oklch.c.toFixed(3)} {token.oklch.h.toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="brand-form-grid brand-form-grid--compact">
          <label className="field-stack">
            <span className="field-label">{t("brand.colors.suggestedCmyk")}</span>
            <input className="text-input" value={suggested} readOnly />
          </label>
          <label className="field-stack">
            <span className="field-label">{t("brand.colors.verifiedCmyk")}</span>
            <input
              className="text-input"
              value={verified}
              onChange={(event) => setVerified(event.currentTarget.value)}
              placeholder="0, 0, 0, 100"
            />
          </label>
          <label className="field-stack">
            <span className="field-label">Pantone</span>
            <input
              className="text-input"
              value={pantone}
              onChange={(event) => setPantone(event.currentTarget.value)}
            />
          </label>
        </div>
        {token.print?.verifiedCmykNeedsReview ? (
          <p className="brand-warning">{t("brand.colors.reviewPrint")}</p>
        ) : null}
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
      </div>
    </article>
  );
}

export function ColorPanel({
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
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#5B4FF7");
  const [role, setRole] = useState<ColorToken["role"]>("primary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState("");
  const [background, setBackground] = useState("");
  const [contrast, setContrast] = useState<number | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.colorTokens.add(projectId, {
        name: locale === "ar" ? { ar: name.trim() } : { en: name.trim() },
        role,
        srgbHex: hex,
      });
      setName("");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const checkContrast = async () => {
    if (!foreground || !background) return;
    try {
      setContrast(await runtime.colorTokens.contrast(projectId, foreground, background));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    }
  };

  const tokens = view.snapshot.project.brand.colors.tokens;
  return (
    <section className="brand-panel" aria-labelledby="color-panel-title">
      <div className="brand-panel__heading">
        <div>
          <h2 id="color-panel-title">{t("brand.colors.title")}</h2>
          <p>{t("brand.colors.body")}</p>
        </div>
      </div>
      <div className="brand-form-grid">
        <label className="field-stack">
          <span className="field-label">{t("brand.colors.name")}</span>
          <input
            className="text-input"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">HEX</span>
          <input
            className="text-input"
            type="text"
            value={hex}
            onChange={(event) => setHex(event.currentTarget.value)}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">{t("brand.colors.role")}</span>
          <select
            className="text-input"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value as ColorToken["role"])}
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="brand-form-grid__action">
          <Button onClick={() => void add()} disabled={busy || !name.trim()}>
            {t("brand.colors.add")}
          </Button>
        </div>
      </div>
      {tokens.length >= 2 ? (
        <div className="contrast-tool">
          <strong>{t("brand.colors.contrast")}</strong>
          <select
            className="text-input"
            value={foreground}
            onChange={(event) => setForeground(event.currentTarget.value)}
          >
            <option value="">{t("brand.colors.foreground")}</option>
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name[locale] ?? token.name.en ?? token.name.ar}
              </option>
            ))}
          </select>
          <select
            className="text-input"
            value={background}
            onChange={(event) => setBackground(event.currentTarget.value)}
          >
            <option value="">{t("brand.colors.background")}</option>
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name[locale] ?? token.name.en ?? token.name.ar}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => void checkContrast()}>
            {t("brand.colors.check")}
          </Button>
          {contrast !== null ? (
            <span className="contrast-result">WCAG 2.1 · {contrast.toFixed(2)}:1</span>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="brand-stack">
        {tokens.map((token) => (
          <ColorRow
            key={token.id}
            token={token}
            usage={view.colorUsage[token.id] ?? 0}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        ))}
        {tokens.length === 0 ? <div className="brand-empty">{t("brand.colors.empty")}</div> : null}
      </div>
    </section>
  );
}
