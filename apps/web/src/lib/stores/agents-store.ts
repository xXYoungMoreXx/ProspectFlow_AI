"use client";

import { create } from "zustand";
import { api } from "../api";
import { useAuthStore } from "./auth-store";

interface Agent {
  id: string;
  name: string;
  persona: string;
  status: "ACTIVE" | "INACTIVE" | "PAUSED";
  tokenBudgetRemaining: number;
}

interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  updateAgentStatus: (id: string, status: Agent["status"]) => void;
}

export const useAgentsStore = create<AgentsState>((set, _get) => ({
  agents: [],
  isLoading: false,
  error: null,
  fetchAgents: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await api.agents.list(token);
      set({ agents: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  updateAgentStatus: (id, status) => {
    // Optimistic update
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, status } : agent,
      ),
    }));
  },
}));
