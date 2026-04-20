import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAISettings, saveAISettings } from '../../store/ai';
import { Field, Divider, Select, SaveButton, SettingsPageHeader } from '../../ui';
import type { SelectOption } from '../../ui';
import { DEFAULT_JIMENG_MODEL, type ImageProvider, type LLMProvider } from '../../types/ai';
import { ProviderListSection } from './ProviderListSection';
import { ImageProviderListSection } from './ImageProviderListSection';
import {
  createAIConfigSnapshot,
  hasUnsavedAIConfigChanges,
  normalizeProviderDrafts,
  normalizeProviderSelection,
} from './ai-config-utils';
import { useSettingsTabGuard } from './useSettingsTabGuard';
import styles from './SettingsCommon.module.css';

interface AIConfigTabProps {
  onRegisterLeaveGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

export function AIConfigTab({ onRegisterLeaveGuard }: AIConfigTabProps) {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  // 旧 jimeng* 字段（UI 已下线，仅保留原值用于向后兼容持久化）
  const [legacyJimengApiUrl, setLegacyJimengApiUrl] = useState('');
  const [legacyJimengSessionId, setLegacyJimengSessionId] = useState('');
  const [legacyJimengModel, setLegacyJimengModel] = useState(DEFAULT_JIMENG_MODEL);
  // 新：图像 Provider
  const [imageProviders, setImageProviders] = useState<ImageProvider[]>([]);
  const [defaultImageProviderId, setDefaultImageProviderId] = useState<string | null>(null);
  const [defaultImageModel, setDefaultImageModel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadAISettings().then((settings) => {
      const nextProviders = settings?.llmProviders ?? [];
      const nextJimengApiUrl = settings?.jimengApiUrl ?? '';
      const nextJimengSessionId = settings?.jimengSessionId ?? '';
      const nextJimengModel = settings?.jimengModel ?? DEFAULT_JIMENG_MODEL;
      const nextImageProviders = settings?.imageProviders ?? [];
      const nextDefaultImageProviderId = settings?.defaultImageProviderId ?? null;
      const nextDefaultImageModel = settings?.defaultImageModel ?? null;
      const selection = normalizeProviderSelection(
        nextProviders,
        settings?.defaultProviderId ?? null,
        settings?.defaultModel ?? null,
      );

      setProviders(nextProviders);
      setDefaultProviderId(selection.defaultProviderId);
      setDefaultModel(selection.defaultModel);
      setLegacyJimengApiUrl(nextJimengApiUrl);
      setLegacyJimengSessionId(nextJimengSessionId);
      setLegacyJimengModel(nextJimengModel);
      setImageProviders(nextImageProviders);
      setDefaultImageProviderId(nextDefaultImageProviderId);
      setDefaultImageModel(nextDefaultImageModel);
      setLastSavedSnapshot(
        createAIConfigSnapshot({
          providers: nextProviders,
          defaultProviderId: selection.defaultProviderId,
          defaultModel: selection.defaultModel,
          jimengApiUrl: nextJimengApiUrl,
          jimengSessionId: nextJimengSessionId,
          jimengModel: nextJimengModel,
          imageProviders: nextImageProviders,
          defaultImageProviderId: nextDefaultImageProviderId,
          defaultImageModel: nextDefaultImageModel,
        }),
      );
      setHasLoaded(true);
    });
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
    () =>
      createAIConfigSnapshot({
        providers,
        defaultProviderId,
        defaultModel,
        jimengApiUrl: legacyJimengApiUrl,
        jimengSessionId: legacyJimengSessionId,
        jimengModel: legacyJimengModel,
        imageProviders,
        defaultImageProviderId,
        defaultImageModel,
      }),
    [
      providers,
      defaultProviderId,
      defaultModel,
      legacyJimengApiUrl,
      legacyJimengSessionId,
      legacyJimengModel,
      imageProviders,
      defaultImageProviderId,
      defaultImageModel,
    ],
  );

  const hasUnsavedChanges =
    hasLoaded && hasUnsavedAIConfigChanges(lastSavedSnapshot, currentSnapshot);

  useEffect(() => {
    if (hasUnsavedChanges && saved) {
      setSaved(false);
    }
  }, [hasUnsavedChanges, saved]);

  const handleSave = useCallback(async () => {
    const normalizedProviders = normalizeProviderDrafts(providers);
    const selection = normalizeProviderSelection(
      normalizedProviders,
      defaultProviderId,
      defaultModel,
    );
    const snapshot = createAIConfigSnapshot({
      providers: normalizedProviders,
      defaultProviderId: selection.defaultProviderId,
      defaultModel: selection.defaultModel,
      jimengApiUrl: legacyJimengApiUrl,
      jimengSessionId: legacyJimengSessionId,
      jimengModel: legacyJimengModel,
      imageProviders,
      defaultImageProviderId,
      defaultImageModel,
    });

    try {
      const current = await loadAISettings();
      await saveAISettings({
        ...(current ?? {
          minimaxApiKey: '',
          minimaxVoiceId: 'male-qn-qingse',
          minimaxSpeed: 1.0,
          imageProviders: [],
          defaultImageProviderId: null,
          defaultImageModel: null,
          promptBindings: {},
        }),
        llmProviders: normalizedProviders,
        defaultProviderId: selection.defaultProviderId,
        defaultModel: selection.defaultModel,
        llmBaseUrl:
          normalizedProviders.find((p) => p.id === selection.defaultProviderId)?.baseUrl ??
          current?.llmBaseUrl ??
          '',
        llmApiKey:
          normalizedProviders.find((p) => p.id === selection.defaultProviderId)?.apiKey ??
          current?.llmApiKey ??
          '',
        llmModel: selection.defaultModel ?? current?.llmModel ?? '',
        jimengApiUrl: legacyJimengApiUrl,
        jimengSessionId: legacyJimengSessionId,
        jimengModel: legacyJimengModel,
        imageProviders,
        defaultImageProviderId,
        defaultImageModel,
      });

      setProviders(normalizedProviders);
      setDefaultProviderId(selection.defaultProviderId);
      setDefaultModel(selection.defaultModel);
      setLastSavedSnapshot(snapshot);
      setSaved(true);
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
      saveFeedbackTimerRef.current = setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? `保存配置失败：${error.message}` : '保存配置失败，请稍后重试。');
      return false;
    }
  }, [
    providers,
    defaultProviderId,
    defaultModel,
    legacyJimengApiUrl,
    legacyJimengSessionId,
    legacyJimengModel,
    imageProviders,
    defaultImageProviderId,
    defaultImageModel,
  ]);

  useSettingsTabGuard({
    title: 'AI 基础配置',
    hasUnsavedChanges,
    onSave: handleSave,
    onRegisterLeaveGuard,
  });

  const currentDefaultImageProvider = useMemo(
    () => imageProviders.find((p) => p.id === defaultImageProviderId) ?? null,
    [imageProviders, defaultImageProviderId],
  );

  const imageProviderOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '未选择' },
      ...imageProviders.map((p) => ({ value: p.id, label: p.name || '未命名 Provider' })),
    ],
    [imageProviders],
  );

  const imageModelOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '未选择' },
      ...(currentDefaultImageProvider?.models ?? []).map((m) => ({ value: m, label: m })),
    ],
    [currentDefaultImageProvider],
  );

  const handleImageProvidersChange = useCallback(
    (nextProviders: ImageProvider[], nextDefaultId: string | null) => {
      setImageProviders(nextProviders);
      setDefaultImageProviderId(nextDefaultId);
      // 当默认 Provider 变化或当前模型不在新 Provider 中时，自动选首个模型（没有则置空）
      const nextProvider = nextProviders.find((p) => p.id === nextDefaultId) ?? null;
      setDefaultImageModel((prev) => {
        if (!nextProvider) return null;
        if (prev && nextProvider.models.includes(prev)) return prev;
        return nextProvider.models[0] ?? null;
      });
    },
    [],
  );

  const handleDefaultImageProviderChange = useCallback(
    (nextId: string | null) => {
      setDefaultImageProviderId(nextId);
      const nextProvider = imageProviders.find((p) => p.id === nextId) ?? null;
      setDefaultImageModel(nextProvider?.models[0] ?? null);
    },
    [imageProviders],
  );

  return (
    <>
      <SettingsPageHeader
        title="AI 基础配置"
        description="配置 OpenAI 兼容接口与封面图像生成服务"
      />

      <div className={styles.formStack}>
        {/* Provider 列表 */}
        <Field label="LLM Providers">
          <ProviderListSection
            providers={providers}
            defaultProviderId={defaultProviderId}
            onChange={(p, id) => {
              const selection = normalizeProviderSelection(p, id, defaultModel);
              setProviders(p);
              setDefaultProviderId(selection.defaultProviderId);
              setDefaultModel(selection.defaultModel);
            }}
          />
        </Field>

        <Divider label="封面图像生成" />

        <Field label="Image Providers">
          <ImageProviderListSection
            imageProviders={imageProviders}
            defaultImageProviderId={defaultImageProviderId}
            onChange={handleImageProvidersChange}
          />
        </Field>

        <Field label="默认 Image Provider">
          <Select
            value={defaultImageProviderId ?? ''}
            options={imageProviderOptions}
            onChange={(e) => handleDefaultImageProviderChange(e.target.value || null)}
          />
        </Field>

        <Field label="默认模型">
          <Select
            value={defaultImageModel ?? ''}
            options={imageModelOptions}
            onChange={(e) => setDefaultImageModel(e.target.value || null)}
            disabled={!currentDefaultImageProvider}
          />
        </Field>
      </div>

      <SaveButton
        onClick={() => {
          void handleSave();
        }}
        saved={saved}
        disabled={!hasLoaded || !hasUnsavedChanges}
        defaultLabel="保存配置"
        className={styles.saveButton}
      />
    </>
  );
}
