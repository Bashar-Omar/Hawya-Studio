import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  BoxSelect,
  Copy,
  Group,
  Hand,
  ImagePlus,
  Keyboard,
  Magnet,
  MousePointer2,
  Redo2,
  Rows3,
  Square,
  Type,
  Undo2,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AlignmentCommand, DistributionCommand } from "@/editor/geometry/geometry";
import type { EditorTool } from "@/editor/model/editor-types";
import { useI18n } from "@/i18n/I18nProvider";

interface EditorToolbarProps {
  tool: EditorTool;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  canDistribute: boolean;
  hasPlaceableAsset: boolean;
  snapEnabled: boolean;
  onTool: (tool: EditorTool) => void;
  onToggleSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (zoom: number) => void;
  onFit: () => void;
  onAddText: () => void;
  onAddShape: () => void;
  onAddAsset: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onAlign: (command: AlignmentCommand) => void;
  onDistribute: (command: DistributionCommand) => void;
  onShortcuts: () => void;
}

const TOOL_BUTTONS: Array<{ tool: EditorTool; icon: typeof MousePointer2 }> = [
  { tool: "select", icon: MousePointer2 },
  { tool: "hand", icon: Hand },
];

export function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="editor-toolbar" role="toolbar" aria-label={t("editor.tools")}>
      <div className="editor-toolbar__group">
        {TOOL_BUTTONS.map(({ tool, icon: Icon }) => {
          const label =
            tool === "select" ? `${t("editor.tool.select")} (V)` : `${t("editor.tool.hand")} (H)`;
          return (
            <Button
              key={tool}
              size="icon"
              variant={props.tool === tool ? "secondary" : "ghost"}
              aria-label={label}
              aria-pressed={props.tool === tool}
              onClick={() => props.onTool(tool)}
            >
              <Icon aria-hidden="true" size={16} />
            </Button>
          );
        })}
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("editor.tool.text")} (T)`}
          onClick={props.onAddText}
        >
          <Type aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("editor.tool.shape")} (R)`}
          onClick={props.onAddShape}
        >
          <Square aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`${t("editor.tool.asset")} (I)`}
          disabled={!props.hasPlaceableAsset}
          onClick={props.onAddAsset}
        >
          <ImagePlus aria-hidden="true" size={16} />
        </Button>
      </div>

      <div className="editor-toolbar__group">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.undo")}
          disabled={!props.canUndo}
          onClick={props.onUndo}
        >
          <Undo2 aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.redo")}
          disabled={!props.canRedo}
          onClick={props.onRedo}
        >
          <Redo2 aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.copy")}
          onClick={props.onDuplicate}
        >
          <Copy aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.group")}
          disabled={!props.canGroup}
          onClick={props.onGroup}
        >
          <Group aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.ungroup")}
          disabled={!props.canUngroup}
          onClick={props.onUngroup}
        >
          <Ungroup aria-hidden="true" size={16} />
        </Button>
      </div>

      <div className="editor-toolbar__group editor-toolbar__group--alignment">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.left")}
          onClick={() => props.onAlign("left")}
        >
          <AlignStartVertical aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.centerX")}
          onClick={() => props.onAlign("center-x")}
        >
          <AlignCenterVertical aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.right")}
          onClick={() => props.onAlign("right")}
        >
          <AlignEndVertical aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.top")}
          onClick={() => props.onAlign("top")}
        >
          <AlignStartHorizontal aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.centerY")}
          onClick={() => props.onAlign("center-y")}
        >
          <AlignCenterHorizontal aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.align.bottom")}
          onClick={() => props.onAlign("bottom")}
        >
          <AlignEndHorizontal aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.distribute.horizontal")}
          disabled={!props.canDistribute}
          onClick={() => props.onDistribute("horizontal")}
        >
          <Rows3 aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.distribute.vertical")}
          disabled={!props.canDistribute}
          onClick={() => props.onDistribute("vertical")}
        >
          <BoxSelect aria-hidden="true" size={16} />
        </Button>
      </div>

      <div className="editor-toolbar__spacer" />
      <div className="editor-toolbar__group">
        <Button
          size="icon"
          variant={props.snapEnabled ? "secondary" : "ghost"}
          aria-label={props.snapEnabled ? t("editor.snapDisable") : t("editor.snapEnable")}
          aria-pressed={props.snapEnabled}
          onClick={props.onToggleSnap}
        >
          <Magnet aria-hidden="true" size={16} />
        </Button>
      </div>
      <div className="editor-toolbar__group editor-toolbar__zoom">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.zoomOut")}
          onClick={() => props.onZoom(props.zoom / 1.15)}
        >
          <ZoomOut aria-hidden="true" size={16} />
        </Button>
        <button
          className="editor-zoom-value"
          type="button"
          onClick={props.onFit}
          aria-label={t("editor.fit")}
        >
          {Math.round(props.zoom * 100)}%
        </button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.zoomIn")}
          onClick={() => props.onZoom(props.zoom * 1.15)}
        >
          <ZoomIn aria-hidden="true" size={16} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("editor.shortcuts")}
          onClick={props.onShortcuts}
        >
          <Keyboard aria-hidden="true" size={16} />
        </Button>
      </div>
    </div>
  );
}
