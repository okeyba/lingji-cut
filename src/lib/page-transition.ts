import type { AppPage } from './electron-api';
import type { TargetAndTransition, Transition } from 'framer-motion';

export type PageTransitionReason = 'default' | 'close-project';

interface ResolvePageTransitionOptions {
  fromPage: AppPage;
  toPage: AppPage;
  reason: PageTransitionReason;
  reducedMotion: boolean;
}

export interface PageTransitionConfig {
  enabled: boolean;
  contentKey: string;
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

const STATIC_STATE: TargetAndTransition = { opacity: 1, y: 0 };
// Apple easeOutExpo
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Apple default(稍快)
const EASE_APPLE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

/**
 * 页面过渡配置 — macOS 风格:
 * - 编辑器/脚本工作台之间切换不走这里,由 WorkspaceTabs + CSS display 切换(零振荡)
 * - 所有进入 welcome/setup 的路径:淡出回 welcome 用 y:8 柔和落下
 * - 所有进入 settings 的路径:淡入 + 轻微 y 偏移(侧栏感)
 * - 默认:普通 crossfade(短促淡入淡出)
 */
export function resolvePageTransition({
  fromPage,
  toPage,
  reason,
  reducedMotion,
}: ResolvePageTransitionOptions): PageTransitionConfig {
  if (reducedMotion) {
    return {
      enabled: false,
      contentKey: 'static-content',
      initial: STATIC_STATE,
      animate: STATIC_STATE,
      exit: STATIC_STATE,
      transition: { duration: 0, ease: EASE_APPLE },
    };
  }

  // close-project 回 welcome:强调柔和落下
  if (reason === 'close-project' && toPage === 'welcome') {
    return {
      enabled: true,
      contentKey: `close-project:${fromPage}->${toPage}`,
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 10 },
      transition: { duration: 0.26, ease: EASE_OUT_EXPO },
    };
  }

  // 进入 settings 页:模拟 sheet 从顶滑入感(轻微)
  if (toPage === 'settings') {
    return {
      enabled: true,
      contentKey: `to-settings:${fromPage}`,
      initial: { opacity: 0, y: -6 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -4 },
      transition: { duration: 0.22, ease: EASE_APPLE },
    };
  }

  // 默认 crossfade(所有其余页面切换)
  return {
    enabled: true,
    contentKey: `crossfade:${fromPage}->${toPage}`,
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18, ease: EASE_APPLE },
  };
}
