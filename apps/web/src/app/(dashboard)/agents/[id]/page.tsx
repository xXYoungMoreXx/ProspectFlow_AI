"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Zap, Pause } from "lucide-react";

const personaColors: Record<string, string> = {
  HUNTER: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  CLOSER: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  BUILDER: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  QA: "bg-chart-4/10 text-chart-4 border-chart-4/20",
};

const MODEL_OPTIONS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "gpt-4o",
  "gemini-pro",
];

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.agents.getById(id, token!),
    enabled: !!token,
  });

  const agent = data?.data;

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name ?? "");
      setModel(agent.llmConfig?.model ?? "claude-sonnet-4-6");
      setStatus(agent.status ?? "ACTIVE");
    }
  }, [agent]);

  useEffect(() => {
    if (agent) {
      setIsDirty(
        name !== (agent.name ?? "") ||
          model !== (agent.llmConfig?.model ?? "claude-sonnet-4-6") ||
          status !== (agent.status ?? "ACTIVE"),
      );
    }
  }, [name, model, status, agent]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.agents.update(
        id,
        { name, status, llmConfig: { ...agent?.llmConfig, model } },
        token!,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["agents", id] });
      setIsDirty(false);
    },
    onError: (err) => console.warn("Update failed:", err),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="animate-pulse h-10 w-48 bg-muted rounded" />
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents">
          <Button variant="outline">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
          <Badge
            variant="outline"
            className={`text-xs ${personaColors[agent.persona] ?? ""}`}
          >
            {agent.persona}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-model">LLM Model</Label>
            <Select
              value={model}
              onValueChange={(v) => v != null && setModel(v)}
            >
              <SelectTrigger id="agent-model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => v != null && setStatus(v)}
            >
              <SelectTrigger id="agent-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    ACTIVE
                  </div>
                </SelectItem>
                <SelectItem value="PAUSED">
                  <div className="flex items-center gap-2">
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    PAUSED
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              className="gap-2"
              disabled={!isDirty || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {agent.skills && agent.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill: any) => (
                <Badge
                  key={skill.id ?? skill}
                  variant="secondary"
                  className="text-xs"
                >
                  {skill.skillType ?? skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Created {new Date(agent.createdAt).toLocaleString()} · Last updated{" "}
        {new Date(agent.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
