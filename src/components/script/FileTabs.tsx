import { FileText, Film, X } from 'lucide-react';
import { m, LayoutGroup } from 'framer-motion';
import { isVideoImportPreviewFile } from '../../lib/video-import-preview';
import { springs } from '../../ui/lib/motion';
import { VersionDropdown } from './VersionDropdown';

interface FileTabsProps {
  tabs: string[];
  openedFile: string | null;
  fileDirtyMap: Record<string, boolean>;
  fileConflictMap: Record<string, boolean>;
  onOpenFile: (file: string) => void;
  onCloseTab?: (file: string) => void;
  onTabContextMenu?: (file: string) => void;
}

export function FileTabs({
  tabs,
  openedFile,
  fileDirtyMap,
  fileConflictMap,
  onOpenFile,
  onCloseTab,
  onTabContextMenu,
}: FileTabsProps) {
  if (!tabs.length) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 1,
        padding: '0 12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-window-bg)',
      }}
    >
      <LayoutGroup id="file-tabs">
      {tabs.map((tab) => {
        const active = tab === openedFile;
        const dirty = fileDirtyMap[tab];
        const conflict = fileConflictMap[tab];
        const previewFile = isVideoImportPreviewFile(tab);

        return (
          <div
            key={tab}
            onContextMenu={(event) => {
              event.preventDefault();
              onTabContextMenu?.(tab);
            }}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              borderBottom: '2px solid transparent',
            }}
          >
            {active && (
              <>
                <m.span
                  layoutId="file-tab-bg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'color-mix(in srgb, var(--color-selection-blue, #0a84ff) 10%, transparent)',
                    pointerEvents: 'none',
                  }}
                  transition={springs.swift}
                />
                <m.span
                  layoutId="file-tab-underline"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -2,
                    height: 2,
                    background: 'var(--color-selection-blue, #0a84ff)',
                    pointerEvents: 'none',
                  }}
                  transition={springs.swift}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => onOpenFile(tab)}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 4px 10px 12px',
                border: 'none',
                background: 'transparent',
                color: active
                  ? 'var(--color-selection-blue, #0a84ff)'
                  : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {previewFile ? <Film size={14} /> : <FileText size={14} />}
              <span>{tab}</span>
              {dirty ? (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: 'var(--color-brand-warm, #ff9f0a)',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              {conflict ? (
                <span style={{ color: 'var(--color-danger, #ff453a)', fontSize: 11 }}>⚠</span>
              ) : null}
            </button>

            {onCloseTab && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab);
                }}
                title="关闭标签"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  marginRight: 4,
                  border: 'none',
                  borderRadius: 4,
                  background: 'transparent',
                  color: active
                    ? 'var(--color-selection-blue, #0a84ff)'
                    : 'var(--color-text-tertiary, #636366)',
                  cursor: 'pointer',
                  opacity: 0.6,
                  transition: 'opacity 0.1s, background 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
      </LayoutGroup>

      {/* 版本历史下拉：仅在查看 script.md 时挂载，避免无意义重渲染 */}
      {openedFile === 'script.md' ? (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <VersionDropdown />
        </div>
      ) : null}
    </div>
  );
}
