"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Bot, Plus, Zap, Pause, Settings2 } from "lucide-react";
import Link from "next/link";

interface AgentListItem {
  id: string;
  name: string;
  persona: "HUNTER" | "CLOSER" | "BUILDER" | "QA";
  status: "ACTIVE" | "PAUSED" | "INACTIVE";
  llmConfig?: { model?: string };
  skills?: { id?: string; skillType?: string }[];
}

const personaColors: Record<string, string> = {
  HUNTER: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  CLOSER: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  BUILDER: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  QA: "bg-chart-4/10 text-chart-4 border-chart-4/20",
};

const statusConfig: Record<string, { color: string; icon: typeof Zap }> = {
  ACTIVE: {
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: Zap,
  },
  PAUSED: {
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: Pause,
  },
  INACTIVE: {
    color: "bg-muted text-muted-foreground border-border",
    icon: Settings2,
  },
};

export default function AgentsPage() {
  const t = useTranslations("agents");
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.agents.list(token!),
    enabled: !!token,
  });

  const agents = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t("newAgent")}
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border p-5 space-y-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-full mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{t("error")}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Link href="/agents/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("empty.cta")}
              </Button>
            </Link>
          }
        />
      )}

      {/* Agent cards */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent: AgentListItem) => {
            const color = personaColors[agent.persona] ?? personaColors.HUNTER;
            const status = statusConfig[agent.status] ?? statusConfig.INACTIVE;
            const StatusIcon = status.icon;

            return (
              <Link key={agent.id} href={"/agents/" + agent.id}>
                <Card className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-1">
                      <div className="space-y-1">
                        <p className="text-base font-semibold group-hover:text-primary transition-colors">
                          {agent.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {agent.llmConfig?.model || t("noModel")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${color}`}
                      >
                        {t(`personas.${agent.persona}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Badge
                        variant="outline"
                        className={`gap-1 ${status.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {t(`status.${agent.status}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("skillsCount", { count: agent.skills?.length ?? 0 })}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
