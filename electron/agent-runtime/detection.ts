/**
 * detection.ts
 *
 * Agent 探测层：检测 agent CLI 是否在 PATH / nvm/fnm/volta 中可用，并可选探测版本。
 *
 * 设计原则：
 * - 纯注入式（DetectionDeps），不直接持有 BinaryManager 实例，便于单测。
 * - createDetectionDeps(bm) 把 BinaryManager 适配成 DetectionDeps，供主进程使用。
 * - 容错：probeVersion 失败不抛，version:null。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RuntimeAgentDef } from './types.js';

const execFileAsync = promisify(execFile);

// ─── 公开接口 ────────────────────────────────────────────────────────────────

export interface AgentDetection {
  installed: boolean;
  binPath: string | null;
  version: string | null;
}

export interface DetectionDeps {
  resolveBinary: (name: string) => Promise<string | null>;
  probeVersion?: (binPath: string, versionArgs: string[]) => Promise<string | null>;
}

// ─── 核心探测函数 ─────────────────────────────────────────────────────────────

/**
 * 探测 agent CLI 是否可用。
 *
 * 查找顺序：def.bin → def.fallbackBins（依次）。
 * 命中 → installed:true, binPath 为绝对路径；
 * 全部未命中 → installed:false, binPath:null。
 * 若 installed 且 deps.probeVersion 存在，调它获取版本（失败 version:null，不抛）。
 */
export async function detectAgent(
  def: RuntimeAgentDef,
  deps: DetectionDeps,
): Promise<AgentDetection> {
  // 按优先级依次解析 bin 和 fallbackBins
  const candidates = [def.bin, ...(def.fallbackBins ?? [])];

  let binPath: string | null = null;
  for (const candidate of candidates) {
    const resolved = await deps.resolveBinary(candidate);
    if (resolved) {
      binPath = resolved;
      break;
    }
  }

  if (!binPath) {
    return { installed: false, binPath: null, version: null };
  }

  // 命中，尝试探测版本
  let version: string | null = null;
  if (deps.probeVersion) {
    try {
      version = await deps.probeVersion(binPath, def.versionArgs);
    } catch {
      // 容错：version 保持 null
    }
  }

  return { installed: true, binPath, version };
}

// ─── BinaryManager 适配器 ──────────────────────────────────────────────────

/** BinaryManager 公开方法子集（避免直接 import 完整类，降低耦合） */
export interface BinaryManagerLike {
  resolveBinary: (name: string) => Promise<string | null>;
}

/**
 * 把 BinaryManager 实例适配成 DetectionDeps。
 * probeVersion 使用 execFile 调用二进制，超时 10s，失败返回 null。
 */
export function createDetectionDeps(bm: BinaryManagerLike): DetectionDeps {
  return {
    resolveBinary: (name) => bm.resolveBinary(name),
    probeVersion: async (binPath, versionArgs) => {
      try {
        const { stdout } = await execFileAsync(binPath, versionArgs, {
          timeout: 10_000,
        });
        return stdout.trim() || null;
      } catch {
        return null;
      }
    },
  };
}
