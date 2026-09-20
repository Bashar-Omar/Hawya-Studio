import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RenderedSceneLayer, SceneLayerId } from "@/editor/model/editor-types";
import { useI18n } from "@/i18n/I18nProvider";

interface EditorLayerTreeProps {
  layers: RenderedSceneLayer[];
  selectedIds: SceneLayerId[];
  onSelect: (id: SceneLayerId, toggle: boolean) => void;
  onVisible: (id: SceneLayerId, visible: boolean) => void;
  onLocked: (id: SceneLayerId, locked: boolean) => void;
}

export function EditorLayerTree({
  layers,
  selectedIds,
  onSelect,
  onVisible,
  onLocked,
}: EditorLayerTreeProps) {
  const { t } = useI18n();
  const selected = new Set(selectedIds);
  return (
    <section className="editor-panel editor-layer-tree" aria-label="Layers">
      <header className="editor-panel__header">
        <div>
          <p className="panel-kicker">{t("editor.scene")}</p>
          <h2>{t("editor.layers")}</h2>
        </div>
        <span>{layers.length}</span>
      </header>
      <div className="editor-layer-list">
        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((layer) => (
            <div
              className={`editor-layer-row ${selected.has(layer.id) ? "is-selected" : ""} ${!layer.visible ? "is-hidden" : ""}`}
              key={layer.id}
              style={{ paddingInlineStart: layer.parentGroupId ? 24 : 8 }}
            >
              <button
                className="editor-layer-row__name"
                type="button"
                onClick={(event) => onSelect(layer.id, event.shiftKey)}
                aria-pressed={selected.has(layer.id)}
              >
                <span>{layer.name}</span>
                <small>
                  {layer.source} · {layer.type}
                </small>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${layer.visible ? t("editor.hide") : t("editor.show")} ${layer.name}`}
                onClick={() => onVisible(layer.id, !layer.visible)}
              >
                {layer.visible ? (
                  <Eye aria-hidden="true" size={14} />
                ) : (
                  <EyeOff aria-hidden="true" size={14} />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${layer.locked ? t("editor.unlock") : t("editor.lock")} ${layer.name}`}
                onClick={() => onLocked(layer.id, !layer.locked)}
              >
                {layer.locked ? (
                  <Lock aria-hidden="true" size={14} />
                ) : (
                  <Unlock aria-hidden="true" size={14} />
                )}
              </Button>
            </div>
          ))}
      </div>
    </section>
  );
}
