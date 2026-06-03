"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot } from "lucide-react";

export default function SubAgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["agents", id, "sub-agents"],
    queryFn: () => api.agents.getById(id, token!),
    enabled: !!token,
  });

  const agent = data?.data;
  const subAgents: any[] = agent?.subAgents ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-20 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href={`/agents/${id}`}>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sub-agentes</h2>
          <p className="text-sm text-muted-foreground">{agent?.name}</p>
        </div>
      </div>

      {subAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum sub-agente configurado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subAgents.map((sub: any) => (
            <Card key={sub.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {sub.role ?? sub.skillType}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {sub.status ?? "ACTIVE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-mono">
                  {sub.llmConfig?.model ?? "modelo padrão"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
