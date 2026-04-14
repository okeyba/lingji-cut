import { describe, expect, it } from 'vitest';
import { resolvePageTransition } from '../src/lib/page-transition';

describe('resolvePageTransition', () => {
  it('enables a soft fade transition only when closing a project back to welcome', () => {
    const result = resolvePageTransition({
      fromPage: 'editor',
      toPage: 'welcome',
      reason: 'close-project',
      reducedMotion: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.contentKey).toBe('close-project:editor->welcome');
    expect(result.initial).toMatchObject({ opacity: 0, y: 8 });
    expect(result.animate).toMatchObject({ opacity: 1, y: 0 });
    expect(result.exit).toMatchObject({ opacity: 0, y: 10 });
    expect(result.transition.duration).toBeGreaterThan(0);
  });

  it('uses a sheet-from-top transition when entering the settings page', () => {
    const result = resolvePageTransition({
      fromPage: 'welcome',
      toPage: 'settings',
      reason: 'default',
      reducedMotion: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.contentKey).toBe('to-settings:welcome');
    expect(result.initial).toMatchObject({ opacity: 0, y: -6 });
    expect(result.animate).toMatchObject({ opacity: 1, y: 0 });
    expect(result.exit).toMatchObject({ opacity: 0, y: -4 });
    expect(result.transition.duration).toBeGreaterThan(0);
  });

  it('uses a crossfade for general page changes', () => {
    const result = resolvePageTransition({
      fromPage: 'editor',
      toPage: 'script-workbench',
      reason: 'default',
      reducedMotion: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.contentKey).toBe('crossfade:editor->script-workbench');
    expect(result.initial).toMatchObject({ opacity: 0 });
    expect(result.animate).toMatchObject({ opacity: 1 });
    expect(result.exit).toMatchObject({ opacity: 0 });
    expect(result.transition.duration).toBeGreaterThan(0);
  });

  it('disables the close-project transition when reduced motion is preferred', () => {
    const result = resolvePageTransition({
      fromPage: 'script-workbench',
      toPage: 'welcome',
      reason: 'close-project',
      reducedMotion: true,
    });

    expect(result.enabled).toBe(false);
    expect(result.transition.duration).toBe(0);
  });
});
