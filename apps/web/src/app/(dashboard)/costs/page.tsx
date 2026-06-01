"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Cpu, Activity, RefreshCw } from "lucide-react";

type Period = "day" | "week" | "month";

type AgentRow = {
  agentId: string;
  provider: string;
  totalTokens: number;
  costUsd: number;
  requests: number;
};

type DashboardData = {
  period: string;
  since: string;
  totalCostUsd: number;
  totalTokens: number;
  byAgent: AgentRow[];
};

const PERIOD_LABELS: Record<Period, string> = {
  day: "Hoje",
  week: "7 dias",
  month: "30 dias",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  google: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ollama: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function CostsDashboardPage() {
  const { token } = useAuthStore();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.costs.dashboard(p, token);
        setData(res.data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load(period);
  }, [period, load]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Custos de LLM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consumo de tokens e custo por agente
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(period)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? formatCost(data.totalCostUsd) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {PERIOD_LABELS[period]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Tokens
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? formatTokens(data.totalTokens) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {PERIOD_LABELS[period]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Requisições
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? data.byAgent.reduce((s, r) => s + r.requests, 0) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {PERIOD_LABELS[period]}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By-agent breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Agente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : !data || data.byAgent.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Nenhum uso registrado no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3 text-left font-medium">Agente</th>
                    <th className="pb-3 text-left font-medium">Provider</th>
                    <th className="pb-3 text-right font-medium">Tokens</th>
                    <th className="pb-3 text-right font-medium">Requisições</th>
                    <th className="pb-3 text-right font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byAgent
                    .sort((a, b) => b.costUsd - a.costUsd)
                    .map((row, i) => (
                      <tr
                        key={`${row.agentId}-${row.provider}`}
                        className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                      >
                        <td className="py-3 font-mono text-xs">
                          {row.agentId.slice(0, 8)}…
                        </td>
                        <td className="py-3">
                          <Badge
                            variant="outline"
                            className={
                              PROVIDER_COLORS[row.provider] ??
                              "bg-muted/10 text-muted-foreground"
                            }
                          >
                            {row.provider}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-mono text-xs">
                          {formatTokens(row.totalTokens)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {row.requests}
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatCost(row.costUsd)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
