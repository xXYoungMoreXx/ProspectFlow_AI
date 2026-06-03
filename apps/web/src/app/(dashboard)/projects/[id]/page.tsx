"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
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
} from "lucide-react";

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
  { key: "created", label: "Project Created" },
  { key: "briefing_approved", label: "Briefing Approved" },
  { key: "builder_started", label: "Builder Started" },
  { key: "staging_approved", label: "Staging Approved" },
  { key: "delivered", label: "Delivered" },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.projects.getById(id, token!),
    enabled: !!token,
  });

  const project = data?.data;
  const lighthouse = project?.lighthouse ?? {};
  const deliverableMeta = project?.deliverableMeta ?? {};
  const videoUrl = (deliverableMeta as Record<string, unknown>).videoUrl as
    | string
    | undefined;

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
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
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
                Site Entregue
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
                    Tutorial
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
                  Open Site
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
              Site not yet delivered — pipeline in progress.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Pipeline Status
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
                        {stage.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          Current stage
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
              Lighthouse Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(lighthouse).length === 0 ? (
              <div className="flex items-center gap-3 py-8">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Scores not yet available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    {
                      key: "performance",
                      label: "Performance",
                      value: (lighthouse as Record<string, number>).performance,
                    },
                    {
                      key: "accessibility",
                      label: "Accessibility",
                      value: (lighthouse as Record<string, number>)
                        .accessibility,
                    },
                    {
                      key: "seo",
                      label: "SEO",
                      value: (lighthouse as Record<string, number>).seo,
                    },
                    {
                      key: "bestPractices",
                      label: "Best Practices",
                      value: (lighthouse as Record<string, number>)
                        .bestPractices,
                    },
                  ] as Array<{
                    key: string;
                    label: string;
                    value: number | undefined;
                  }>
                ).map(({ key, label, value }) => (
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

      <p className="text-xs text-muted-foreground">
        Created {new Date(project.createdAt).toLocaleString()} · Updated{" "}
        {new Date(project.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
