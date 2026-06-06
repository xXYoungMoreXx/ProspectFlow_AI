"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, X, Plus } from "lucide-react";

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof ALL_DAYS)[number];

interface ConfigData {
  categories: string[];
  region: { city: string; state: string; radiusKm: number };
  minScore: number;
  scheduleTime: string;
  scheduleDays: Day[];
  mapsQuotaRemaining: number | null;
  mapsQuotaLimit: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

function formatDateTime(iso: string | null, neverLabel: string): string {
  if (!iso) return neverLabel;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProspectingConfigTab() {
  const t = useTranslations("prospecting");
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["prospecting-config"],
    queryFn: () => api.prospecting.getConfig(token!),
    enabled: !!token,
  });

  const remote = configQuery.data?.data as ConfigData | undefined;

  const [categories, setCategories] = useState<string[]>([]);
  const [catInput, setCatInput] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radiusKm, setRadiusKm] = useState(20);
  const [minScore, setMinScore] = useState(40);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleDays, setScheduleDays] = useState<Day[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);

  useEffect(() => {
    if (!remote) return;
    setCategories(remote.categories ?? []);
    setCity(remote.region?.city ?? "");
    setState(remote.region?.state ?? "");
    setRadiusKm(remote.region?.radiusKm ?? 20);
    setMinScore(remote.minScore ?? 40);
    setScheduleTime(remote.scheduleTime ?? "09:00");
    setScheduleDays(
      (remote.scheduleDays as Day[]) ?? ["mon", "tue", "wed", "thu", "fri"],
    );
  }, [remote]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.prospecting.updateConfig(
        {
          categories,
          region: { city, state, radiusKm },
          minScore,
          scheduleTime,
          scheduleDays,
        },
        token!,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prospecting-config"] });
    },
  });

  const addCategory = () => {
    const trimmed = catInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setCatInput("");
    }
  };

  const removeCategory = (cat: string) =>
    setCategories((prev) => prev.filter((c) => c !== cat));

  const toggleDay = (day: Day) =>
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  if (configQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Status (read-only) ─────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("config.statusSection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0">
          <StatusRow
            label={t("config.lastRun")}
            value={formatDateTime(remote?.lastRunAt ?? null, t("config.never"))}
          />
          <StatusRow
            label={t("config.nextRun")}
            value={formatDateTime(
              remote?.nextRunAt ?? null,
              t("config.notScheduled"),
            )}
          />
          <StatusRow
            label={t("config.quotaRemaining")}
            value={
              remote?.mapsQuotaRemaining != null
                ? String(remote.mapsQuotaRemaining)
                : "—"
            }
          />
          <StatusRow
            label={t("config.quotaLimit")}
            value={
              remote?.mapsQuotaLimit != null
                ? String(remote.mapsQuotaLimit)
                : "—"
            }
          />
        </CardContent>
      </Card>

      {/* ── Editable parameters ────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("config.editSection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-xs">{t("search.categories")}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t("search.categoriesPlaceholder")}
                value={catInput}
                onChange={(e) => setCatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addCategory())
                }
                className="flex-1 h-8 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={addCategory}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant="secondary"
                    className="gap-1 cursor-pointer text-xs"
                    onClick={() => removeCategory(cat)}
                  >
                    {cat}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Region */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">{t("search.city")}</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("search.cityPlaceholder")}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("search.state")}</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder={t("search.statePlaceholder")}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Radius + MinScore */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                {t("search.radius")} {radiusKm}
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
              <Label className="text-xs">
                {t("search.minScore")} {minScore}
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

          {/* Schedule time */}
          <div className="space-y-1">
            <Label className="text-xs">{t("config.scheduleTime")}</Label>
            <Input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="h-8 text-sm w-32"
            />
          </div>

          {/* Schedule days */}
          <div className="space-y-2">
            <Label className="text-xs">{t("config.scheduleDays")}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`h-7 min-w-[2.5rem] px-2 rounded text-xs font-medium transition-colors border ${
                    scheduleDays.includes(day)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {t(`config.days.${day}`)}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full gap-2"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("config.saving")}
              </>
            ) : (
              t("config.save")
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
        {label}
      </span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
