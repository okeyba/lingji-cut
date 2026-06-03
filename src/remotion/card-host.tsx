import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import * as Remotion from 'remotion';
import { Component, useMemo, type ReactNode } from 'react';

/**
 * 评估主进程 esbuild 编译出的卡片 CJS 模块，返回其 default 导出的组件。
 * react / react/jsx-runtime / remotion 通过 require 垫片注入宿主实例，
 * 使卡片与宿主共享同一 Remotion 渲染上下文（useCurrentFrame 等可用）。
 *
 * 安全说明：这里对 AI 生成代码使用 Function 求值，需要渲染面允许 'unsafe-eval'。
 * 预览运行在应用渲染进程；导出运行在 Remotion 自带的无头 Chrome，二者均为本地可信环境。
 */
function evalCardComponent(compiledJs: string): React.ComponentType<Record<string, unknown>> | null {
  if (!compiledJs.trim()) return null;
  const requireShim = (id: string): unknown => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return JsxRuntime;
    if (id === 'remotion') return Remotion;
    throw new Error(`Motion Card 不允许引用模块：${id}`);
  };
  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('require', 'module', 'exports', compiledJs);
  factory(requireShim, moduleObj, moduleObj.exports);
  const exported = moduleObj.exports as { default?: unknown };
  return (exported.default as React.ComponentType<Record<string, unknown>>) ?? null;
}

class CardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[lingji motion-card] 渲染失败', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#101827', color: '#f6f8fb', fontSize: 20 }}>
          卡片渲染失败
        </div>
      );
    }
    return this.props.children;
  }
}

export function CardHost({ overlayId, compiledJs }: { overlayId: string; compiledJs: string }) {
  const Comp = useMemo(() => {
    try {
      return evalCardComponent(compiledJs);
    } catch (error) {
      console.error('[lingji motion-card] 编译产物求值失败', overlayId, error);
      return null;
    }
  }, [compiledJs, overlayId]);

  if (!Comp) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#101827', color: '#f6f8fb', fontSize: 20 }}>
        卡片不可用
      </div>
    );
  }

  return (
    <CardErrorBoundary>
      <Comp />
    </CardErrorBoundary>
  );
}
