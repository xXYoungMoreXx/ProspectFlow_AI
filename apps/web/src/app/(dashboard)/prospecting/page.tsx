"use client";

import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Loader2,
  X,
  Plus,
  Star,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  PlayCircle,
  AlertCircle,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ProspectingConfigTab } from "@/components/prospecting/ProspectingConfigTab";

// Leaflet requires the DOM — disable SSR
const ProspectingMap = dynamic(
  () =>
    import("@/components/prospecting/ProspectingMap").then((m) => ({
      default: m.ProspectingMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-muted/40 animate-pulse h-[240px] w-full border border-border" />
    ),
  },
);

interface QueueLead {
  id: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  businessName: string;
  qualificationScore: number | null;
  source: string;
  pendingHitl: boolean;
  createdAt: string;
}

interface Place {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  types: string[];
  mapsUrl: string;
}

export default function ProspectingPage() {
  const t = useTranslations("prospecting");
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const router = useRouter();

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

  const searchMutation = useMutation({
    mutationFn: () =>
      api.prospecting.searchMaps(
        { categories, region: { city, state, radiusKm }, minScore },
        token!,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });
    },
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

  const [previewResults, setPreviewResults] = useState<Place[] | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    total: number;
    city: string;
    state: string;
    radiusKm: number;
  } | null>(null);

  const previewMutation = useMutation({
    mutationFn: () =>
      api.prospecting.previewMaps(
        { categories, city, state, radiusKm },
        token!,
      ),
    onSuccess: (res) => {
      setPreviewResults(res.data.places);
      setPreviewMeta(res.meta);
    },
  });

  const leads: QueueLead[] = queueQuery.data?.data?.leads ?? [];
  const {
    page,
    totalPages,
    paginatedItems: paginatedLeads,
    goToPage,
  } = usePagination(leads, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="search">{t("newSearch")}</TabsTrigger>
          <TabsTrigger value="queue">
            {t("tabs.queue")}
            {leads.length > 0 && (
              <Badge
                variant="default"
                className="ml-2 h-4 min-w-4 text-[9px] px-1 bg-primary/80"
              >
                {leads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">{t("tabs.config")}</TabsTrigger>
        </TabsList>

        {/* ── Nova Busca ──────────────────────────────── */}
        <TabsContent value="search" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {t("search.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("search.categories")}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("search.categoriesPlaceholder")}
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
                  <Label>{t("search.city")}</Label>
                  <Input
                    placeholder={t("search.cityPlaceholder")}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("search.state")}</Label>
                  <Input
                    placeholder={t("search.statePlaceholder")}
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>
                    {t("search.radius")} {radiusKm} km
                  </Label>
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
                  <Label>
                    {t("search.minScore")} {minScore} pts
                  </Label>
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

              {/* Map preview — updates as city / radius changes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("search.mapPreview")}
                </Label>
                <ProspectingMap city={city} state={state} radiusKm={radiusKm} />
              </div>

              <Button
                className="w-full gap-2"
                disabled={!canSearch || previewMutation.isPending}
                onClick={() => {
                  setPreviewResults(null);
                  previewMutation.mutate();
                }}
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("search.searching")}
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    {t("search.submit")}
                  </>
                )}
              </Button>

              {previewMutation.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{t("search.errorPreview")}</span>
                </div>
              )}

              {previewResults !== null && (
                <div className="space-y-3 pt-1">
                  {previewMeta && (
                    <p className="text-xs text-muted-foreground">
                      {t("search.results", {
                        count: previewMeta.total,
                        city: previewMeta.city,
                        state: previewMeta.state,
                      })}
                    </p>
                  )}

                  {previewResults.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-4">
                      {t("search.noResults")}
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
                        {previewResults.map((place) => (
                          <div
                            key={place.placeId}
                            className="rounded-lg border border-border p-3 space-y-1.5 bg-card"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-snug">
                                {place.name}
                              </p>
                              <a
                                href={place.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                aria-label="Abrir no Google Maps"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="line-clamp-1">
                                {place.address}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              {place.rating !== null && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  {place.rating.toFixed(1)}
                                  {place.reviewsCount !== null && (
                                    <span className="text-muted-foreground">
                                      ({place.reviewsCount})
                                    </span>
                                  )}
                                </span>
                              )}
                              {place.phone && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="w-3 h-3" />
                                  {place.phone}
                                </span>
                              )}
                              {place.website && (
                                <a
                                  href={place.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Globe className="w-3 h-3" />
                                  {t("search.website")}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        className="w-full gap-2"
                        disabled={searchMutation.isPending}
                        onClick={() => searchMutation.mutate()}
                      >
                        {searchMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t("search.submitting")}
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4" />
                            {t("search.startProspecting", {
                              count: previewResults.length,
                            })}
                          </>
                        )}
                      </Button>

                      {searchMutation.isError && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{t("search.errorSubmit")}</span>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground text-center">
                        {t("search.googleAttribution")}
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fila ───────────────────────────────────── */}
        <TabsContent value="queue" className="mt-6">
          {queueQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border p-4 h-12"
                >
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
                <Search className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t("queue.empty")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.business")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.contact")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.score")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.source")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.date")}
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        {t("queue.columns.hitl")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      >
                        <td className="px-4 py-3 font-medium">
                          {lead.businessName}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {lead.contactName || "—"}
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
                          {lead.source}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
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

        {/* ── Configuração ───────────────────────────── */}
        <TabsContent value="config" className="mt-6">
          <ProspectingConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
