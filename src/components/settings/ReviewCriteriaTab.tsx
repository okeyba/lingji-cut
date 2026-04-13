import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadReviewCriteria, saveReviewCriteria } from '../../lib/settings-storage';
import { Alert, SaveButton, SettingsPageHeader, Textarea } from '../../ui';
import { hasUnsavedAIConfigChanges } from './ai-config-utils';
import { useSettingsTabGuard } from './useSettingsTabGuard';
import styles from './SettingsCommon.module.css';

interface ReviewCriteriaTabProps {
  onRegisterLeaveGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

function createReviewCriteriaSnapshot(criteria: string): string {
  return JSON.stringify({ criteria: criteria.trim() });
}

export function ReviewCriteriaTab({ onRegisterLeaveGuard }: ReviewCriteriaTabProps) {
  const [criteria, setCriteria] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextCriteria = loadReviewCriteria();
    setCriteria(nextCriteria);
    setLastSavedSnapshot(createReviewCriteriaSnapshot(nextCriteria));
    setHasLoaded(true);
  }, []);

  useEffect(
    () => () => {
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
    },
    [],
  );

  const currentSnapshot = useMemo(
    () => createReviewCriteriaSnapshot(criteria),
    [criteria],
  );

  const hasUnsavedChanges =
    hasLoaded && hasUnsavedAIConfigChanges(lastSavedSnapshot, currentSnapshot);

  useEffect(() => {
    if (hasUnsavedChanges && saved) {
      setSaved(false);
    }
  }, [hasUnsavedChanges, saved]);

  const handleSave = useCallback(async () => {
    try {
      await saveReviewCriteria(criteria);
      setCriteria(criteria.trim());
      setLastSavedSnapshot(createReviewCriteriaSnapshot(criteria));
      setSaved(true);
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
      saveFeedbackTimerRef.current = setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? `保存审查规范失败：${error.message}` : '保存审查规范失败，请稍后重试。');
      return false;
    }
  }, [criteria]);

  useSettingsTabGuard({
    title: '审查规范',
    hasUnsavedChanges,
    onSave: handleSave,
    onRegisterLeaveGuard,
  });

  return (
    <>
      <SettingsPageHeader
        title="审查规范配置"
        description="自定义 AI 审查口播稿时的关注要点，将叠加到系统内置审查规则之上"
      />

      <Alert
        variant="info"
        description="系统已内置基础审查规则（事实准确性、表达流畅性、逻辑连贯性等），以下内容将作为补充要求追加到审查 Prompt 中。"
        className={styles.reviewNotice}
      />

      <Textarea
        value={criteria}
        onChange={(e) => setCriteria(e.target.value)}
        rows={12}
        placeholder="输入你希望 AI 额外关注的审查维度..."
        size="md"
        resize="vertical"
      />

      <SaveButton
        onClick={() => {
          void handleSave();
        }}
        saved={saved}
        disabled={!hasLoaded || !hasUnsavedChanges}
        defaultLabel="保存审查规范"
        className={styles.saveButton}
      />
    </>
  );
}
