"use client";

import { useEffect } from "react";
import { Globe, Webhook, Database } from "lucide-react";
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
import { SecretInput } from "@/components/ui/secret-input";
import {
  TestButton,
  ConnectionBadge,
} from "@/components/settings/ConnectionStatus";
import {
  useSettingsStore,
  type PendingUpdate,
} from "@/lib/stores/settings-store";

export function IntegrationsTab() {
  const t = useTranslations("settings");
  const { settings, pending, setPending, getValue, fetchSettings } =
    useSettingsStore();

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

  return (
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
            <Label
              htmlFor="brasil-transparencia"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.mcpBrasil.transparenciaKey")}
            </Label>
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
            <Label
              htmlFor="brasil-datajud"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.mcpBrasil.datajudKey")}
            </Label>
            <SecretInput
              id="brasil-datajud"
              value={get("integrations.brasil.datajud_api_key")}
              onChange={(v) =>
                set("integrations.brasil.datajud_api_key", v, true)
              }
              placeholder="••••••••••••••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="brasil-meta"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.mcpBrasil.metaToken")}
            </Label>
            <SecretInput
              id="brasil-meta"
              value={get("integrations.brasil.meta_access_token")}
              onChange={(v) =>
                set("integrations.brasil.meta_access_token", v, true)
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
            <Label
              htmlFor="chroma-url"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.chromadb.url")}
            </Label>
            <Input
              id="chroma-url"
              value={get("integrations.chromadb.url")}
              onChange={(e) => set("integrations.chromadb.url", e.target.value)}
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
            <Label
              htmlFor="webhook-url"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.webhooks.url")}
            </Label>
            <Input
              id="webhook-url"
              type="url"
              value={get("integrations.webhook.url")}
              onChange={(e) => set("integrations.webhook.url", e.target.value)}
              placeholder="https://hooks.example.com/..."
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="webhook-secret"
              className="text-xs text-muted-foreground"
            >
              {t("integrations.webhooks.secret")}
            </Label>
            <SecretInput
              id="webhook-secret"
              value={get("integrations.webhook.secret")}
              onChange={(v) => set("integrations.webhook.secret", v, true)}
              placeholder="whsec_••••••••••••"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
