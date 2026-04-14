import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { PanelHeader } from '../../ui';
import { springs, durations, easings } from '../../ui/lib/motion';

interface SideDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 通用侧边抽屉，替代旧 StepDrawer。
 */
export function SideDrawer({ open, title, onClose, children }: SideDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
    <m.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: springs.smooth }}
      exit={{
        x: '100%',
        opacity: 0,
        transition: { duration: durations.base, ease: easings.easeOutExpo },
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--color-border-subtle)',
        background: 'var(--color-panel-bg)',
        zIndex: 3,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <PanelHeader
          title={title}
          actions={
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          }
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{children}</div>
    </m.aside>
      )}
    </AnimatePresence>
  );
}
