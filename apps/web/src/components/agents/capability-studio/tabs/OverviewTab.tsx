"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Agent {
  id: string;
  name: string;
  status: string;
  persona: string;
  tokenBudgetRemaining?: number;
  tokenBudgetTotal?: number;
  [key: string]: unknown;
}

export function OverviewTab({ agent }: { agent: Agent }) {
  const budgetPct = agent.tokenBudgetTotal
    ? Math.round(
        ((agent.tokenBudgetRemaining ?? 0) / agent.tokenBudgetTotal) * 100,
      )
    : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Badge variant={agent.status === "ACTIVE" ? "default" : "secondary"}>
          {agent.status}
        </Badge>
        <span className="text-sm text-muted-foreground">{agent.persona}</span>
      </div>
      {agent.tokenBudgetTotal && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Token Budget</span>
            <span>
              {(agent.tokenBudgetRemaining ?? 0).toLocaleString()} /{" "}
              {agent.tokenBudgetTotal.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm">Ativar</Button>
        <Button size="sm" variant="outline">
          Pausar
        </Button>
      </div>
    </div>
  );
}
