"use client";

import { useAuthStore } from "@/lib/stores/auth-store";
import { useHitlStore } from "@/lib/stores/hitl-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Check,
  X,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";

// SPEC-09 §2 — action type labels in Portuguese
const ACTION_LABELS: Record<string, string> = {
  APPROVE_LEAD_LIST: "Aprovar Lista de Leads",
  SEND_EXTERNAL_MESSAGE: "Enviar Mensagem Externa",
  SEND_PROPOSAL: "Enviar Proposta",
  APPROVE_MOCKUP: "Aprovar Mockup",
  APPROVE_STAGING: "Aprovar Staging",
  DEPLOY_PRODUCTION: "Deploy em Produção",
  APPROVE_BRIEFING: "Aprovar Briefing",
  SEND_DELIVERY: "Enviar Entrega ao Cliente",
};

// Live countdown hook — updates every second
function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return {
    formatted:
      remaining === 0
        ? "Expirado"
        : hours > 0
          ? `${hours}h ${minutes}m`
          : minutes > 0
            ? `${minutes}m ${seconds}s`
            : `${seconds}s`,
    isExpired: remaining === 0,
    isUrgent: remaining > 0 && remaining < 10 * 60_000,
  };
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const { formatted, isExpired, isUrgent } = useCountdown(expiresAt);

  if (isExpired) {
    return (
      <Badge
        variant="destructive"
        className="text-[10px] gap-1"
        data-testid="badge-expired"
      >
        <AlertTriangle className="w-3 h-3" />
        Expirado
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={
        isUrgent
          ? "bg-red-500/10 text-red-400 border-red-500/20 text-[10px] gap-1 animate-pulse"
          : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1"
      }
      data-testid="badge-countdown"
    >
      <Clock className="w-3 h-3" />
      {formatted}
    </Badge>
  );
}

export default function HITLPage() {
  const token = useAuthStore((s) => s.token);
  const { pendingApprovals, isLoading, fetchPending, approve, reject } =
    useHitlStore();
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchPending();
      const interval = setInterval(fetchPending, 15_000);
      return () => clearInterval(interval);
    }
  }, [token, fetchPending]);

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    try {
      await approve(id, "Aprovado via dashboard");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(id);
    try {
      await reject(id, note);
      setNote("");
    } finally {
      setIsProcessing(null);
    }
  };

  const approvals = (pendingApprovals || []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">HITL Approvals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Revise e aprove ações dos agentes antes da execução
          </p>
        </div>
        {approvals.length > 0 && (
          <Badge variant="default" className="bg-primary/80">
            {approvals.length} pendentes
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4">
                <div className="h-4 w-40 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Tudo limpo!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhuma aprovação pendente no momento
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <Card
              key={approval.id}
              className="border-amber-500/20 bg-amber-500/[0.02] hover:shadow-sm transition-all"
              data-testid="hitl-card"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      {ACTION_LABELS[approval.actionType] ??
                        approval.actionType ??
                        "Ação do Agente"}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Agente: {approval.agentId?.slice(-8)} ·{" "}
                      {new Date(approval.createdAt).toLocaleString("pt-BR")}
                    </CardDescription>
                  </div>

                  {/* Countdown + status badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {approval.expiresAt && (
                      <CountdownBadge expiresAt={approval.expiresAt} />
                    )}
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]"
                    >
                      PENDING
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Masked payload preview (PII already stripped on server) */}
                {approval.payloadPreview && (
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto max-h-32 mb-4 font-mono text-muted-foreground">
                    {JSON.stringify(approval.payloadPreview, null, 2)}
                  </pre>
                )}

                <div className="flex items-center gap-2 justify-end">
                  {/* Reject dialog — base-ui uses render= not asChild */}
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1.5"
                          data-testid="btn-reject"
                          onClick={() => setNote("")}
                        />
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeitar
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Rejeitar Ação</DialogTitle>
                        <DialogDescription>
                          Informe o motivo da rejeição para o agente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="reject-note">Motivo</Label>
                        <Input
                          id="reject-note"
                          placeholder="Por que está rejeitando esta ação?"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                          Cancelar
                        </DialogClose>
                        <Button
                          variant="destructive"
                          disabled={!note || isProcessing === approval.id}
                          onClick={() => handleReject(approval.id)}
                        >
                          {isProcessing === approval.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Confirmar Rejeição
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Approve inline */}
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={isProcessing === approval.id}
                    onClick={() => handleApprove(approval.id)}
                    data-testid="btn-approve"
                  >
                    {isProcessing === approval.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Aprovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
