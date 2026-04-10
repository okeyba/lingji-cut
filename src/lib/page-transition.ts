import type { AppPage } from './electron-api';

export type PageTransitionReason = 'default' | 'close-project';

interface ResolvePageTransitionOptions {
  fromPage: AppPage;
  toPage: AppPage;
  reason: PageTransitionReason;
  reducedMotion: boolean;
}

interface MotionState {
  opacity: number;
  y: number;
}

export interface PageTransitionConfig {
  enabled: boolean;
  contentKey: string;
  initial: MotionState;
  animate: MotionState;
  exit: MotionState;
  transition: {
    duration: number;
    ease: [number, number, number, number];
  };
}

const STATIC_STATE: MotionState = { opacity: 1, y: 0 };
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function resolvePageTransition({
  fromPage,
  toPage,
  reason,
  reducedMotion,
}: ResolvePageTransitionOptions): PageTransitionConfig {
  const shouldAnimate =
    !reducedMotion &&
    reason === 'close-project' &&
    toPage === 'welcome' &&
    fromPage !== 'welcome';

  if (!shouldAnimate) {
    return {
      enabled: false,
      contentKey: 'static-content',
      initial: STATIC_STATE,
      animate: STATIC_STATE,
      exit: STATIC_STATE,
      transition: {
        duration: 0,
        ease: EASE_OUT_EXPO,
      },
    };
  }

  return {
    enabled: true,
    contentKey: `close-project:${fromPage}->${toPage}`,
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: {
      duration: 0.18,
      ease: EASE_OUT_EXPO,
    },
  };
}
