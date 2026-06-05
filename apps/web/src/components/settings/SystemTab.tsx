"use client";

import { useEffect, useRef } from "react";
import {
  Clock,
  Shield,
  Download,
  Upload,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useSettingsStore,
  type PendingUpdate,
} from "@/lib/stores/settings-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function FieldTooltip({ content }: Readonly<{ content: string }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-[260px] text-xs leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SystemTab() {
  const t = useTranslations("settings");
  const { settings, pending, setPending, getValue, fetchSettings } =
    useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.length === 0) fetchSettings();
  }, [settings.length, fetchSettings]);

  const get = (key: string) => {
    const p = pending.get(key)?.value;
    return p !== undefined ? p : (getValue(key) ?? "");
  };

  const set = (
    key: string,
    value: string,
    category: PendingUpdate["category"] = "system",
  ) => setPending({ key, category, value, isSecret: false });

  // Export all settings as JSON (secrets are server-masked, safe to export)
  const handleExport = () => {
    const exportable = settings.map(
      ({ key, category, value, isSecret, isActive, metadata }) => ({
        key,
        category,
        value: isSecret ? "••••" : value,
        isSecret,
        isActive,
        metadata,
      }),
    );
    const blob = new Blob([JSON.stringify(exportable, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agentepro-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import — only non-secret values are restored (secrets must be re-entered)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Array<{
          key: string;
          category: PendingUpdate["category"];
          value: string;
          isSecret: boolean;
        }>;
        parsed
          .filter((s) => !s.isSecret && s.value && s.value !== "••••")
          .forEach((s) =>
            setPending({
              key: s.key,
              category: s.category,
              value: s.value,
              isSecret: false,
            }),
          );
      } catch {
        alert("Invalid settings file");
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        {/* HITL Config */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("system.hitlTimeouts.title")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("system.hitlTimeouts.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="hitl-timeout"
                    className="text-xs text-muted-foreground"
                  >
                    {t("system.hitlTimeouts.defaultTimeout")}
                  </Label>
                  <FieldTooltip content={t("tooltips.hitlTimeout")} />
                </div>
                <Input
                  id="hitl-timeout"
                  type="number"
                  min={1}
                  max={10080}
                  value={get("system.hitl.default_timeout_minutes") || "60"}
                  onChange={(e) =>
                    set("system.hitl.default_timeout_minutes", e.target.value)
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="hitl-financial-reminder"
                    className="text-xs text-muted-foreground"
                  >
                    {t("system.hitlTimeouts.financialInterval")}
                  </Label>
                  <FieldTooltip content={t("tooltips.financialInterval")} />
                </div>
                <Input
                  id="hitl-financial-reminder"
                  type="number"
                  min={5}
                  value={get("system.hitl.financial_reminder_minutes") || "30"}
                  onChange={(e) =>
                    set(
                      "system.hitl.financial_reminder_minutes",
                      e.target.value,
                    )
                  }
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("system.security.title")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("system.security.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="max-body"
                  className="text-xs text-muted-foreground"
                >
                  {t("system.security.maxBodySize")}
                </Label>
                <FieldTooltip content={t("tooltips.maxBodySize")} />
              </div>
              <Input
                id="max-body"
                type="number"
                min={1024}
                value={get("system.security.max_body_size") || "1048576"}
                onChange={(e) =>
                  set("system.security.max_body_size", e.target.value)
                }
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t("system.security.hint")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Export / Import */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Download className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("system.backup.title")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("system.backup.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExport}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t("system.backup.export")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[220px]">
                  {t("tooltips.backupExport")}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("system.backup.import")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[220px]">
                  {t("tooltips.backupImport")}
                </TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {t("system.backup.note")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
