"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "Collecting",
  COMPLETED: "Completed",
  APPROVED: "Approved",
};

export default function BriefingsPage() {
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
  const { page, totalPages, paginatedItems, goToPage } = usePagination(
    briefings,
    10,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Briefings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage client briefings and trigger extractions
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-14" />
            </Card>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No briefings yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Deal
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Started
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((b: any) => (
                  <tr
                    key={b.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
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
                        {statusLabels[b.status] ?? b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {b.createdAt
                        ? new Date(b.createdAt).toLocaleString()
                        : "—"}
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
                              Extracting...
                            </>
                          ) : (
                            "Force Extract"
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}
