import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useViewportSize } from '../hooks/useViewportSize';
import { getDroppedFilePath, getImportFileError, type ImportKind } from '../lib/import-files';
import { getSetupLayoutMode } from '../lib/layout';
import { getFileNameFromPath } from '../lib/utils';
import { Badge, Button, SurfaceCard } from '../ui/primitives';
import { FileDropCard } from '../ui/patterns';
import styles from './Setup.module.css';

interface SetupProps {
  busy: boolean;
  errorMessage: string | null;
  onComplete: (audioPath: string, srtPath: string) => Promise<void>;
}

function ImportCard({
  label,
  helper,
  value,
  accentColor,
  icon,
  selectLabel,
  onPickFile,
  onDrop,
  compact,
}: {
  label: string;
  helper: string;
  value: string | null;
  accentColor: string;
  icon: string;
  selectLabel: string;
  onPickFile: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  compact: boolean;
}) {
  return (
    <FileDropCard
      eyebrow={label}
      heading={helper}
      value={value ? getFileNameFromPath(value) : null}
      placeholder="把文件从 Finder 直接拖到这里"
      accentColor={accentColor}
      icon={icon}
      action={
        <Button
          type="button"
          onClick={onPickFile}
          variant="secondary"
          style={{
            height: 42,
            borderColor: `${accentColor}55`,
            background: `${accentColor}18`,
          }}
        >
          {selectLabel}
        </Button>
      }
      compact={compact}
      onDrop={onDrop}
    />
  );
}

export function Setup({ busy, errorMessage, onComplete }: SetupProps) {
  const viewport = useViewportSize();
  const layout = getSetupLayoutMode(viewport.width, viewport.height);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [srtPath, setSrtPath] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const canStart = useMemo(() => Boolean(audioPath && srtPath && !busy), [audioPath, busy, srtPath]);

  const applyImportPath = useCallback((kind: ImportKind, filePath: string) => {
    const validationError = getImportFileError(filePath, kind);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    if (kind === 'audio') {
      setAudioPath(filePath);
      return;
    }

    setSrtPath(filePath);
  }, []);

  const createDropHandler = useCallback(
    (kind: ImportKind) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined;
      if (!file) {
        return;
      }

      const filePath = getDroppedFilePath(file, window.electronAPI.getPathForFile);
      if (!filePath) {
        setLocalError('未能读取拖入文件的本地路径，请改用“选择文件”按钮或重试拖拽。');
        return;
      }

      applyImportPath(kind, filePath);
    },
    [applyImportPath],
  );

  const createSelectHandler = useCallback(
    (kind: ImportKind) => async () => {
      const filePath = await window.electronAPI.selectSetupFile(kind);
      if (!filePath) {
        return;
      }

      applyImportPath(kind, filePath);
    },
    [applyImportPath],
  );

  return (
    <div className={styles.page}>
      <div
        className={styles.content}
        style={{
          gridTemplateColumns: layout.stackColumns
            ? 'minmax(0, 1fr)'
            : 'minmax(0, 1.08fr) minmax(420px, 0.92fr)',
          gap: layout.stackColumns ? 24 : 32,
          padding: `${layout.compactHero ? 22 : 48}px clamp(18px, 4vw, 52px) 24px`,
        }}
      >
        <div
          className={styles.hero}
          style={{ order: layout.stackColumns ? 2 : 1 }}
        >
          <div>
            <div className={styles.heroEyebrow}>LOCAL PODCAST VIDEO EDITOR</div>
            <h1
              className={styles.heroTitle}
              style={{ fontSize: layout.compactHero ? 'clamp(32px, 7vw, 42px)' : 'clamp(42px, 6vw, 54px)' }}
            >
              给口播音频
              <br />
              搭一条可编辑的视频时间轴
            </h1>
            <p
              className={styles.heroDescription}
              style={{
                maxWidth: layout.stackColumns ? '100%' : 560,
                fontSize: layout.compactHero ? 15 : 16,
              }}
            >
              先导入 MP3 和匹配的 SRT。进入编辑器后，你可以把图片和视频拖到时间轴里，
              用同一份时间线驱动 Remotion 预览和 MP4 导出。
            </p>
          </div>

          <div
            className={styles.featureGrid}
            style={{
              gridTemplateColumns: `repeat(${layout.featureColumns}, minmax(0, 1fr))`,
              marginTop: layout.compactHero ? 24 : 40,
            }}
          >
            {[
              ['01', '导入口播', '拖拽 MP3 与 SRT，自动解析字幕时长'],
              ['02', '叠加素材', '把图片或视频拖到时间轴目标时间点'],
              ['03', '实时导出', '预览与 renderMedia 共用一套 inputProps'],
            ].map(([index, title, description]) => (
              <SurfaceCard
                key={index}
                variant="subtle"
                padding="md"
                className={styles.featureCard}
              >
                <div className={styles.featureIndex}>{index}</div>
                <div className={styles.featureTitle}>{title}</div>
                <div className={styles.featureDescription}>{description}</div>
              </SurfaceCard>
            ))}
          </div>
        </div>

        <SurfaceCard
          variant="elevated"
          padding="lg"
          className={styles.importPanel}
          style={{
            maxWidth: layout.stackColumns ? 720 : 'none',
            justifySelf: layout.stackColumns ? 'stretch' : 'auto',
            order: layout.stackColumns ? 1 : 2,
            gap: layout.compactHero ? 14 : 18,
          }}
        >
          <div>
            <Badge variant="neutral">STEP 1</Badge>
            <h2
              className={styles.importIntroTitle}
              style={{ fontSize: layout.compactHero ? 24 : 28 }}
            >
              把素材丢进来
            </h2>
            <p className={styles.importIntroDescription}>
              这一步只需要两份基础文件。项目目录会在下一步第一次进入编辑器时选择。
            </p>
          </div>

          <div
            className={styles.importGrid}
            style={{
              gridTemplateColumns:
                viewport.width < 680 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
            }}
          >
            <ImportCard
              label="AUDIO"
              helper="拖入 MP3 口播音频"
              value={audioPath}
              accentColor="#7bd5ff"
              icon="🎙"
              selectLabel="选择 MP3 文件"
              onPickFile={() => {
                void createSelectHandler('audio')();
              }}
              onDrop={createDropHandler('audio')}
              compact={layout.compactHero}
            />
            <ImportCard
              label="SUBTITLE"
              helper="拖入对应 SRT 字幕"
              value={srtPath}
              accentColor="#ffb547"
              icon="📝"
              selectLabel="选择 SRT 文件"
              onPickFile={() => {
                void createSelectHandler('srt')();
              }}
              onDrop={createDropHandler('srt')}
              compact={layout.compactHero}
            />
          </div>

          {errorMessage || localError ? (
            <SurfaceCard variant="danger" padding="sm" className={styles.errorBanner}>
              {localError || errorMessage}
            </SurfaceCard>
          ) : null}

          <Button
            disabled={!canStart}
            onClick={() => {
              if (audioPath && srtPath) {
                void onComplete(audioPath, srtPath);
              }
            }}
            variant={canStart ? 'tint' : 'secondary'}
            size="lg"
            className={styles.primaryAction}
          >
            {busy ? '正在初始化工程...' : '开始编辑'}
          </Button>
        </SurfaceCard>
      </div>

      <div
        className={styles.footerNote}
        style={{ padding: `0 clamp(18px, 4vw, 52px) ${layout.compactHero ? 20 : 28}px` }}
      >
        Preview 与导出共享同一份 timeline.json。拖拽失败时，优先从 Finder 直接拖入文件，而不是从浏览器窗口拖入。
      </div>
    </div>
  );
}
