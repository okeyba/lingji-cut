import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui';
import { AppIcon } from './AppIcon';
import { CoverEditorCanvas } from './cover-editor/CoverEditorCanvas';
import type { CoverEditorCanvasHandle } from '../lib/cover-editor/fabric-bridge';
import { ToolRail, type EditorTool } from './cover-editor/ToolRail';
import { Inspector } from './cover-editor/Inspector';
import { FilterPanel } from './cover-editor/FilterPanel';
import { FontPicker } from './cover-editor/FontPicker';
import {
  ASPECT_RATIO_PRESETS,
  resolveAspectRatio,
} from '../lib/cover-editor/aspect-ratios';
import {
  createEmptyEditState,
  normalizeEditState,
} from '../lib/cover-editor/cover-edit-state';
import { getPresetAdjustments } from '../lib/cover-editor/filters';
import type {
  AspectRatioPreset,
  CoverEditState,
  CoverSaveMode,
  CoverTextOverlay,
  FilterPreset,
} from '../lib/cover-editor/contracts';
import styles from './CoverEditorModal.module.css';

interface CoverEditorModalProps {
  open: boolean;
  candidateId: string;
  imageUrl: string;
  prompt: string;
  initialEdits?: CoverEditState;
  timelineSize: { width: number; height: number };
  onClose: () => void;
  onSaveRequested: (args: {
    mode: CoverSaveMode;
    dataUrl: string;
    edits: CoverEditState;
  }) => void;
}

export function CoverEditorModal({
  open,
  candidateId: _candidateId,
  imageUrl,
  prompt,
  initialEdits,
  timelineSize,
  onClose,
  onSaveRequested,
}: CoverEditorModalProps) {
  const canvasRef = useRef<CoverEditorCanvasHandle>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [preset, setPreset] = useState<AspectRatioPreset>(
    initialEdits?.aspectRatio ?? 'timeline',
  );
  const [filterPreset, setFilterPreset] = useState<FilterPreset>(
    initialEdits?.filters?.preset ?? 'none',
  );
  const [selectedText, setSelectedText] = useState<CoverTextOverlay | null>(null);
  const [saveMode, setSaveMode] = useState<CoverSaveMode>('append');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const initialRatio = useMemo(
    () => resolveAspectRatio(preset, timelineSize),
    [preset, timelineSize],
  );

  const handleCancel = useCallback(() => {
    if (dirty) {
      if (!window.confirm('未保存的修改将丢失，确定关闭吗？')) return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleCancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) canvasRef.current?.redo();
        else canvasRef.current?.undo();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleCancel]);

  function handleAspectChange(next: AspectRatioPreset) {
    setPreset(next);
    const ratio = resolveAspectRatio(next, timelineSize);
    canvasRef.current?.setAspectRatio(ratio);
    setDirty(true);
  }

  function handleAddText() {
    canvasRef.current?.addText({
      text: '标题',
      fontFamily: 'PingFang SC',
      color: '#ffffff',
    });
    setActiveTool('text');
    setDirty(true);
  }

  function handleSave(mode: CoverSaveMode) {
    if (mode === 'overwrite') {
      if (!window.confirm('将覆盖原图，且无法恢复，确定继续？')) return;
    }
    const dataUrl = canvasRef.current?.exportDataUrl() ?? '';
    const edits = canvasRef.current?.getEditState() ?? createEmptyEditState();
    onSaveRequested({ mode, dataUrl, edits: { ...edits, aspectRatio: preset } });
  }

  if (!open) return null;

  const adjustments = getPresetAdjustments(filterPreset);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.title}>
            编辑封面 · {prompt.slice(0, 24) || '未命名'}
          </div>
          <div className={styles.headerActions}>
            <select
              className={styles.aspectSelect}
              value={preset}
              onChange={(e) =>
                handleAspectChange(e.target.value as AspectRatioPreset)
              }
            >
              {ASPECT_RATIO_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === 'timeline'
                    ? `时间线 ${timelineSize.width}×${timelineSize.height}`
                    : p.label}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              取消
            </Button>
            <div className={styles.saveSplit}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSave(saveMode)}
              >
                {saveMode === 'append' ? '另存为新候选' : '覆盖原图'}
              </Button>
              <Button.Icon
                variant="primary"
                onClick={() => setSaveMenuOpen((v) => !v)}
                aria-label="切换保存模式"
              >
                <AppIcon name="chevron-down" size={12} />
              </Button.Icon>
              {saveMenuOpen && (
                <div className={styles.saveMenu}>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveMode('append');
                      setSaveMenuOpen(false);
                    }}
                  >
                    另存为新候选
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveMode('overwrite');
                      setSaveMenuOpen(false);
                    }}
                  >
                    覆盖原图
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.body}>
          <ToolRail
            activeTool={activeTool}
            onSelectTool={(t) => {
              setActiveTool(t);
              if (t === 'text') handleAddText();
            }}
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
            canUndo
            canRedo
          />

          <div className={styles.canvasArea}>
            <CoverEditorCanvas
              ref={canvasRef}
              imageUrl={imageUrl}
              initialEdits={initialEdits ? normalizeEditState(initialEdits) : undefined}
              initialAspectRatio={initialRatio}
              onChange={() => setDirty(true)}
            />
          </div>

          {activeTool === 'filter' || activeTool === 'adjust' ? (
            <FilterPanel
              preset={filterPreset}
              adjustments={adjustments}
              onPresetChange={(p) => {
                setFilterPreset(p);
                canvasRef.current?.setFilterPreset(p);
              }}
              onAdjustmentChange={(k, v) =>
                canvasRef.current?.setFilterAdjustment(k, v)
              }
            />
          ) : (
            <Inspector
              selectedText={selectedText}
              onUpdateText={(patch) => {
                if (!selectedText) return;
                setSelectedText({ ...selectedText, ...patch });
                setDirty(true);
              }}
              onRemoveText={() => {
                canvasRef.current?.removeSelected();
                setSelectedText(null);
              }}
              fontFamilyPicker={
                <FontPicker
                  value={selectedText?.fontFamily ?? 'PingFang SC'}
                  onChange={(family) => {
                    if (selectedText)
                      setSelectedText({ ...selectedText, fontFamily: family });
                  }}
                />
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
