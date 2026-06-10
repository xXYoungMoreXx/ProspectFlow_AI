"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/stores/auth-store";

interface MCPServer {
  id: string;
  name: string;
  url: string;
  allowedTools: string[];
  isEnabled: boolean;
}

interface TestResult {
  connected: boolean;
  latencyMs: number;
  tools: string[];
}

export function MCPsTab({ agentId }: { agentId: string }) {
  const token = useAuthStore((s) => s.token);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", url: "" });
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/agents/${agentId}/mcp-servers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setServers(d.data ?? []));
  }, [agentId, token]);

  const handleAdd = async () => {
    if (!token) return;
    setError(null);
    const res = await fetch(`/api/v1/agents/${agentId}/mcp-servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...form,
        authType: "none",
        allowedTools: [],
        allowedSubAgentIds: [],
      }),
    });
    const data = (await res.json()) as { data?: MCPServer; message?: string };
    if (!res.ok) {
      setError(data.message ?? "Erro ao conectar");
      return;
    }
    if (data.data) setServers((p) => [...p, data.data!]);
    setShowForm(false);
    setForm({ name: "", url: "" });
  };

  const handleTest = async (id: string) => {
    if (!token) return;
    setTesting(id);
    const res = await fetch(
      `/api/v1/agents/${agentId}/mcp-servers/${id}/test`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = (await res.json()) as { data?: TestResult };
    alert(
      `${data.data?.connected ? "✅" : "❌"} ${data.data?.latencyMs ?? 0}ms — Tools: ${data.data?.tools?.join(", ") || "nenhuma"}`,
    );
    setTesting(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">MCP Servers ({servers.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          + Adicionar
        </Button>
      </div>
      {showForm && (
        <div className="border rounded p-4 space-y-3 bg-muted/40">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="mcp-brasil"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) =>
                  setForm((p) => ({ ...p, url: e.target.value }))
                }
                placeholder="http://mcp-brasil:3001"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            IPs privados bloqueados. Use ALLOWED_MCP_HOSTS para containers
            internos.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>
              Conectar e Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {servers.map((srv) => (
          <div
            key={srv.id}
            className="flex items-center justify-between p-3 border rounded"
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${srv.isEnabled ? "bg-green-500" : "bg-yellow-500"}`}
                />
                <span className="font-medium">{srv.name}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {srv.url}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={testing === srv.id}
              onClick={() => handleTest(srv.id)}
            >
              {testing === srv.id ? "…" : "Test"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
