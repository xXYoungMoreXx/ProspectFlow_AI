"use client";

import { create } from "zustand";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  operatorEmail: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, refreshToken: string, email: string) => void;
  updateToken: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:
    typeof window !== "undefined"
      ? localStorage.getItem("agentepro_token")
      : null,
  refreshToken:
    typeof window !== "undefined"
      ? localStorage.getItem("agentepro_refresh_token")
      : null,
  operatorEmail:
    typeof window !== "undefined"
      ? localStorage.getItem("agentepro_email")
      : null,
  isAuthenticated:
    typeof window !== "undefined"
      ? !!localStorage.getItem("agentepro_token")
      : false,

  setAuth: (token: string, refreshToken: string, email: string) => {
    localStorage.setItem("agentepro_token", token);
    localStorage.setItem("agentepro_refresh_token", refreshToken);
    localStorage.setItem("agentepro_email", email);
    set({ token, refreshToken, operatorEmail: email, isAuthenticated: true });
  },

  updateToken: (token: string, refreshToken: string) => {
    localStorage.setItem("agentepro_token", token);
    localStorage.setItem("agentepro_refresh_token", refreshToken);
    set({ token, refreshToken });
  },

  logout: () => {
    localStorage.removeItem("agentepro_token");
    localStorage.removeItem("agentepro_refresh_token");
    localStorage.removeItem("agentepro_email");
    set({
      token: null,
      refreshToken: null,
      operatorEmail: null,
      isAuthenticated: false,
    });
  },
}));
