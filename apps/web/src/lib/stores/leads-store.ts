"use client";

import { create } from "zustand";
import { api } from "../api";
import { useAuthStore } from "./auth-store";

export interface Lead {
  id: string;
  contactName: string;
  contactCompany: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  assignedAgentId?: string;
}

interface LeadsState {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  fetchLeads: () => Promise<void>;
  updateLeadStatus: (id: string, status: Lead["status"]) => Promise<void>;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  isLoading: false,
  error: null,
  fetchLeads: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await api.leads.list(token);
      set({ leads: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  updateLeadStatus: async (id, status) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    // Optimistic update for Kanban DND
    const previousLeads = get().leads;
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === id ? { ...lead, status } : lead,
      ),
    }));

    try {
      await api.leads.update(id, { status }, token);
    } catch {
      // Revert on failure
      set({ leads: previousLeads, error: "Failed to update lead status" });
    }
  },
}));
