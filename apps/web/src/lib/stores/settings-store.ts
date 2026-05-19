"use client";

import { create } from "zustand";
import { api } from "../api";
import { useAuthStore } from "./auth-store";

export type SettingCategory =
  | "llm"
  | "messaging"
  | "integrations"
  | "system"
  | "ollama";

export interface SettingEntry {
  key: string;
  category: SettingCategory;
  value: string;
  isSecret: boolean;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}

export interface PendingUpdate {
  key: string;
  category: SettingCategory;
  value: string;
  isSecret: boolean;
}

interface ConnectionStatus {
  category: string;
  status: "idle" | "testing" | "ok" | "error";
  message?: string;
}

interface SettingsState {
  settings: SettingEntry[];
  pending: Map<string, PendingUpdate>;
  connections: Record<string, ConnectionStatus>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  setPending: (update: PendingUpdate) => void;
  clearPending: () => void;
  saveSettings: () => Promise<void>;
  deleteSetting: (key: string) => Promise<void>;
  testConnection: (category: string) => Promise<void>;

  // Selectors
  getByCategory: (category: SettingCategory) => SettingEntry[];
  getValue: (key: string) => string | undefined;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: [],
  pending: new Map(),
  connections: {},
  isLoading: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await api.settings.list(token);
      set({ settings: res.data ?? [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setPending: (update) => {
    set((state) => {
      const next = new Map(state.pending);
      next.set(update.key, update);
      return { pending: next };
    });
  },

  clearPending: () => set({ pending: new Map() }),

  saveSettings: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    const { pending } = get();
    if (pending.size === 0) return;

    set({ isSaving: true, error: null });
    try {
      const batch = Array.from(pending.values());
      await api.settings.upsert(batch, token);
      // Refresh from server to get masked values
      const res = await api.settings.list(token);
      set({ settings: res.data ?? [], pending: new Map(), isSaving: false });
    } catch (err: any) {
      set({ error: err.message, isSaving: false });
    }
  },

  deleteSetting: async (key) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    await api.settings.delete(key, token);
    set((state) => ({
      settings: state.settings.filter((s) => s.key !== key),
    }));
  },

  testConnection: async (category) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set((state) => ({
      connections: {
        ...state.connections,
        [category]: { category, status: "testing" },
      },
    }));

    try {
      const res = await api.settings.testConnection(category, token);
      set((state) => ({
        connections: {
          ...state.connections,
          [category]: {
            category,
            status: res.data.success ? "ok" : "error",
            message: res.data.message,
          },
        },
      }));
    } catch (err: any) {
      set((state) => ({
        connections: {
          ...state.connections,
          [category]: { category, status: "error", message: err.message },
        },
      }));
    }
  },

  getByCategory: (category) =>
    get().settings.filter((s) => s.category === category),

  getValue: (key) => get().settings.find((s) => s.key === key)?.value,
}));
