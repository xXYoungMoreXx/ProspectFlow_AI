'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Mail, Phone, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  NEW: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  CONTACTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  QUALIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CONVERTED: 'bg-primary/10 text-primary border-primary/20',
  LOST: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function LeadsPage() {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.leads.list(token!),
    enabled: !!token,
  });

  const leads = data?.data || [];
  const statuses = ['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leads Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage your prospects
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Lead
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].map((status) => {
          const count = leads.filter((l: any) => l.status === status).length;
          return (
            <Card key={status} className="border-border/50">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{status}</p>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="ALL">
        <TabsList className="bg-muted/50">
          {statuses.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs">
              {s === 'ALL' ? 'All' : s}
            </TabsTrigger>
          ))}
        </TabsList>

        {statuses.map((filterStatus) => (
          <TabsContent key={filterStatus} value={filterStatus} className="mt-4">
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
            ) : (
              <div className="space-y-2">
                {(filterStatus === 'ALL' ? leads : leads.filter((l: any) => l.status === filterStatus)).length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                      <Users className="w-10 h-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No leads found</p>
                    </CardContent>
                  </Card>
                ) : (
                  (filterStatus === 'ALL' ? leads : leads.filter((l: any) => l.status === filterStatus)).map((lead: any) => (
                    <Link href={`/leads/${lead.id}`} key={lead.id} className="block">
                      <Card className="group hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{lead.contact?.name || lead.contactName || 'Unknown'}</p>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                  {lead.contact?.email && (
                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.contact.email}</span>
                                  )}
                                  {lead.contact?.company && (
                                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.contact.company}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={`text-[10px] ${statusColors[lead.status] || ''}`}>
                                {lead.status}
                              </Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
