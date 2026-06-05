"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function BriefingsPage() {
  const t = useTranslations("briefings");
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn: () => api.briefings.list(token!),
    enabled: !!token,
  });

  const extractMutation = useMutation({
    mutationFn: (briefingId: string) =>
      api.briefings.extract(briefingId, token!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["briefings"] });
    },
    onError: (err) => {
      console.warn("Extract failed:", err);
    },
  });

  const briefings: any[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4 h-14">
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty")} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {t("columns.id")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {t("columns.deal")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {t("columns.status")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {t("columns.started")}
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  {t("columns.action")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {briefings.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    #{b.id?.slice(-8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {b.dealId?.slice(-8) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[b.status] ?? ""}`}
                    >
                      {t(`status.${b.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-7 text-xs"
                        disabled={
                          extractMutation.isPending &&
                          extractMutation.variables === b.id
                        }
                        onClick={() => extractMutation.mutate(b.id)}
                      >
                        {extractMutation.isPending &&
                        extractMutation.variables === b.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t("extracting")}
                          </>
                        ) : (
                          t("forceExtract")
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
