"use client";

import { useEffect } from "react";
import { Globe, Webhook, Database } from "lucide-react";
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
import { TestButton, ConnectionBadge } from "@/components/settings/ConnectionStatus";
import { useSettingsStore, type PendingUpdate } from "@/lib/stores/settings-store";

export function IntegrationsTab() {
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
              <CardTitle className="text-sm">MCP Brasil</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Brazilian government APIs — Transparência, DataJud, TSE
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
              Transparência Federal API Key
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
              DataJud API Key
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
              Meta Access Token
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
              <CardTitle className="text-sm">ChromaDB</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Vector database for RAG and agent memory
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
              ChromaDB URL
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
              <CardTitle className="text-sm">Webhooks</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Outbound webhook for system events and integrations
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
              Webhook URL
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
              Signing Secret
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
