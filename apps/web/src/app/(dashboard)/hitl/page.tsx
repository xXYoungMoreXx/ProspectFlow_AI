'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Check, X, Edit3, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function HITLPage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['hitl-pending'],
    queryFn: () => api.hitl.pending(token!),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.hitl.approve(id, note, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hitl-pending'] });
      setSelectedId(null);
      setNote('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.hitl.reject(id, note, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hitl-pending'] });
      setSelectedId(null);
      setNote('');
    },
  });

  const approvals = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">HITL Approvals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve agent actions before execution
          </p>
        </div>
        {approvals.length > 0 && (
          <Badge variant="default" className="bg-primary/80">
            {approvals.length} pending
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
              <h3 className="font-semibold">All clear!</h3>
              <p className="text-sm text-muted-foreground mt-1">No pending approvals at this time</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval: any) => (
            <Card key={approval.id} className="border-amber-500/20 bg-amber-500/[0.02] hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      {approval.actionType || 'Agent Action'}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Agent: {approval.agentId?.slice(-8)} · {new Date(approval.createdAt).toLocaleString('pt-BR')}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                    PENDING
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Payload preview */}
                {approval.payload && (
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto max-h-32 mb-4 font-mono text-muted-foreground">
                    {JSON.stringify(approval.payload, null, 2)}
                  </pre>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => { setSelectedId(approval.id); setNote(''); }}
                        />
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reject Action</DialogTitle>
                        <DialogDescription>
                          Provide a reason for rejecting this agent action.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="reject-note">Reason</Label>
                        <Input
                          id="reject-note"
                          placeholder="Why are you rejecting this action?"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                          Cancel
                        </DialogClose>
                        <Button
                          variant="destructive"
                          disabled={!note || rejectMutation.isPending}
                          onClick={() => rejectMutation.mutate({ id: approval.id, note })}
                        >
                          {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Confirm Reject
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate({ id: approval.id, note: 'Approved via dashboard' })}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
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
