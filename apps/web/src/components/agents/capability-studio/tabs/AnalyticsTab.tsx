"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

interface SubAgentUsage {
  role: string;
  tokens: number;
  costUsd: number;
  avgDurationMs: number;
}
interface Usage {
  totalTokens: number;
  totalCostUsd: number;
  bySubAgent: SubAgentUsage[];
}
type Period = "today" | "week" | "month";

export function AnalyticsTab({ agentId }: { agentId: string }) {
  const token = useAuthStore((s) => s.token);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [period, setPeriod] = useState<Period>("week");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/agents/${agentId}/token-usage?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setUsage(d.data ?? null));
  }, [agentId, period, token]);

  const maxT = Math.max(...(usage?.bySubAgent.map((s) => s.tokens) ?? [1]));

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm transition-colors ${period === p ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
          >
            {p === "today" ? "Hoje" : p === "week" ? "7 dias" : "30 dias"}
          </button>
        ))}
      </div>
      {usage && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <p className="text-sm text-muted-foreground">Tokens</p>
              <p className="text-xl font-bold">
                {usage.totalTokens.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="border rounded p-3">
              <p className="text-sm text-muted-foreground">Custo</p>
              <p className="text-xl font-bold">
                US$ {usage.totalCostUsd.toFixed(4)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {usage.bySubAgent.map((sa) => (
              <div key={sa.role} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{sa.role}</span>
                  <span className="text-muted-foreground text-xs">
                    {sa.tokens.toLocaleString()} · US$ {sa.costUsd.toFixed(4)}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className="bg-primary rounded-full h-1.5"
                    style={{
                      width: `${Math.round((sa.tokens / maxT) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {!usage && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Carregando analytics…
        </p>
      )}
    </div>
  );
}
