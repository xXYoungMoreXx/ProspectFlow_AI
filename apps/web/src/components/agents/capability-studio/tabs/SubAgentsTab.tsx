"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/stores/auth-store";

interface SubAgent {
  id: string;
  role: string;
  llmModel: string;
  executionMode: string;
  parallelGroup?: number;
  isEnabled: boolean;
}

export function SubAgentsTab({ agentId }: { agentId: string }) {
  const token = useAuthStore((s) => s.token);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    role: "",
    llmModel: "claude-haiku-4-5-20251001",
    executionMode: "sequential",
    parallelGroup: "",
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/agents/${agentId}/sub-agents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSubAgents(d.data ?? []));
  }, [agentId, token]);

  const handleCreate = async () => {
    if (!token) return;
    const res = await fetch(`/api/v1/agents/${agentId}/sub-agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: form.role,
        llmProvider: "ANTHROPIC",
        llmModel: form.llmModel,
        executionMode: form.executionMode,
        parallelGroup: form.parallelGroup
          ? parseInt(form.parallelGroup)
          : undefined,
        llmTemperature: 0.3,
        llmMaxTokens: 4096,
        maxRetries: 3,
        timeoutSeconds: 120,
        isEnabled: true,
      }),
    });
    const data = (await res.json()) as { data?: SubAgent };
    if (data.data) {
      setSubAgents((p) => [...p, data.data!]);
      setShowForm(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Sub-agentes ({subAgents.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          + Novo
        </Button>
      </div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Role</th>
              <th className="p-2">Modelo</th>
              <th className="p-2">Modo</th>
            </tr>
          </thead>
          <tbody>
            {subAgents.map((sa) => (
              <tr key={sa.id} className="border-t">
                <td className="p-2 font-medium">{sa.role}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {sa.llmModel}
                </td>
                <td className="p-2">
                  <Badge variant="outline">
                    {sa.executionMode}
                    {sa.parallelGroup != null ? `:${sa.parallelGroup}` : ""}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="border rounded p-4 space-y-3 bg-muted/40">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Input
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value }))
                }
                placeholder="PROSPECTOR"
              />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input
                value={form.llmModel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, llmModel: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Modo</Label>
              <Select
                value={form.executionMode}
                onValueChange={(v) => {
                  if (v != null) setForm((p) => ({ ...p, executionMode: v }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.executionMode === "parallel" && (
              <div>
                <Label>Grupo</Label>
                <Input
                  value={form.parallelGroup}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, parallelGroup: e.target.value }))
                  }
                  placeholder="1"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
