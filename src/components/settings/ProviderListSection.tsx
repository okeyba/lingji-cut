import { useState } from 'react';
import type { LLMProvider } from '../../types/ai';

/** 生成唯一 ID */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const PROVIDER_TYPE_OPTIONS = [
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
] as const;

/** 空白 Provider 表单 */
function emptyProvider(): LLMProvider {
  return {
    id: genId(),
    name: '',
    type: 'openai_compatible',
    baseUrl: '',
    apiKey: '',
    models: [],
  };
}

// ─── 子组件：Provider 编辑弹窗 ────────────────────────────────────────────

interface DialogProps {
  initial: LLMProvider;
  isDefault: boolean;
  onSave: (p: LLMProvider, isDefault: boolean) => void;
  onCancel: () => void;
}

function ProviderDialog({ initial, isDefault, onSave, onCancel }: DialogProps) {
  const [form, setForm] = useState<LLMProvider>({ ...initial });
  const [setAsDefault, setSetAsDefault] = useState(isDefault);
  const [newModel, setNewModel] = useState('');

  const set = <K extends keyof LLMProvider>(key: K, value: LLMProvider[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addModel = () => {
    const m = newModel.trim();
    if (m && !form.models.includes(m)) {
      set('models', [...form.models, m]);
    }
    setNewModel('');
  };

  const removeModel = (idx: number) =>
    set(
      'models',
      form.models.filter((_, i) => i !== idx),
    );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: '#1c1c1e',
          borderRadius: 12,
          padding: '24px 28px',
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
          {initial.name ? '编辑 Provider' : '添加 Provider'}
        </h3>

        {/* 名称 */}
        <label style={labelStyle}>
          <span>名称</span>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="例如：本地 Ollama"
          />
        </label>

        {/* 类型 */}
        <label style={labelStyle}>
          <span>类型</span>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.type}
            onChange={(e) => set('type', e.target.value as LLMProvider['type'])}
          >
            {PROVIDER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {/* Base URL */}
        <label style={labelStyle}>
          <span>Base URL</span>
          <input
            style={inputStyle}
            value={form.baseUrl}
            onChange={(e) => set('baseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        {/* API Key */}
        <label style={labelStyle}>
          <span>API Key</span>
          <input
            type="password"
            style={inputStyle}
            value={form.apiKey}
            onChange={(e) => set('apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </label>

        {/* 模型列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#ebebf5cc' }}>模型列表</span>
          {form.models.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.models.map((m, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
                  }}
                >
                  {m}
                  <button
                    type="button"
                    onClick={() => removeModel(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff453a',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addModel();
                }
              }}
              placeholder="输入模型名后按 Enter 或点击添加"
            />
            <button type="button" onClick={addModel} style={secondaryBtnStyle}>
              添加
            </button>
          </div>
        </div>

        {/* 设为默认 */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={setAsDefault}
            onChange={(e) => setSetAsDefault(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: '#0a84ff' }}
          />
          设为默认 Provider
        </label>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(form, setAsDefault)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#0a84ff',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

interface Props {
  providers: LLMProvider[];
  defaultProviderId: string | null;
  onChange: (providers: LLMProvider[], defaultId: string | null) => void;
}

export function ProviderListSection({ providers, defaultProviderId, onChange }: Props) {
  const [editTarget, setEditTarget] = useState<LLMProvider | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = (updated: LLMProvider, setAsDefault: boolean) => {
    let next: LLMProvider[];
    if (isAdding) {
      next = [...providers, updated];
    } else {
      next = providers.map((p) => (p.id === updated.id ? updated : p));
    }
    const newDefaultId = setAsDefault ? updated.id : (defaultProviderId ?? null);
    onChange(next, newDefaultId);
    setEditTarget(null);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    const newDefaultId =
      defaultProviderId === id ? (next[0]?.id ?? null) : (defaultProviderId ?? null);
    onChange(next, newDefaultId);
  };

  const openAdd = () => {
    setEditTarget(emptyProvider());
    setIsAdding(true);
  };

  const openEdit = (p: LLMProvider) => {
    setEditTarget({ ...p });
    setIsAdding(false);
  };

  const closeDialog = () => {
    setEditTarget(null);
    setIsAdding(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {providers.length === 0 && (
        <p style={{ fontSize: 13, color: '#ebebf5cc', margin: 0 }}>
          暂无 Provider，点击下方按钮添加
        </p>
      )}

      {providers.map((p) => (
        <div
          key={p.id}
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* 头部：名称 + 默认徽章 + 操作按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>{p.name}</span>
            {p.id === defaultProviderId && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#0a84ff22',
                  color: '#0a84ff',
                  borderRadius: 6,
                  padding: '2px 8px',
                }}
              >
                默认
              </span>
            )}
            <button type="button" onClick={() => openEdit(p)} style={cardActionBtnStyle}>
              编辑
            </button>
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              style={{ ...cardActionBtnStyle, color: '#ff453a' }}
            >
              删除
            </button>
          </div>

          {/* Base URL */}
          {p.baseUrl && (
            <span style={{ fontSize: 12, color: '#ebebf5cc' }}>
              {p.baseUrl}
            </span>
          )}

          {/* 模型列表 */}
          {p.models.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {p.models.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: 11,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    padding: '2px 7px',
                    color: '#ebebf5cc',
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 添加按钮 */}
      <button type="button" onClick={openAdd} style={addBtnStyle}>
        + 添加 Provider
      </button>

      {/* 弹窗 */}
      {editTarget && (
        <ProviderDialog
          initial={editTarget}
          isDefault={isAdding ? false : editTarget.id === defaultProviderId}
          onSave={handleSave}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

// ─── 样式常量 ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#ebebf5cc',
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: '#ebebf5cc',
  fontSize: 13,
  cursor: 'pointer',
};

const cardActionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#ebebf5cc',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 8px',
};

const addBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: 'rgba(255,255,255,0.06)',
  border: '1px dashed rgba(255,255,255,0.2)',
  borderRadius: 8,
  color: '#ebebf5cc',
  fontSize: 13,
  padding: '8px 16px',
  cursor: 'pointer',
  marginTop: 4,
};
