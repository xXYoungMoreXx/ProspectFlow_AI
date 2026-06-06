"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Handshake, DollarSign, ArrowRight } from "lucide-react";

interface Deal {
  id: string;
  status: "PROPOSED" | "NEGOTIATING" | "CLOSED" | "CANCELLED";
  pricing?: { total?: number };
  leadId?: string;
  clientName?: string;
  createdAt?: string;
}

const statusColors: Record<string, string> = {
  PROPOSED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  NEGOTIATING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CLOSED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function DealsPage() {
  const t = useTranslations("deals");
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: () => api.deals.list(token!),
    enabled: !!token,
  });

  const deals = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState icon={Handshake} title={t("empty")} />
      ) : (
        <div className="space-y-2">
          {deals.map((deal: Deal) => (
            <Card
              key={deal.id}
              className="group hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {deal.clientName || `Deal #${deal.id?.slice(-6)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        R$ {deal.pricing?.total?.toLocaleString("pt-BR") ?? "0"}
                        {deal.createdAt && (
                          <span className="ml-2">
                            · {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[deal.status] || ""}`}
                    >
                      {t(`status.${deal.status}`)}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
