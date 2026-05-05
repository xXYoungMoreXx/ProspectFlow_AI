'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Mail, Building2, Phone, MessageSquare, Calculator, Bot, Check, Clock, Send, Plus } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { Input } from '@/components/ui/input';

const statusColors: Record<string, string> = {
  NEW: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  CONTACTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  QUALIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CONVERTED: 'bg-primary/10 text-primary border-primary/20',
  LOST: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Mock data to simulate quote items since backend isn't fully returning this yet
const MOCK_QUOTE_ITEMS = [
  { id: 1, description: 'Next.js Frontend Setup', category: 'Development', cost: 1500 },
  { id: 2, description: 'Supabase Backend & DB', category: 'Infrastructure', cost: 800 },
  { id: 3, description: 'Agent Orchestration (CrewAI)', category: 'AI Integration', cost: 2000 },
  { id: 4, description: 'Vercel Deployment & CI/CD', category: 'DevOps', cost: 500 },
];

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const token = useAuthStore((s) => s.token);
  
  const [quoteItems] = useState(MOCK_QUOTE_ITEMS);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [quoteGenerated, setQuoteGenerated] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // We fetch leads and find the specific one. In a real app, we'd fetch the lead directly by ID.
  const { data, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.leads.list(token!),
    enabled: !!token,
  });

  const leads = data?.data || [];
  const lead = leads.find((l: Record<string, any>) => l.id === resolvedParams.id);

  const handleGenerateQuoteWithAgent = () => {
    setIsGeneratingQuote(true);
    // Simulate agent analyzing requirements and calculating costs
    setTimeout(() => {
      setQuoteGenerated(true);
      setIsGeneratingQuote(false);
    }, 2500);
  };

  const totalCost = quoteItems.reduce((acc, item) => acc + item.cost, 0);

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted/20 rounded-xl" />;
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Lead not found</p>
        <Link href="/leads">
          <Button variant="outline">Back to Leads</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{lead.contact?.name || lead.contactName || 'Unknown Contact'}</h2>
            <Badge variant="outline" className={`text-xs ${statusColors[lead.status] || ''}`}>
              {lead.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Lead #{lead.id?.slice(-8)} · Created on {new Date(lead.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Info & Context */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{lead.contact?.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{lead.contact?.phone || 'No phone provided'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{lead.contact?.company || 'No company provided'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Lead Context / Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Client requested a complete CRM platform built with Next.js, integrating Supabase for auth and a custom AI agent layer to automate client onboarding and proposal generation.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Tabs (History & Quote) */}
        <div className="md:col-span-2">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Conversation History
              </TabsTrigger>
              <TabsTrigger value="quote" className="gap-2">
                <Calculator className="w-4 h-4" />
                Smart Quoting
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="p-0 flex flex-col h-[500px]">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Mock history */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-3 text-sm max-w-[80%]">
                        <p>Hi, I need a quote for an AI agent platform.</p>
                        <span className="text-[10px] text-muted-foreground mt-2 block">10:42 AM</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="bg-primary/10 text-foreground border border-primary/20 rounded-2xl rounded-tr-sm p-3 text-sm max-w-[80%]">
                        <p>Hello! I can help you with that. Could you provide a few more details about the specific AI features you need? For example, do you need custom LLMs or standard integrations?</p>
                        <span className="text-[10px] text-muted-foreground mt-2 block text-right">10:43 AM</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 border-t border-border bg-muted/30">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Type a message or internal note..." 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="bg-background"
                      />
                      <Button size="icon" disabled={!newMessage}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quote" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Quote Generation</CardTitle>
                  <CardDescription>
                    Analyze the client&apos;s request and automatically calculate platform, infrastructure, and development costs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!quoteGenerated && !isGeneratingQuote ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg bg-muted/20">
                      <Calculator className="w-12 h-12 text-muted-foreground/40 mb-4" />
                      <h3 className="font-medium text-lg">No quote generated yet</h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm mt-2 mb-6">
                        Let our specialized Pricing Agent analyze the conversation history and project requirements to suggest a budget.
                      </p>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setQuoteGenerated(true)}>
                          Create Manually
                        </Button>
                        <Button className="gap-2" onClick={handleGenerateQuoteWithAgent}>
                          <Bot className="w-4 h-4" />
                          Generate with AI
                        </Button>
                      </div>
                    </div>
                  ) : isGeneratingQuote ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4 border border-dashed rounded-lg bg-primary/5">
                      <Bot className="w-12 h-12 text-primary animate-pulse" />
                      <div className="text-center space-y-2">
                        <h3 className="font-medium text-lg text-primary">Agent analyzing requirements...</h3>
                        <p className="text-sm text-muted-foreground">Checking tool costs, infrastructure needs, and effort estimation.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <Check className="w-3 h-3 mr-1" />
                          AI Generated Quote
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Updated just now
                        </span>
                      </div>

                      <div className="rounded-md border">
                        <div className="grid grid-cols-12 text-sm font-medium bg-muted/50 p-3 border-b">
                          <div className="col-span-6">Description</div>
                          <div className="col-span-3">Category</div>
                          <div className="col-span-3 text-right">Cost (USD)</div>
                        </div>
                        <div className="divide-y">
                          {quoteItems.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 text-sm p-3 items-center group">
                              <div className="col-span-6 font-medium">{item.description}</div>
                              <div className="col-span-3 text-muted-foreground text-xs">{item.category}</div>
                              <div className="col-span-3 text-right tabular-nums">
                                ${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-12 text-sm font-medium bg-primary/5 p-4 border-t">
                          <div className="col-span-9 text-right text-muted-foreground uppercase tracking-wider text-xs flex items-center justify-end">
                            Estimated Total
                          </div>
                          <div className="col-span-3 text-right text-lg text-primary tabular-nums">
                            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-amber-500 mb-2">Agent Rationale</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Based on the client&apos;s request for a complete CRM with AI integration, we estimated standard frontend/backend setup alongside CrewAI orchestration overhead. Infrastructure costs cover Vercel Pro and Supabase Pro tiers for 1 year.
                        </p>
                      </div>

                      <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                        <Button className="gap-2">
                          <Send className="w-4 h-4" />
                          Send Proposal to Client
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
