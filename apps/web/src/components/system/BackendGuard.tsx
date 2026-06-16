"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Phase = "checking" | "offline" | "setup" | "ready";

// Opt-in guard for self-hosted local installs. When NEXT_PUBLIC_APP_MODE is
// unset (cloud builds, E2E, CI) the guard is a no-op passthrough, so it never
// affects managed deployments or test environments.
const ENABLED = process.env.NEXT_PUBLIC_APP_MODE === "local";
const DEFAULT_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_EMAIL ?? "admin@agentepro.local";

async function probeBackend(): Promise<Exclude<Phase, "checking">> {
  // 1. Is the local backend reachable at all?
  try {
    const health = await fetch("/api/v1/health", { cache: "no-store" });
    if (!health.ok) return "offline";
  } catch {
    return "offline";
  }
  // 2. Backend is up — does it still need first-run setup?
  try {
    const res = await fetch("/api/v1/system/setup-status", {
      cache: "no-store",
    });
    if (!res.ok) return "ready";
    const body = (await res.json()) as { data?: { needsSetup?: boolean } };
    return body.data?.needsSetup ? "setup" : "ready";
  } catch {
    return "ready";
  }
}

export function BackendGuard({ children }: Readonly<{ children: ReactNode }>) {
  const [phase, setPhase] = useState<Phase>(ENABLED ? "checking" : "ready");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    setPhase("checking");
    const next = await probeBackend();
    if (mounted.current) setPhase(next);
  }, []);

  useEffect(() => {
    if (!ENABLED) return;
    void check();
  }, [check]);

  if (!ENABLED || phase === "ready") return <>{children}</>;
  if (phase === "checking")
    return <Centered>Conectando ao backend local…</Centered>;
  if (phase === "offline") return <BackendOffline onRetry={check} />;
  return <FirstRunSetup onDone={() => setPhase("ready")} />;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-muted-foreground">
      <p className="animate-pulse text-sm">{children}</p>
    </div>
  );
}

function BackendOffline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-card-foreground">
          Seu backend local não está rodando
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O AgentePro roda na sua máquina. Suba os serviços locais e clique em
          “Tentar de novo”.
        </p>

        <ol className="mt-5 space-y-3 text-sm">
          <li>
            <span className="text-muted-foreground">
              1. Suba a infraestrutura (Postgres, Redis):
            </span>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              docker compose -f infra/docker-compose.yml up -d
            </pre>
          </li>
          <li>
            <span className="text-muted-foreground">
              2. Inicie a API e o agent-runtime:
            </span>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              npm run dev
            </pre>
          </li>
        </ol>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={onRetry}>Tentar de novo</Button>
          <a
            href="https://github.com/xXYoungMoreXX/ProspectFlow_AI#readme"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Guia de instalação
          </a>
        </div>
      </div>
    </div>
  );
}

function FirstRunSetup({ onDone }: { onDone: () => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.localLogin(email, password);
      setAuth(res.data.accessToken, res.data.refreshToken, email);
      onDone();
    } catch {
      setError(
        "Não foi possível criar a conta. Confira se o backend está em APP_MODE=local.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-card-foreground">
          Primeira execução
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie a conta de administrador local. Ela fica só na sua máquina — sem
          e-mail, sem nuvem.
        </p>

        <label className="mt-6 block text-sm font-medium text-card-foreground">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-card-foreground">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}

        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? "Criando…" : "Criar conta e entrar"}
        </Button>
      </form>
    </div>
  );
}
