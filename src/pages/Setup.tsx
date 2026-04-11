import { useCallback, useMemo, useState } from 'react';
import { Plus, Sparkles, Music, FolderOpen, FolderSearch, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFileNameFromPath } from '../lib/utils';
import type { RecentProjectEntry } from '../lib/electron-api';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '../ui';
import { ProjectList } from '../components/ProjectList';
import heroBg from '../assets/hero-bg.png';
import styles from './Setup.module.css';

interface SetupProps {
  busy: boolean;
  errorMessage: string | null;
  projectName: string;
  recentProjects: RecentProjectEntry[];
  onComplete: (audioPath: string, srtPath: string) => Promise<void>;
  onOpenRecentProject: (projectDir: string) => Promise<void>;
  onRemoveRecentProject?: (projectDir: string) => Promise<void> | void;
  onStartScriptWorkbench: () => void;
  onOpenSettings: () => void;
}

interface ScanResult {
  dir: string;
  audioFiles: string[];
  srtFiles: string[];
}

export function Setup({
  busy,
  errorMessage,
  projectName,
  recentProjects,
  onComplete,
  onOpenRecentProject,
  onRemoveRecentProject,
  onStartScriptWorkbench,
  onOpenSettings,
}: SetupProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedSrt, setSelectedSrt] = useState<string | null>(null);

  const canImport = useMemo(
    () => Boolean(selectedAudio && selectedSrt && !busy),
    [selectedAudio, selectedSrt, busy],
  );

  const handleOpenImportDialog = useCallback(() => {
    setScanResult(null);
    setSelectedAudio(null);
    setSelectedSrt(null);
    setImportDialogOpen(true);
  }, []);

  const handleSelectDirectory = useCallback(async () => {
    const dir = await window.electronAPI.selectProjectDirectory();
    if (!dir) return;

    setScanning(true);
    setScanResult(null);
    setSelectedAudio(null);
    setSelectedSrt(null);

    try {
      const result = await window.electronAPI.scanImportDirectory(dir);
      setScanResult({ dir, ...result });
      // 自动选中第一个找到的文件
      if (result.audioFiles.length > 0) setSelectedAudio(result.audioFiles[0]);
      if (result.srtFiles.length > 0) setSelectedSrt(result.srtFiles[0]);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!selectedAudio || !selectedSrt) return;
    setImportDialogOpen(false);
    void onComplete(selectedAudio, selectedSrt);
  }, [selectedAudio, selectedSrt, onComplete]);

  return (
    <div className={styles.page}>
      <div className={styles.welcomeContent}>
        {/* ── Hero Banner ── */}
        <div className={styles.heroBanner}>
          <img src={heroBg} alt="" className={styles.heroBannerImage} />
          <div className={styles.heroBannerOverlay} />
          {projectName && (
            <div className={styles.projectBadge}>
              <FolderOpen size={13} strokeWidth={1.8} />
              {projectName}
            </div>
          )}
          <button
            type="button"
            className={styles.createButton}
            onClick={onStartScriptWorkbench}
          >
            <Plus size={18} strokeWidth={2.2} />
            开始创作
          </button>
        </div>

        {/* ── 快捷功能行 ── */}
        <div className={styles.quickBar}>
          <button
            type="button"
            className={styles.quickItem}
            onClick={onStartScriptWorkbench}
          >
            <div className={styles.quickItemIcon}>
              <Sparkles size={22} strokeWidth={1.5} />
            </div>
            <span className={styles.quickItemLabel}>AI写稿</span>
          </button>
          <button
            type="button"
            className={styles.quickItem}
            onClick={handleOpenImportDialog}
          >
            <div className={styles.quickItemIcon}>
              <Music size={22} strokeWidth={1.5} />
            </div>
            <span className={styles.quickItemLabel}>导入音频</span>
          </button>
        </div>

        {/* ── 本地草稿 ── */}
        <div className={styles.draftsSection}>
          <ProjectList
            projects={recentProjects}
            onOpenProject={onOpenRecentProject}
            onRemoveProject={onRemoveRecentProject}
          />
        </div>
      </div>

      {/* ── 导入弹窗 ── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent size="md">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>导入音频与字幕</DialogTitle>
            <DialogDescription>
              选择一个目录，系统将自动识别其中的音频和 SRT 字幕文件
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* 选择目录按钮 */}
            <button
              type="button"
              className={styles.dirPickerButton}
              onClick={handleSelectDirectory}
              disabled={scanning}
            >
              <FolderSearch size={20} strokeWidth={1.5} />
              <span className={styles.dirPickerText}>
                {scanning
                  ? '正在扫描...'
                  : scanResult
                    ? scanResult.dir
                    : '点击选择目录'}
              </span>
            </button>

            {/* 扫描结果 */}
            {scanResult && (
              <div className={styles.scanResults}>
                {/* 音频文件 */}
                <div className={styles.scanGroup}>
                  <div className={styles.scanGroupHeader}>
                    {scanResult.audioFiles.length > 0 ? (
                      <CheckCircle2 size={14} strokeWidth={2} className={styles.scanIconOk} />
                    ) : (
                      <AlertCircle size={14} strokeWidth={2} className={styles.scanIconWarn} />
                    )}
                    <span className={styles.scanGroupTitle}>
                      音频文件
                      <span className={styles.scanGroupCount}>
                        ({scanResult.audioFiles.length})
                      </span>
                    </span>
                  </div>
                  {scanResult.audioFiles.length > 0 ? (
                    <div className={styles.scanFileList}>
                      {scanResult.audioFiles.map((f) => (
                        <label key={f} className={styles.scanFileItem}>
                          <input
                            type="radio"
                            name="audio"
                            checked={selectedAudio === f}
                            onChange={() => setSelectedAudio(f)}
                            className={styles.scanRadio}
                          />
                          <span className={styles.scanFileName}>
                            {getFileNameFromPath(f)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.scanEmpty}>未找到音频文件</div>
                  )}
                </div>

                {/* SRT 文件 */}
                <div className={styles.scanGroup}>
                  <div className={styles.scanGroupHeader}>
                    {scanResult.srtFiles.length > 0 ? (
                      <CheckCircle2 size={14} strokeWidth={2} className={styles.scanIconOk} />
                    ) : (
                      <AlertCircle size={14} strokeWidth={2} className={styles.scanIconWarn} />
                    )}
                    <span className={styles.scanGroupTitle}>
                      字幕文件
                      <span className={styles.scanGroupCount}>
                        ({scanResult.srtFiles.length})
                      </span>
                    </span>
                  </div>
                  {scanResult.srtFiles.length > 0 ? (
                    <div className={styles.scanFileList}>
                      {scanResult.srtFiles.map((f) => (
                        <label key={f} className={styles.scanFileItem}>
                          <input
                            type="radio"
                            name="srt"
                            checked={selectedSrt === f}
                            onChange={() => setSelectedSrt(f)}
                            className={styles.scanRadio}
                          />
                          <span className={styles.scanFileName}>
                            {getFileNameFromPath(f)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.scanEmpty}>未找到 SRT 字幕文件</div>
                  )}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className={styles.importError}>{errorMessage}</div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">取消</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={!canImport}
              onClick={handleImportConfirm}
            >
              {busy ? '正在初始化...' : '导入并开始'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
