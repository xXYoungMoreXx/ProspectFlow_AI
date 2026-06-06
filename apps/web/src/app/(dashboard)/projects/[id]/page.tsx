"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use, useMemo } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  Palette,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";

const statusColors: Record<string, string> = {
  PENDING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REVIEW: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REVISION: "bg-destructive/10 text-destructive border-destructive/20",
};

function lighthouseColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-amber-400";
  return "text-destructive";
}

const PIPELINE_STAGES = [
  { key: "created" },
  { key: "briefing_approved" },
  { key: "builder_started" },
  { key: "staging_approved" },
  { key: "delivered" },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);
  const t = useTranslations("projects");

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.projects.getById(id, token!),
    enabled: !!token,
  });

  const { data: hitlData } = useQuery({
    queryKey: ["hitl", "pending"],
    queryFn: () => api.hitl.pending(token!),
    enabled: !!token,
  });

  const project = data?.data;
  const lighthouse = project?.lighthouse ?? {};
  const deliverableMeta = project?.deliverableMeta ?? {};
  const videoUrl = (deliverableMeta as Record<string, unknown>).videoUrl as
    | string
    | undefined;

  const pendingHitl = useMemo(() => {
    const list: Array<{ id: string; projectId: string; actionType: string }> =
      hitlData?.data ?? [];
    return list.find(
      (h) => h.projectId === id && h.actionType === "APPROVE_MOCKUP",
    );
  }, [hitlData, id]);

  const mockupMutation = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") => {
      if (!pendingHitl) return Promise.reject(new Error("No pending HITL"));
      if (decision === "APPROVED") {
        return api.hitl.approve(pendingHitl.id, "", token!);
      }
      return api.hitl.reject(pendingHitl.id, "", token!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hitl", "pending"] });
      void queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });

  const currentStageIndex = project
    ? project.status === "DELIVERED"
      ? PIPELINE_STAGES.length - 1
      : project.status === "IN_PROGRESS"
        ? 2
        : project.status === "REVIEW"
          ? 3
          : project.status === "PENDING"
            ? 0
            : 4
    : -1;

  const stageLabels: Record<string, string> = {
    created: t("detail.stages.created"),
    briefing_approved: t("detail.stages.briefing_approved"),
    builder_started: t("detail.stages.builder_started"),
    staging_approved: t("detail.stages.staging_approved"),
    delivered: t("detail.stages.delivered"),
  };

  const lighthouseMetrics: Array<{
    key: string;
    label: string;
    value: number | undefined;
  }> = [
    {
      key: "performance",
      label: t("detail.lighthouse.performance"),
      value: (lighthouse as Record<string, number>).performance,
    },
    {
      key: "accessibility",
      label: t("detail.lighthouse.accessibility"),
      value: (lighthouse as Record<string, number>).accessibility,
    },
    {
      key: "seo",
      label: t("detail.lighthouse.seo"),
      value: (lighthouse as Record<string, number>).seo,
    },
    {
      key: "bestPractices",
      label: t("detail.lighthouse.bestPractices"),
      value: (lighthouse as Record<string, number>).bestPractices,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="animate-pulse h-10 w-48 bg-muted rounded" />
        <div className="animate-pulse h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="animate-pulse h-64 bg-muted rounded-xl" />
          <div className="animate-pulse h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
        <Link href="/projects">
          <Button variant="outline">{t("detail.backToProjects")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            Project #{id.slice(-8)}
          </h2>
          <Badge
            variant="outline"
            className={`text-xs ${statusColors[project.status] ?? ""}`}
          >
            {project.status}
          </Badge>
        </div>
      </div>

      {project.deliverableUrl ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="py-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {t("detail.siteDelivered")}
              </p>
              <p className="text-sm text-emerald-400 font-mono break-all">
                {project.deliverableUrl}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Play className="w-4 h-4" />
                    {t("detail.tutorial")}
                  </Button>
                </a>
              )}
              <a
                href={project.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  {t("detail.openSite")}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("detail.notDelivered")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("detail.pipelineStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {PIPELINE_STAGES.map((stage, index) => {
                const isDone = index <= currentStageIndex;
                const isActive = index === currentStageIndex;
                return (
                  <div key={stage.key} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-border bg-background"
                        } ${isActive ? "ring-2 ring-emerald-500/30" : ""}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      {index < PIPELINE_STAGES.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 mt-1 ${isDone ? "bg-emerald-500/30" : "bg-border"}`}
                        />
                      )}
                    </div>
                    <div className="pt-1 pb-2">
                      <p
                        className={`text-sm font-medium ${isDone ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {stageLabels[stage.key] ?? stage.key}
                      </p>
                      {isActive && (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          {t("detail.currentStage")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {t("detail.lighthouseTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(lighthouse).length === 0 ? (
              <div className="flex items-center gap-3 py-8">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("detail.scoresNotAvailable")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {lighthouseMetrics.map(({ key, label, value }) => (
                  <div
                    key={key}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/20 gap-1"
                  >
                    <span
                      className={`text-4xl font-bold tabular-nums ${lighthouseColor(value ?? 0)}`}
                    >
                      {value ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {project.mockupHtml && pendingHitl?.actionType === "APPROVE_MOCKUP" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-violet-400" />
              {t("detail.mockupTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("detail.mockupDesc")}
            </p>
            <div
              className="rounded-lg border overflow-hidden bg-white"
              style={{ height: 520 }}
            >
              <iframe
                srcDoc={project.mockupHtml as string}
                className="w-full h-full"
                sandbox="allow-same-origin"
                title="Mockup visual preview"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => mockupMutation.mutate("REJECTED")}
                disabled={mockupMutation.isPending}
              >
                <X className="w-4 h-4" /> {t("detail.reject")}
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => mockupMutation.mutate("APPROVED")}
                disabled={mockupMutation.isPending}
              >
                {mockupMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t("detail.approveMockup")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {t("detail.createdAt")}{" "}
        {new Date(project.createdAt).toLocaleString()} ·{" "}
        {t("detail.updatedAt")}{" "}
        {new Date(project.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
