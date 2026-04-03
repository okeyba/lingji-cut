import { useMemo, useState } from 'react';
import type { MenuAction } from '../lib/electron-api';
import type { RecentProject, SaveStatus } from '../store/timeline';

interface ToolbarProps {
  compact: boolean;
  page: 'setup' | 'editor';
  projectName: string;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  recentProjects: RecentProject[];
  onCommand: (command: MenuAction) => void;
  onOpenRecentProject: (projectPath: string) => void;
}

const saveStatusLabelMap: Record<SaveStatus, string> = {
  idle: '未打开工程',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
};

const baseMenuButtonStyle = {
  height: 36,
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#f8fafc',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  transition: 'all 150ms ease-out',
};

const shortcutTextStyle = {
  color: '#64748b',
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontWeight: 500,
};

export function Toolbar({
  compact,
  page,
  projectName,
  saveStatus,
  canUndo,
  canRedo,
  recentProjects,
  onCommand,
  onOpenRecentProject,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'project' | 'edit' | 'media' | null>(null);
  const helperText =
    page === 'setup'
      ? '导入 MP3 与 SRT 后，即可进入时间轴编辑。'
      : '拖入素材、调整时间轴，并直接导出 Remotion 视频。';
  const saveStatusLabel = saveStatusLabelMap[saveStatus];
  const visibleProjectName = projectName || (page === 'editor' ? '未命名工程' : '欢迎页');
  const menus = useMemo(
    () => [
      {
        key: 'project' as const,
        label: '项目',
        items: [
          ['新建项目', 'Cmd/Ctrl+N', () => onCommand('new-project')],
          ['打开项目', 'Cmd/Ctrl+O', () => onCommand('open-project')],
          ['关闭项目', '', () => onCommand('close-project')],
          ['在 Finder 中显示', '', () => onCommand('show-project-in-folder')],
        ],
      },
      {
        key: 'edit' as const,
        label: '编辑',
        items: [
          ['撤销', 'Cmd/Ctrl+Z', () => onCommand('undo')],
          ['重做', 'Cmd/Ctrl+Shift+Z', () => onCommand('redo')],
        ],
      },
      {
        key: 'media' as const,
        label: '媒体',
        items: [
          ['替换音频', '', () => onCommand('replace-audio')],
          ['替换字幕', '', () => onCommand('replace-srt')],
          ['添加素材', '', () => onCommand('add-asset')],
          ['导出 MP4', 'Cmd/Ctrl+E', () => onCommand('export')],
        ],
      },
    ],
    [onCommand],
  );

  return (
    <div
      style={{
        minHeight: compact ? 66 : 62,
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, auto) minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 14,
        padding: compact ? '10px 16px' : '10px 20px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.98) 0%, rgba(15, 23, 42, 0.92) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          position: 'relative',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {menus.map((menu) => (
          <div key={menu.key} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu((current) => (current === menu.key ? null : menu.key))}
              style={{
                ...baseMenuButtonStyle,
                background: openMenu === menu.key
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(129, 140, 248, 0.12) 100%)'
                  : 'rgba(15, 23, 42, 0.6)',
                borderColor: openMenu === menu.key
                  ? 'rgba(56, 189, 248, 0.35)'
                  : 'rgba(148, 163, 184, 0.16)',
                color: openMenu === menu.key
                  ? '#e0f2fe'
                  : '#f8fafc',
              }}
            >
              {menu.label}
            </button>

            {openMenu === menu.key ? (
              <div
                style={{
                  position: 'absolute',
                  top: 44,
                  left: 0,
                  minWidth: menu.key === 'project' ? 280 : 240,
                  padding: 12,
                  borderRadius: 18,
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(2, 6, 23, 0.96) 100%)',
                  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.65)',
                  zIndex: 10,
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                {menu.items.map(([label, shortcut, handler]) => {
                  const disabled =
                    (menu.key === 'edit' && label === '撤销' && !canUndo) ||
                    (menu.key === 'edit' && label === '重做' && !canRedo) ||
                    (page !== 'editor' &&
                      ['关闭项目', '在 Finder 中显示', '替换音频', '替换字幕', '导出 MP4'].includes(
                        label,
                      ));

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (disabled) {
                          return;
                        }
                        setOpenMenu(null);
                        handler();
                      }}
                      style={{
                        width: '100%',
                        minHeight: 42,
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        borderRadius: 12,
                        border: 'none',
                        background: disabled ? 'transparent' : 'rgba(148, 163, 184, 0.06)',
                        color: disabled ? '#475569' : '#f8fafc',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontWeight: disabled ? 500 : 600,
                        transition: 'all 120ms ease-out',
                      }}
                    >
                      <span>{label}</span>
                      {shortcut ? <span style={shortcutTextStyle}>{shortcut}</span> : null}
                    </button>
                  );
                })}

                {menu.key === 'project' && recentProjects.length > 0 ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <div style={{
                      padding: '0 12px 8px',
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      color: '#38bdf8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}>
                      打开最近项目
                    </div>
                    {recentProjects.map((project) => (
                      <button
                        key={project.path}
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onOpenRecentProject(project.path);
                        }}
                        style={{
                          width: '100%',
                          minHeight: 44,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: 'none',
                          background: 'rgba(148, 163, 184, 0.06)',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 120ms ease-out',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{project.name}</div>
                        <div
                          style={{
                            marginTop: 3,
                            color: '#64748b',
                            fontSize: 11,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {project.path}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            letterSpacing: '0.20em',
            color: '#38bdf8',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}>
            VIDEO WEB MASTER
          </div>
          <div style={{ marginTop: 3, fontSize: compact ? 17 : 18, fontWeight: 800, color: '#f8fafc' }}>
            播客视频编辑器
          </div>
          <div
            style={{
              marginTop: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#94a3b8',
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: 500 }}>{visibleProjectName}</span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background:
                  saveStatus === 'error'
                    ? 'rgba(239, 68, 68, 0.18)'
                    : 'rgba(148, 163, 184, 0.10)',
                color: saveStatus === 'error' ? '#fca5a5' : '#cbd5e1',
                fontWeight: 600,
                border: saveStatus === 'error'
                  ? '1px solid rgba(239, 68, 68, 0.35)'
                  : '1px solid rgba(148, 163, 184, 0.15)',
              }}
            >
              {saveStatusLabel}
            </span>
          </div>
        </div>
        <div
          style={{
            color: '#64748b',
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'right',
            fontWeight: 500,
          }}
        >
          {helperText}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#94a3b8',
          fontSize: 12,
          WebkitAppRegion: 'no-drag',
        }}
      >
        <div style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
          {page === 'editor' ? '编辑中' : '准备导入'}
        </div>
        <button
          type="button"
          disabled={page !== 'editor'}
          onClick={() => onCommand('export')}
          style={{
            ...baseMenuButtonStyle,
            color: page === 'editor' ? '#f8fafc' : '#475569',
            cursor: page === 'editor' ? 'pointer' : 'not-allowed',
            background: page === 'editor'
              ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.22) 0%, rgba(234, 88, 12, 0.14) 100%)'
              : 'rgba(15, 23, 42, 0.6)',
            borderColor: page === 'editor'
              ? 'rgba(249, 115, 22, 0.35)'
              : 'rgba(148, 163, 184, 0.16)',
          }}
        >
          导出 MP4
        </button>
      </div>
    </div>
  );
}
