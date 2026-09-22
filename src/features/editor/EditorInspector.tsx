import { useEffect, useState } from "react";

import type { NormalizedRect } from "@/domain/common/primitives";
import type { LayerTransform, RenderedSceneLayer } from "@/editor/model/editor-types";
import { useI18n } from "@/i18n/I18nProvider";

interface NumericFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

function NumericField({ label, value, onCommit }: NumericFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setDraft(String(value));
  };
  return (
    <label className="editor-number-field">
      <span>{label}</span>
      <input
        className="text-input"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

interface EditorInspectorProps {
  layer?: RenderedSceneLayer;
  onTransform: (transform: LayerTransform) => void;
  onImagePresentation: (
    fit: "cover" | "contain" | "fill",
    crop?: NormalizedRect,
  ) => void;
}

export function EditorInspector({
  layer,
  onTransform,
  onImagePresentation,
}: EditorInspectorProps) {
  const { t } = useI18n();
  return (
    <section className="editor-panel editor-inspector" aria-label={t("editor.inspector")}>
      <header className="editor-panel__header">
        <div>
          <p className="panel-kicker">{t("editor.properties")}</p>
          <h2>{t("editor.inspector")}</h2>
        </div>
      </header>
      {!layer ? (
        <p className="editor-panel__empty">{t("editor.selectHint")}</p>
      ) : (
        <>
          <div className="editor-inspector__identity">
            <strong>{layer.name}</strong>
            <small>
              {layer.type} · {layer.source}
            </small>
          </div>
          <div className="editor-inspector__grid">
            <NumericField
              label="X"
              value={layer.transform.x}
              onCommit={(x) => onTransform({ ...layer.transform, x })}
            />
            <NumericField
              label="Y"
              value={layer.transform.y}
              onCommit={(y) => onTransform({ ...layer.transform, y })}
            />
            <NumericField
              label="W"
              value={layer.transform.width}
              onCommit={(width) => onTransform({ ...layer.transform, width: Math.max(1, width) })}
            />
            <NumericField
              label="H"
              value={layer.transform.height}
              onCommit={(height) =>
                onTransform({ ...layer.transform, height: Math.max(1, height) })
              }
            />
            <NumericField
              label="°"
              value={layer.transform.rotation}
              onCommit={(rotation) => onTransform({ ...layer.transform, rotation })}
            />
          </div>
          {layer.type === "image" ? (
            <fieldset className="editor-image-crop">
              <legend>{t("editor.imagePlacement")}</legend>
              <label className="field-stack">
                <span className="field-label">{t("editor.imageFit")}</span>
                <select
                  className="text-input"
                  value={layer.fit}
                  onChange={(event) =>
                    onImagePresentation(
                      event.currentTarget.value as "cover" | "contain" | "fill",
                      layer.crop,
                    )
                  }
                >
                  <option value="contain">contain</option>
                  <option value="cover">cover</option>
                  <option value="fill">fill</option>
                </select>
              </label>
              <div className="editor-inspector__grid">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <NumericField
                    key={key}
                    label={`crop ${key}`}
                    value={Math.round(
                      (layer.crop?.[key] ?? (key === "width" || key === "height" ? 1 : 0)) * 100,
                    )}
                    onCommit={(value) => {
                      const current = layer.crop ?? { x: 0, y: 0, width: 1, height: 1 };
                      const next = {
                        ...current,
                        [key]: Math.max(0, Math.min(100, value)) / 100,
                      };
                      if (
                        next.width <= 0 ||
                        next.height <= 0 ||
                        next.x + next.width > 1 ||
                        next.y + next.height > 1
                      )
                        return;
                      onImagePresentation(layer.fit, next);
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="button button--ghost button--sm"
                onClick={() => onImagePresentation(layer.fit)}
              >
                {t("editor.resetCrop")}
              </button>
            </fieldset>
          ) : null}
          <p className="editor-inspector__note">{t("editor.numericHint")}</p>
        </>
      )}
    </section>
  );
}
