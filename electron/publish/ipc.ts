import { ipcMain, app } from 'electron';
import { join } from 'node:path';
import { AccountStore } from './accounts';
import { getPlatform } from './platforms';
import { parseAccountId } from './account-id';
import { runPublishJob } from './runner';
import { getBiliupStatus, downloadBiliup } from './biliup-install';
import { getChromiumStatus, downloadChromium } from './chromium-install';
import type { PublishJob, PublishPlatform, PublishSettings } from './types';

let store: AccountStore | null = null;
function getStore(): AccountStore {
  if (!store) store = new AccountStore(join(app.getPath('userData'), 'publish'));
  return store;
}

// ─── Cancel flag (module-level, simple single-job semantics) ──────────────────
let cancelled = false;

export function registerPublishIpc(): void {
  ipcMain.handle('publish:list-accounts', () => getStore().list());
  ipcMain.handle('publish:delete-account', (_e, id: string) => {
    getStore().remove(id);
  });
  ipcMain.handle(
    'publish:login',
    async (e, platform: PublishPlatform, accountName: string, headless?: boolean) => {
      const s = getStore();
      const sp = s.storageStatePath(platform, accountName);
      const res = await getPlatform(platform).login({
        storageStatePath: sp,
        headless: headless ?? s.getSettings().headlessLogin,
        onQrcode: (png) => e.sender.send('publish:qrcode', { platform, accountName, png }),
      });
      if (res.success) s.upsert({ platform, accountName, status: 'valid' });
      return res;
    },
  );
  ipcMain.handle('publish:get-settings', () => getStore().getSettings());
  ipcMain.handle('publish:set-settings', (_e, patch: Partial<PublishSettings>) =>
    getStore().setSettings(patch),
  );
  ipcMain.handle('publish:check', async (_e, id: string) => {
    const s = getStore();
    const { platform } = parseAccountId(id);
    const acc = s.list().find((a) => a.id === id);
    if (!acc) return false;
    const ok = await getPlatform(platform).checkCookie(acc.storageStatePath);
    s.setStatus(id, ok ? 'valid' : 'expired', Date.now());
    return ok;
  });

  // ─── publish:run ────────────────────────────────────────────────────────────
  ipcMain.handle('publish:run', async (e, job: PublishJob, headless = true) => {
    cancelled = false;
    try {
      await runPublishJob(job, getStore(), e.sender, () => cancelled, headless);
    } catch (err) {
      throw err;
    }
  });

  // ─── publish:cancel ─────────────────────────────────────────────────────────
  ipcMain.handle('publish:cancel', () => {
    cancelled = true;
  });

  // ─── biliup 运行时按需下载（B 站） ────────────────────────────────────────────
  ipcMain.handle('publish:biliup-status', () => getBiliupStatus());

  let downloading = false;
  ipcMain.handle('publish:download-biliup', async (e) => {
    if (downloading) {
      return { success: false, error: '正在下载中，请稍候' };
    }
    downloading = true;
    try {
      return await downloadBiliup((p) => {
        e.sender.send('publish:biliup-download-progress', p);
      });
    } finally {
      downloading = false;
    }
  });

  // ─── Chromium 运行时按需下载（抖音/视频号/小红书/快手自动化所需） ───────────────
  ipcMain.handle('publish:chromium-status', () => getChromiumStatus());

  let chromiumAbort: AbortController | null = null;
  ipcMain.handle('publish:download-chromium', async (e) => {
    if (chromiumAbort) {
      return { success: false, error: '正在下载中，请稍候' };
    }
    chromiumAbort = new AbortController();
    try {
      return await downloadChromium(
        (p) => e.sender.send('publish:chromium-download-progress', p),
        chromiumAbort.signal,
      );
    } finally {
      chromiumAbort = null;
    }
  });
  ipcMain.handle('publish:cancel-chromium-download', () => {
    chromiumAbort?.abort();
  });
}
