"use client";

import { create } from "zustand";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  operatorEmail: string | null;
  organizationId: string | null;
  isAuthenticated: boolean;
  setAuth: (
    token: string,
    refreshToken: string,
    email: string,
    organizationId?: string,
  ) => void;
  updateToken: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token:
    typeof window !== "undefined"
      ? localStorage.getItem("hefesto_token")
      : null,
  refreshToken:
    typeof window !== "undefined"
      ? localStorage.getItem("hefesto_refresh_token")
      : null,
  operatorEmail:
    typeof window !== "undefined"
      ? localStorage.getItem("hefesto_email")
      : null,
  organizationId:
    typeof window !== "undefined"
      ? localStorage.getItem("hefesto_org_id")
      : null,
  isAuthenticated:
    typeof window !== "undefined"
      ? !!localStorage.getItem("hefesto_token")
      : false,

  setAuth: (
    token: string,
    refreshToken: string,
    email: string,
    organizationId?: string,
  ) => {
    localStorage.setItem("hefesto_token", token);
    localStorage.setItem("hefesto_refresh_token", refreshToken);
    localStorage.setItem("hefesto_email", email);
    if (organizationId) localStorage.setItem("hefesto_org_id", organizationId);
    set({
      token,
      refreshToken,
      operatorEmail: email,
      organizationId: organizationId ?? null,
      isAuthenticated: true,
    });
  },

  updateToken: (token: string, refreshToken: string) => {
    localStorage.setItem("hefesto_token", token);
    localStorage.setItem("hefesto_refresh_token", refreshToken);
    set({ token, refreshToken });
  },

  logout: () => {
    localStorage.removeItem("hefesto_token");
    localStorage.removeItem("hefesto_refresh_token");
    localStorage.removeItem("hefesto_email");
    localStorage.removeItem("hefesto_org_id");
    set({
      token: null,
      refreshToken: null,
      operatorEmail: null,
      organizationId: null,
      isAuthenticated: false,
    });
  },
}));
