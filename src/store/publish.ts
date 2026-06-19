import { create } from 'zustand';
import type { PublishAccount, PublishPlatform } from '../lib/electron-api';

interface PublishState {
  accounts: PublishAccount[];
  loadAccounts: () => Promise<void>;
  addAccount: (
    platform: PublishPlatform,
    accountName: string,
  ) => Promise<{ success: boolean; message: string }>;
  checkAccount: (id: string) => Promise<boolean>;
  removeAccount: (id: string) => Promise<void>;
}

export const usePublishStore = create<PublishState>((set, get) => ({
  accounts: [],
  loadAccounts: async () => {
    const accounts = await window.publishAPI.listAccounts();
    set({ accounts });
  },
  addAccount: async (platform, accountName) => {
    const res = await window.publishAPI.login(platform, accountName);
    await get().loadAccounts();
    return res;
  },
  checkAccount: async (id) => {
    const ok = await window.publishAPI.check(id);
    await get().loadAccounts();
    return ok;
  },
  removeAccount: async (id) => {
    await window.publishAPI.deleteAccount(id);
    await get().loadAccounts();
  },
}));
