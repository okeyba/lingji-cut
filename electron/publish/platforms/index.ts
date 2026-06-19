import type { PlatformModule, PublishPlatform } from '../types';
import { douyin } from './douyin';

export const PLATFORMS: Partial<Record<PublishPlatform, PlatformModule>> = { douyin };

export function getPlatform(p: PublishPlatform): PlatformModule {
  const mod = PLATFORMS[p];
  if (!mod) throw new Error(`平台未实现: ${p}`);
  return mod;
}
