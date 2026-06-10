"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth-store";

interface SubAgentInfo {
  id: string;
  role: string;
  executionMode: string;
  parallelGroup?: number;
}
interface WFNode {
  subAgentId: string;
  executionMode: string;
  parallelGroup?: number;
  position: { x: number; y: number };
}

export function WorkflowsTab({ agentId }: { agentId: string }) {
  const token = useAuthStore((s) => s.token);
  const [subAgents, setSubAgents] = useState<SubAgentInfo[]>([]);
  const [nodes, setNodes] = useState<WFNode[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/v1/agents/${agentId}/sub-agents`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/v1/agents/${agentId}/workflow`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ]).then(
      ([subData, wfData]: [
        { data?: SubAgentInfo[] },
        { data?: { nodes?: WFNode[] } },
      ]) => {
        setSubAgents(subData.data ?? []);
        if (wfData.data?.nodes) setNodes(wfData.data.nodes);
      },
    );
  }, [agentId, token]);

  const syncFromSubAgents = () => {
    setNodes(
      subAgents.map((sa, i) => ({
        subAgentId: sa.id,
        executionMode: sa.executionMode,
        parallelGroup: sa.parallelGroup,
        position: { x: i * 200, y: 0 },
      })),
    );
  };

  const handleSave = async () => {
    if (!token) return;
    setSaveError(null);
    const res = await fetch(`/api/v1/agents/${agentId}/workflow`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agentId,
        nodes,
        edges: [],
        globalTimeoutSeconds: 300,
        maxParallelWorkers: 3,
        onFailure: "STOP",
      }),
    });
    if (!res.ok) {
      const b = (await res.json()) as { message?: string };
      setSaveError(b.message ?? "Erro");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saMap = new Map(subAgents.map((sa) => [sa.id, sa]));

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Workflow Builder</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={syncFromSubAgents}>
            ↺ Sync Sub-agentes
          </Button>
          <Button size="sm" onClick={handleSave}>
            {saved ? "✅ Salvo" : "Salvar"}
          </Button>
        </div>
      </div>
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      <div className="border rounded p-4 font-mono text-sm space-y-2 bg-muted min-h-24">
        {nodes.map((n, i) => (
          <div key={n.subAgentId} className="flex items-center gap-2">
            {i > 0 && n.executionMode === "sequential" && (
              <span className="text-muted-foreground">↓</span>
            )}
            {n.executionMode === "parallel" && (
              <span className="text-muted-foreground">║</span>
            )}
            <Badge variant="outline">
              {saMap.get(n.subAgentId)?.role ?? n.subAgentId.slice(0, 8)}
            </Badge>
            {n.parallelGroup != null && (
              <span className="text-xs text-muted-foreground">
                grupo {n.parallelGroup}
              </span>
            )}
          </div>
        ))}
        {nodes.length === 0 && (
          <p className="text-muted-foreground">
            Clique em ↺ Sync para gerar automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
