import { useEffect, useMemo, useState } from "react";

import type { GuideSlotView } from "@/application/queries/guide-studio-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import type { Asset } from "@/domain/assets/asset";
import { localizedValue } from "@/domain/guide/page-content";
import type { GuidePageView } from "@/application/queries/guide-studio-query";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";

function LocalizedText({
  value,
  localeMode,
}: {
  value: { en?: string; ar?: string };
  localeMode: TemplateLocaleMode;
}) {
  if (localeMode === "bilingual") {
    return (
      <div className="guide-bilingual-copy">
        <span lang="en" dir="ltr">
          {localizedValue(value, "en") || "—"}
        </span>
        <span lang="ar" dir="rtl">
          {localizedValue(value, "ar") || localizedValue(value, "en") || "—"}
        </span>
      </div>
    );
  }
  return (
    <span lang={localeMode} dir={localeMode === "ar" ? "rtl" : "ltr"}>
      {localizedValue(value, localeMode) || "—"}
    </span>
  );
}

function AssetImage({ asset }: { asset: Asset }) {
  const runtime = useStudioRuntime();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void runtime.binaries.get(asset.contentHash).then((binary) => {
      if (!active || !binary) return;
      objectUrl = URL.createObjectURL(
        new Blob([Uint8Array.from(binary.bytes).buffer], { type: binary.mime }),
      );
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.contentHash, runtime.binaries]);

  return url ? (
    <img className="guide-logo-image" src={url} alt={asset.name} />
  ) : (
    <span>{asset.name}</span>
  );
}

function SlotContent({
  slot,
  localeMode,
  assets,
}: {
  slot: GuideSlotView;
  localeMode: TemplateLocaleMode;
  assets: Asset[];
}) {
  const value = slot.value;
  if (!value) {
    return (
      <div className="guide-slot-missing">
        <strong>Needs input</strong>
        <span>{slot.role}</span>
      </div>
    );
  }
  switch (value.kind) {
    case "localized-text":
      return <LocalizedText value={value.value} localeMode={localeMode} />;
    case "colors":
      return (
        <div className="guide-color-grid">
          {value.tokens.slice(0, 8).map((token) => (
            <div className="guide-color-chip" key={token.id}>
              <span className="guide-color-chip__swatch" style={{ background: token.srgbHex }} />
              <span>{token.name.en ?? token.name.ar}</span>
              <code>{token.srgbHex}</code>
            </div>
          ))}
        </div>
      );
    case "logos":
      return (
        <div className="guide-logo-grid">
          {value.variants.slice(0, 4).map((variant) => {
            const asset = assets.find((candidate) => candidate.id === variant.assetId);
            return (
              <div className="guide-logo-item" key={variant.id}>
                {asset ? (
                  <AssetImage asset={asset} />
                ) : (
                  <span>{variant.name.en ?? variant.name.ar}</span>
                )}
              </div>
            );
          })}
        </div>
      );
    case "fonts":
      return (
        <div className="guide-type-stack">
          {value.fonts.slice(0, 3).map((font) => (
            <div key={font.id}>
              <strong>{font.familyName}</strong>
              <span> Aa أبجدية 123 </span>
            </div>
          ))}
        </div>
      );
    case "text-styles":
      return (
        <div className="guide-type-stack">
          {value.styles.slice(0, 5).map((style) => (
            <div key={style.id}>
              <strong>{style.name}</strong>
              <span>
                {style.role} · {style.fontSize}px
              </span>
            </div>
          ))}
        </div>
      );
    case "assets":
      return (
        <div className="guide-asset-list">
          {value.assets.slice(0, 6).map((asset) => (
            <span key={asset.id}>
              {asset.name} · {asset.kind}
            </span>
          ))}
        </div>
      );
    case "rule":
      return <pre className="guide-rule-data">{JSON.stringify(value.value, null, 2)}</pre>;
    case "summary":
      return (
        <div className="guide-summary-grid">
          {Object.entries(value.values).map(([key, count]) => (
            <div key={key}>
              <strong>{count}</strong>
              <span>{key}</span>
            </div>
          ))}
        </div>
      );
    case "checklist":
      return (
        <ul className="guide-checklist">
          {value.items.map((item) => (
            <li key={`${item.en ?? ""}::${item.ar ?? ""}`}>
              <LocalizedText value={item} localeMode={localeMode} />
            </li>
          ))}
        </ul>
      );
  }
}

export function GuideTemplatePreview({
  pageView,
  localeMode,
  assets,
}: {
  pageView: GuidePageView;
  localeMode: TemplateLocaleMode;
  assets: Asset[];
}) {
  const template = pageView.template;
  const slotById = useMemo(
    () => new Map(pageView.slots.map((slot) => [slot.id, slot])),
    [pageView.slots],
  );
  if (!template) return <div className="guide-preview-error">Template definition is missing.</div>;
  return (
    <div
      className={`guide-canvas guide-canvas--${template.familyId} guide-canvas--${template.bilingualArrangement ?? localeMode}`}
      data-template-id={template.id}
      data-family={template.familyId}
      data-locale-mode={localeMode}
    >
      {template.slots.map((templateSlot) => {
        const slot = slotById.get(templateSlot.id);
        return (
          <section
            className={`guide-canvas-slot guide-canvas-slot--${templateSlot.role.replaceAll(".", "-")}`}
            key={templateSlot.id}
            data-slot-role={templateSlot.role}
            style={{
              insetInlineStart: `${templateSlot.rect.x}%`,
              top: `${templateSlot.rect.y}%`,
              width: `${templateSlot.rect.width}%`,
              height: `${templateSlot.rect.height}%`,
            }}
            dir="auto"
          >
            {slot ? <SlotContent slot={slot} localeMode={localeMode} assets={assets} /> : null}
          </section>
        );
      })}
      <span className="guide-template-signature">
        {template.familyId} · {template.variantId}
      </span>
    </div>
  );
}
