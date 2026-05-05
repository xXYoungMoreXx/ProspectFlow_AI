'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Zap, Pause, Settings2 } from 'lucide-react';
import Link from 'next/link';

const personaConfig: Record<string, { color: string; label: string }> = {
  HUNTER: { color: 'bg-chart-1/10 text-chart-1 border-chart-1/20', label: 'Hunter' },
  CLOSER: { color: 'bg-chart-2/10 text-chart-2 border-chart-2/20', label: 'Closer' },
  BUILDER: { color: 'bg-chart-3/10 text-chart-3 border-chart-3/20', label: 'Builder' },
  QA: { color: 'bg-chart-4/10 text-chart-4 border-chart-4/20', label: 'QA' },
};

const statusConfig: Record<string, { color: string; icon: typeof Zap }> = {
  ACTIVE: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Zap },
  PAUSED: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Pause },
  INACTIVE: { color: 'bg-muted text-muted-foreground border-border', icon: Settings2 },
};

export default function AgentsPage() {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(token!),
    enabled: !!token,
  });

  const agents = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and configure your autonomous agents
          </p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-3">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load agents. Please check your connection.</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && agents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No agents yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first AI agent to get started</p>
            </div>
            <Link href="/agents/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Agent cards */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent: any) => {
            const persona = personaConfig[agent.persona] || personaConfig.HUNTER;
            const status = statusConfig[agent.status] || statusConfig.INACTIVE;
            const StatusIcon = status.icon;

            return (
              <Card key={agent.id} className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {agent.llmConfig?.model || 'No model configured'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${persona.color}`}>
                      {persona.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`gap-1 ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {agent.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {agent.skills?.length || 0} skills
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
