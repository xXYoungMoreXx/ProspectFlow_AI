"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban, ExternalLink } from "lucide-react";

interface Project {
  id: string;
  clientName?: string;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "REVISION";
  lighthouseScores?: { performance?: number; accessibility?: number };
  previewUrl?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REVIEW: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REVISION: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(token!),
    enabled: !!token,
  });

  const projects = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border p-5 space-y-3"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title={t("empty")} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project: Project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="group hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">
                      {project.clientName ||
                        `Project #${project.id?.slice(-6)}`}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[project.status] || ""}`}
                    >
                      {t(`status.${project.status}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-2">
                    {project.lighthouseScores && (
                      <div className="flex gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("perf")}{" "}
                          <strong className="text-foreground">
                            {project.lighthouseScores.performance}
                          </strong>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("a11y")}{" "}
                          <strong className="text-foreground">
                            {project.lighthouseScores.accessibility}
                          </strong>
                        </span>
                      </div>
                    )}
                    {project.previewUrl && (
                      <a
                        href={project.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
