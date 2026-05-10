'use client';

import { create } from 'zustand';
import { api } from '../api';
import { useAuthStore } from './auth-store';

export interface HitlApproval {
  id: string;
  agentId: string;
  hitlLevel: string;
  actionType: string;
  payloadPreview: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

interface HitlState {
  pendingApprovals: HitlApproval[];
  isLoading: boolean;
  error: string | null;
  fetchPending: () => Promise<void>;
  approve: (id: string, note?: string) => Promise<void>;
  reject: (id: string, note?: string) => Promise<void>;
}

export const useHitlStore = create<HitlState>((set, _get) => ({
  pendingApprovals: [],
  isLoading: false,
  error: null,
  
  fetchPending: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await api.hitl.pending(token);
      set({ pendingApprovals: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  approve: async (id: string, note = 'Approved by Operator') => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    try {
      await api.hitl.approve(id, note, token);
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter(a => a.id !== id)
      }));
    } catch (error: any) {
      console.error('Failed to approve HITL', error);
      throw error;
    }
  },

  reject: async (id: string, note = 'Rejected by Operator') => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    try {
      await api.hitl.reject(id, note, token);
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter(a => a.id !== id)
      }));
    } catch (error: any) {
      console.error('Failed to reject HITL', error);
      throw error;
    }
  }
}));
