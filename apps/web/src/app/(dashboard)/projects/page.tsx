"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, ExternalLink } from "lucide-react";

const statusColors: Record<string, string> = {
  PENDING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REVIEW: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REVISION: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function ProjectsPage() {
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
        <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track site deliveries and Lighthouse scores
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <FolderKanban className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project: any) => (
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
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-2">
                    {project.lighthouseScores && (
                      <div className="flex gap-2">
                        <span className="text-xs text-muted-foreground">
                          Perf:{" "}
                          <strong className="text-foreground">
                            {project.lighthouseScores.performance}
                          </strong>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          A11y:{" "}
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
