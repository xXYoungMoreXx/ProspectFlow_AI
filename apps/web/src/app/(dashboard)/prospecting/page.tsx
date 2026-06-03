"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, X, Plus } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function ProspectingPage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radiusKm, setRadiusKm] = useState(20);
  const [minScore, setMinScore] = useState(40);
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const queueQuery = useQuery({
    queryKey: ["prospecting-queue"],
    queryFn: () => api.prospecting.queue(token!),
    enabled: !!token,
  });

  const configQuery = useQuery({
    queryKey: ["prospecting-config"],
    queryFn: () => api.prospecting.getConfig(token!),
    enabled: !!token,
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      api.prospecting.searchMaps(
        { categories, region: { city, state, radiusKm }, minScore },
        token!,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });
    },
    onError: (err) => console.warn("Search failed:", err),
  });

  const addCategory = () => {
    const trimmed = categoryInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setCategoryInput("");
    }
  };

  const removeCategory = (cat: string) =>
    setCategories((prev) => prev.filter((c) => c !== cat));

  const canSearch =
    categories.length > 0 && city.trim().length >= 2 && state.length === 2;

  const leads: any[] = queueQuery.data?.data?.leads ?? [];
  const {
    page,
    totalPages,
    paginatedItems: paginatedLeads,
    goToPage,
  } = usePagination(leads, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Prospecting</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Dispatch Hunter agent and manage prospected leads
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="search">New Search</TabsTrigger>
          <TabsTrigger value="queue">
            Queue
            {leads.length > 0 && (
              <Badge
                variant="default"
                className="ml-2 h-4 min-w-4 text-[9px] px-1 bg-primary/80"
              >
                {leads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Search Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. restaurantes"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addCategory())
                    }
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={addCategory}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeCategory(cat)}
                      >
                        {cat}
                        <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>City</Label>
                  <Input
                    placeholder="São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>State (2 chars)</Label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Radius (km): {radiusKm}</Label>
                  <Input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Min Score: {minScore}</Label>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={!canSearch || searchMutation.isPending}
                onClick={() => searchMutation.mutate()}
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Start Search
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          {queueQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-12" />
                </Card>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
                <Search className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No leads in queue
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Business
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        HITL
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedLeads.map((lead: any) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {lead.businessName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono font-semibold ${
                              (lead.qualificationScore ?? 0) >= 70
                                ? "text-emerald-400"
                                : (lead.qualificationScore ?? 0) >= 40
                                  ? "text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {lead.qualificationScore ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {lead.source ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {lead.createdAt
                            ? new Date(lead.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {lead.pendingHitl && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                            >
                              HITL
                            </Badge>
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
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Prospecting Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configQuery.isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {configQuery.data?.data &&
                    Object.entries(
                      configQuery.data.data as Record<string, unknown>,
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between py-2 border-b border-border last:border-0"
                      >
                        <span className="text-muted-foreground font-mono text-xs">
                          {key}
                        </span>
                        <span className="font-medium text-xs">
                          {String(value ?? "—")}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
