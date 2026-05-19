"use client";

import { create } from "zustand";
import { api } from "../api";
import { useAuthStore } from "./auth-store";

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details?: {
    family?: string;
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface OllamaStatus {
  reachable: boolean;
  gpuAvailable: boolean;
  gpuName?: string;
  vramTotal?: number;
  vramFree?: number;
  version?: string;
}

export interface PullProgress {
  modelName: string;
  status: "queued" | "downloading" | "verifying" | "done" | "error";
  total?: number;
  completed?: number;
  percent?: number;
  error?: string;
}

interface OllamaState {
  status: OllamaStatus | null;
  models: OllamaModel[];
  pullProgress: PullProgress | null;
  isLoadingStatus: boolean;
  isLoadingModels: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchModels: () => Promise<void>;
  pullModel: (name: string) => void; // SSE — no await
  deleteModel: (name: string) => Promise<void>;
  clearPull: () => void;
}

export const useOllamaStore = create<OllamaState>((set, _get) => ({
  status: null,
  models: [],
  pullProgress: null,
  isLoadingStatus: false,
  isLoadingModels: false,
  error: null,

  fetchStatus: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoadingStatus: true, error: null });
    try {
      const res = await api.ollama.status(token);
      set({ status: res.data, isLoadingStatus: false });
    } catch (err: any) {
      set({
        status: { reachable: false, gpuAvailable: false },
        error: err.message,
        isLoadingStatus: false,
      });
    }
  },

  fetchModels: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoadingModels: true, error: null });
    try {
      const res = await api.ollama.models(token);
      set({ models: res.data ?? [], isLoadingModels: false });
    } catch (err: any) {
      set({ error: err.message, isLoadingModels: false });
    }
  },

  /**
   * Pull model via SSE stream from /api/v1/settings/ollama/pull.
   * Parses NDJSON progress events emitted by OllamaProxyService.
   */
  pullModel: (name: string) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({
      pullProgress: { modelName: name, status: "queued" },
      error: null,
    });

    const url = `/api/v1/settings/ollama/pull?model=${encodeURIComponent(name)}`;
    const source = new EventSource(url);

    // Attach auth via URL param since EventSource doesn't support headers
    // The route reads token from query ?token=... as a fallback
    const authUrl = `${url}&token=${encodeURIComponent(token)}`;
    const es = new EventSource(authUrl);

    es.onmessage = (event) => {
      try {
        const chunk = JSON.parse(event.data) as {
          status?: string;
          total?: number;
          completed?: number;
          error?: string;
        };

        const total = chunk.total ?? 0;
        const completed = chunk.completed ?? 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const status: PullProgress["status"] =
          chunk.error
            ? "error"
            : chunk.status === "success"
            ? "done"
            : chunk.status?.includes("verif")
            ? "verifying"
            : "downloading";

        set({
          pullProgress: {
            modelName: name,
            status,
            total,
            completed,
            percent,
            error: chunk.error,
          },
        });

        if (status === "done" || status === "error") {
          es.close();
          // Refresh model list after successful pull
          if (status === "done") {
            _get().fetchModels();
          }
        }
      } catch {
        // malformed JSON — ignore
      }
    };

    es.onerror = () => {
      set((state) => ({
        pullProgress: state.pullProgress
          ? { ...state.pullProgress, status: "error", error: "Stream lost" }
          : null,
      }));
      es.close();
    };

    // Clean up the unused first source
    source.close();
  },

  deleteModel: async (name: string) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    await api.ollama.delete(name, token);
    set((state) => ({
      models: state.models.filter((m) => m.name !== name),
    }));
  },

  clearPull: () => set({ pullProgress: null }),
}));
