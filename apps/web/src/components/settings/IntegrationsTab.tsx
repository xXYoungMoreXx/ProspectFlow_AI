"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Webhook,
  Database,
  Package,
  Plus,
  Trash2,
  TerminalSquare,
  Link,
  HelpCircle,
  Share2,
  MapPin,
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
import { Badge } from "@/components/ui/badge";
import { SecretInput } from "@/components/ui/secret-input";
import {
  TestButton,
  ConnectionBadge,
} from "@/components/settings/ConnectionStatus";
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

interface MCPEntry {
  name: string;
  type: "command" | "url";
  value: string;
}

function FieldTooltip({ content }: Readonly<{ content: string }>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex items-center cursor-help" />}
      >
        <HelpCircle className="h-3 w-3 text-muted-foreground/60 shrink-0" />
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

export function IntegrationsTab() {
  const t = useTranslations("settings");
  const { settings, pending, setPending, getValue, fetchSettings } =
    useSettingsStore();

  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"command" | "url">("command");
  const [mcpValue, setMcpValue] = useState("");

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
    isSecret = false,
    category: PendingUpdate["category"] = "integrations",
  ) => setPending({ key, category, value, isSecret });

  const getMcpEntries = (): MCPEntry[] => {
    const raw = get("integrations.mcp.entries");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as MCPEntry[];
    } catch {
      return [];
    }
  };

  const saveMcpEntries = (entries: MCPEntry[]) => {
    set(
      "integrations.mcp.entries",
      JSON.stringify(entries),
      false,
      "integrations",
    );
  };

  const handleAddMcp = () => {
    const name = mcpName.trim();
    const value = mcpValue.trim();
    if (!name || !value) return;
    const entries = getMcpEntries();
    if (entries.some((e) => e.name === name)) return;
    saveMcpEntries([...entries, { name, type: mcpType, value }]);
    setMcpName("");
    setMcpValue("");
  };

  const handleRemoveMcp = (name: string) => {
    saveMcpEntries(getMcpEntries().filter((e) => e.name !== name));
  };

  const mcpEntries = getMcpEntries();

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* MCP Brasil */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Globe className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.mcpBrasil.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.mcpBrasil.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="brasil-transparencia"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpBrasil.transparenciaKey")}
                </Label>
                <FieldTooltip content={t("tooltips.transparenciaKey")} />
              </div>
              <SecretInput
                id="brasil-transparencia"
                value={get("integrations.brasil.transparencia_api_key")}
                onChange={(v) =>
                  set("integrations.brasil.transparencia_api_key", v, true)
                }
                placeholder="••••••••••••••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="brasil-datajud"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpBrasil.datajudKey")}
                </Label>
                <FieldTooltip content={t("tooltips.datajudKey")} />
              </div>
              <SecretInput
                id="brasil-datajud"
                value={get("integrations.brasil.datajud_api_key")}
                onChange={(v) =>
                  set("integrations.brasil.datajud_api_key", v, true)
                }
                placeholder="••••••••••••••••••••"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <TestButton category="integrations_brasil" />
              <ConnectionBadge category="integrations_brasil" />
            </div>
          </CardContent>
        </Card>

        {/* MCP Meta */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Share2 className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.mcpMeta.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.mcpMeta.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="meta-app-id"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpMeta.appId")}
                </Label>
                <FieldTooltip content={t("tooltips.metaAppId")} />
              </div>
              <Input
                id="meta-app-id"
                value={get("integrations.meta.app_id")}
                onChange={(e) =>
                  set("integrations.meta.app_id", e.target.value)
                }
                placeholder="1234567890"
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="meta-app-secret"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpMeta.appSecret")}
                </Label>
                <FieldTooltip content={t("tooltips.metaAppSecret")} />
              </div>
              <SecretInput
                id="meta-app-secret"
                value={get("integrations.meta.app_secret")}
                onChange={(v) => set("integrations.meta.app_secret", v, true)}
                placeholder="••••••••••••••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="meta-access-token"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpMeta.accessToken")}
                </Label>
                <FieldTooltip content={t("tooltips.metaAccessToken")} />
              </div>
              <SecretInput
                id="meta-access-token"
                value={get("integrations.meta.access_token")}
                onChange={(v) => set("integrations.meta.access_token", v, true)}
                placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="meta-phone-id"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.mcpMeta.phoneNumberId")}
                </Label>
                <FieldTooltip content={t("tooltips.metaPhoneNumberId")} />
              </div>
              <Input
                id="meta-phone-id"
                value={get("integrations.meta.phone_number_id")}
                onChange={(e) =>
                  set("integrations.meta.phone_number_id", e.target.value)
                }
                placeholder="1234567890"
                className="text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <TestButton category="integrations_meta" />
              <ConnectionBadge category="integrations_meta" />
            </div>
          </CardContent>
        </Card>

        {/* Google Maps */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.googleMaps.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.googleMaps.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="google-maps-key"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.googleMaps.apiKey")}
                </Label>
                <FieldTooltip content={t("tooltips.googleMapsKey")} />
              </div>
              <SecretInput
                id="google-maps-key"
                value={get("integrations.google.maps_api_key")}
                onChange={(v) =>
                  set("integrations.google.maps_api_key", v, true)
                }
                placeholder="AIzaSy••••••••••••••••••••"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <TestButton category="integrations_google_maps" />
              <ConnectionBadge category="integrations_google_maps" />
            </div>
          </CardContent>
        </Card>

        {/* ChromaDB */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.chromadb.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.chromadb.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="chroma-url"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.chromadb.url")}
                </Label>
                <FieldTooltip content={t("tooltips.chromaUrl")} />
              </div>
              <Input
                id="chroma-url"
                value={get("integrations.chromadb.url")}
                onChange={(e) =>
                  set("integrations.chromadb.url", e.target.value)
                }
                placeholder="http://localhost:8000"
                className="text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <TestButton category="chromadb" />
              <ConnectionBadge category="chromadb" />
            </div>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Webhook className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.webhooks.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.webhooks.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="webhook-url"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.webhooks.url")}
                </Label>
                <FieldTooltip content={t("tooltips.webhookUrl")} />
              </div>
              <Input
                id="webhook-url"
                type="url"
                value={get("integrations.webhook.url")}
                onChange={(e) =>
                  set("integrations.webhook.url", e.target.value)
                }
                placeholder="https://hooks.example.com/..."
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="webhook-secret"
                  className="text-xs text-muted-foreground"
                >
                  {t("integrations.webhooks.secret")}
                </Label>
                <FieldTooltip content={t("tooltips.webhookSecret")} />
              </div>
              <SecretInput
                id="webhook-secret"
                value={get("integrations.webhook.secret")}
                onChange={(v) => set("integrations.webhook.secret", v, true)}
                placeholder="whsec_••••••••••••"
              />
            </div>
          </CardContent>
        </Card>

        {/* MCP Manager */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("integrations.mcpManager.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("integrations.mcpManager.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Add MCP form */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("integrations.mcpManager.addTitle")}
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("integrations.mcpManager.nameLabel")}
                  </Label>
                  <FieldTooltip content={t("tooltips.mcpName")} />
                </div>
                <Input
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  placeholder={t("integrations.mcpManager.namePlaceholder")}
                  className="text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("integrations.mcpManager.typeLabel")}
                  </Label>
                  <FieldTooltip content={t("tooltips.mcpType")} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMcpType("command")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      mcpType === "command"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TerminalSquare className="h-3.5 w-3.5" />
                    {t("integrations.mcpManager.typeCommand")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcpType("url")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      mcpType === "url"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link className="h-3.5 w-3.5" />
                    {t("integrations.mcpManager.typeUrl")}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {mcpType === "command"
                      ? t("integrations.mcpManager.valueLabelCommand")
                      : t("integrations.mcpManager.valueLabelUrl")}
                  </Label>
                  <FieldTooltip content={t("tooltips.mcpValue")} />
                </div>
                <Input
                  value={mcpValue}
                  onChange={(e) => setMcpValue(e.target.value)}
                  placeholder={
                    mcpType === "command"
                      ? t("integrations.mcpManager.valuePlaceholderCommand")
                      : t("integrations.mcpManager.valuePlaceholderUrl")
                  }
                  className="text-sm font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMcp()}
                />
              </div>

              <Button
                size="sm"
                className="gap-1.5 w-full"
                onClick={handleAddMcp}
                disabled={!mcpName.trim() || !mcpValue.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("integrations.mcpManager.addButton")}
              </Button>
            </div>

            {/* Installed MCPs */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("integrations.mcpManager.installedTitle")}
              </p>

              {mcpEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center py-6 gap-2">
                  <Package className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {t("integrations.mcpManager.noMcps")}
                  </p>
                  <p className="text-xs text-muted-foreground/70 text-center max-w-[220px]">
                    {t("integrations.mcpManager.noMcpsHint")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
                  {mcpEntries.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {entry.type === "command" ? (
                          <TerminalSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono font-medium truncate">
                              {entry.name}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-xs h-4 px-1 shrink-0"
                            >
                              {entry.type === "command"
                                ? t("integrations.mcpManager.typeCommandBadge")
                                : t("integrations.mcpManager.typeUrlBadge")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                            {entry.value}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <TestButton
                          category={`integrations_mcp_${entry.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMcp(entry.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
