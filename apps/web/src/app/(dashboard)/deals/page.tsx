"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Handshake, DollarSign, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  PROPOSED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  NEGOTIATING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CLOSED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function DealsPage() {
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
        <h2 className="text-2xl font-bold tracking-tight">Deals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track negotiations and closed contracts
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4">
                <div className="h-4 w-40 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <Handshake className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No deals yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {deals.map((deal: any) => (
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
                        Deal #{deal.id?.slice(-6)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        R$ {deal.pricing?.total?.toLocaleString("pt-BR") || "0"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[deal.status] || ""}`}
                    >
                      {deal.status}
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
