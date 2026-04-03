import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AISettings } from '../types/ai';

interface AISettingsModalProps {
  visible: boolean;
  settings: AISettings | null;
  onClose: () => void;
  onSave: (settings: AISettings) => void;
}

interface SettingsFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}

export function AISettingsModal({
  visible,
  settings,
  onClose,
  onSave,
}: AISettingsModalProps) {
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [jimengApiUrl, setJimengApiUrl] = useState('');
  const [jimengSessionId, setJimengSessionId] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setLlmBaseUrl(settings?.llmBaseUrl ?? 'https://api.openai.com/v1');
    setLlmApiKey(settings?.llmApiKey ?? '');
    setLlmModel(settings?.llmModel ?? 'gpt-4o');
    setJimengApiUrl(settings?.jimengApiUrl ?? 'http://47.109.159.194:8330');
    setJimengSessionId(settings?.jimengSessionId ?? '');
  }, [settings, visible]);

  if (!visible) {
    return null;
  }

  const canSave = Boolean(llmBaseUrl.trim() && llmApiKey.trim());

  const modalContent = (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={eyebrowStyle}>SETTINGS</div>
        <h3 style={titleStyle}>AI 配置</h3>

        <div style={formStyle}>
          <SettingsField
            label="LLM API Base URL"
            value={llmBaseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={setLlmBaseUrl}
          />
          <SettingsField
            label="LLM API Key"
            value={llmApiKey}
            placeholder="sk-..."
            onChange={setLlmApiKey}
            type="password"
          />
          <SettingsField
            label="模型名称"
            value={llmModel}
            placeholder="gpt-4o"
            onChange={setLlmModel}
          />

          <div style={dividerBlockStyle}>
            <div style={sectionEyebrowStyle}>封面生成（即梦）</div>
          </div>

          <SettingsField
            label="即梦 API URL"
            value={jimengApiUrl}
            placeholder="http://47.109.159.194:8330"
            onChange={setJimengApiUrl}
          />
          <SettingsField
            label="即梦 Session ID"
            value={jimengSessionId}
            placeholder="session id"
            onChange={setJimengSessionId}
            type="password"
          />
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canSave) {
                return;
              }

              onSave({
                llmBaseUrl,
                llmApiKey,
                llmModel,
                jimengApiUrl,
                jimengSessionId,
              });
              onClose();
            }}
            disabled={!canSave}
            style={{
              ...primaryButtonStyle,
              opacity: canSave ? 1 : 0.55,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

function SettingsField({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: SettingsFieldProps) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={fieldInputStyle}
      />
    </div>
  );
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.68)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 120,
  padding: 20,
};

const modalStyle = {
  width: 520,
  maxWidth: '100%',
  maxHeight: '80vh',
  overflowY: 'auto' as const,
  borderRadius: 26,
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#0b1220',
  padding: 28,
  boxSizing: 'border-box' as const,
};

const eyebrowStyle = {
  fontSize: 12,
  letterSpacing: '0.16em',
  color: '#91a2bc',
};

const titleStyle = {
  margin: '10px 0 20px',
  fontSize: 24,
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
};

const dividerBlockStyle = {
  borderTop: '1px solid rgba(255,255,255,0.06)',
  paddingTop: 16,
  marginTop: 4,
};

const sectionEyebrowStyle = {
  fontSize: 12,
  letterSpacing: '0.12em',
  color: '#91a2bc',
};

const fieldLabelStyle = {
  fontSize: 12,
  color: '#91a2bc',
  marginBottom: 6,
};

const fieldInputStyle = {
  width: '100%',
  height: 42,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  color: '#f5f7fb',
  fontSize: 13,
  boxSizing: 'border-box' as const,
  outline: 'none',
};

const actionsStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 24,
};

const secondaryButtonStyle = {
  height: 44,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f7fb',
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  height: 44,
  padding: '0 20px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 800,
};
