'use client';

import { create } from 'zustand';

interface AuthState {
  token: string | null;
  operatorEmail: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('agentepro_token') : null,
  operatorEmail: typeof window !== 'undefined' ? localStorage.getItem('agentepro_email') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('agentepro_token') : false,

  setAuth: (token: string, email: string) => {
    localStorage.setItem('agentepro_token', token);
    localStorage.setItem('agentepro_email', email);
    set({ token, operatorEmail: email, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('agentepro_token');
    localStorage.removeItem('agentepro_email');
    set({ token: null, operatorEmail: null, isAuthenticated: false });
  },
}));
