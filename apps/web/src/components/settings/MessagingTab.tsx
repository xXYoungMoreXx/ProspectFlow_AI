"use client";

import { useEffect } from "react";
import { MessageCircle, Mail, Send } from "lucide-react";
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

export function MessagingTab() {
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
    category: PendingUpdate["category"] = "messaging",
  ) => setPending({ key, category, value, isSecret });

  return (
    <div className="space-y-4">
      {/* WhatsApp — Evolution API */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-sm">WhatsApp</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Evolution API integration for WhatsApp Business
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="wpp-url" className="text-xs text-muted-foreground">
              Evolution API URL
            </Label>
            <Input
              id="wpp-url"
              value={get("messaging.whatsapp.evolution_url")}
              onChange={(e) => set("messaging.whatsapp.evolution_url", e.target.value)}
              placeholder="http://localhost:8080"
              className="text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wpp-key" className="text-xs text-muted-foreground">
              API Key
            </Label>
            <SecretInput
              id="wpp-key"
              value={get("messaging.whatsapp.api_key")}
              onChange={(v) => set("messaging.whatsapp.api_key", v, true)}
              placeholder="••••••••••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wpp-instance" className="text-xs text-muted-foreground">
              Instance Name
            </Label>
            <Input
              id="wpp-instance"
              value={get("messaging.whatsapp.instance")}
              onChange={(e) => set("messaging.whatsapp.instance", e.target.value)}
              placeholder="agentepro"
              className="text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <TestButton category="messaging_whatsapp" />
            <ConnectionBadge category="messaging_whatsapp" />
          </div>
        </CardContent>
      </Card>

      {/* Email — Brevo */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm">Email</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Brevo (formerly Sendinblue) transactional email
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="email-key" className="text-xs text-muted-foreground">
              Brevo API Key
            </Label>
            <SecretInput
              id="email-key"
              value={get("messaging.email.brevo_api_key")}
              onChange={(v) => set("messaging.email.brevo_api_key", v, true)}
              placeholder="xkeysib-••••••••••••"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-from-name" className="text-xs text-muted-foreground">
                Sender Name
              </Label>
              <Input
                id="email-from-name"
                value={get("messaging.email.from_name")}
                onChange={(e) => set("messaging.email.from_name", e.target.value)}
                placeholder="AgentePro"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-from-address" className="text-xs text-muted-foreground">
                Sender Address
              </Label>
              <Input
                id="email-from-address"
                type="email"
                value={get("messaging.email.from_address")}
                onChange={(e) => set("messaging.email.from_address", e.target.value)}
                placeholder="noreply@example.com"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <TestButton category="messaging_email" />
            <ConnectionBadge category="messaging_email" />
          </div>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <CardTitle className="text-sm">Telegram</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Bot for operator alerts and HITL approval workflows
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="tg-token" className="text-xs text-muted-foreground">
              Bot Token
            </Label>
            <SecretInput
              id="tg-token"
              value={get("messaging.telegram.bot_token")}
              onChange={(v) => set("messaging.telegram.bot_token", v, true)}
              placeholder="1234567890:ABCDEFGxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tg-chat-id" className="text-xs text-muted-foreground">
              Operator Chat ID
            </Label>
            <Input
              id="tg-chat-id"
              value={get("messaging.telegram.chat_id")}
              onChange={(e) => set("messaging.telegram.chat_id", e.target.value)}
              placeholder="-1001234567890"
              className="text-sm font-mono"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <TestButton category="messaging_telegram" />
            <ConnectionBadge category="messaging_telegram" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
