"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AgentCapabilityStudio } from "@/components/agents/capability-studio/AgentCapabilityStudio";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("agents");
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.agents.getById(id, token!),
    enabled: !!token,
  });

  const agent = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="animate-pulse h-10 w-48 bg-muted rounded" />
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
        <Link href="/agents">
          <Button variant="outline">{t("detail.backToAgents")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link href="/agents">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </Link>
      <AgentCapabilityStudio
        agent={{
          ...agent,
          id: agent.id ?? id,
          name: agent.name ?? "",
          status: agent.status ?? "",
          persona: agent.persona ?? "",
        }}
      />
    </div>
  );
}
