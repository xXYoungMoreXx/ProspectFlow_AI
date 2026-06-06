"use client";

import { useEffect } from "react";
import { MessageCircle, Mail, Send, HelpCircle } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

export function MessagingTab() {
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
    category: PendingUpdate["category"] = "messaging",
  ) => setPending({ key, category, value, isSecret });

  const emailProvider = get("messaging.email.provider") || "brevo";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* WhatsApp — Evolution API */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("messaging.whatsapp.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("messaging.whatsapp.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="wpp-url"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.whatsapp.apiUrl")}
                </Label>
                <FieldTooltip content={t("tooltips.whatsappUrl")} />
              </div>
              <Input
                id="wpp-url"
                value={get("messaging.whatsapp.evolution_url")}
                onChange={(e) =>
                  set("messaging.whatsapp.evolution_url", e.target.value)
                }
                placeholder="http://localhost:8080"
                className="text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="wpp-key"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.whatsapp.apiKey")}
                </Label>
                <FieldTooltip content={t("tooltips.whatsappKey")} />
              </div>
              <SecretInput
                id="wpp-key"
                value={get("messaging.whatsapp.api_key")}
                onChange={(v) => set("messaging.whatsapp.api_key", v, true)}
                placeholder="••••••••••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="wpp-instance"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.whatsapp.instanceName")}
                </Label>
                <FieldTooltip content={t("tooltips.whatsappInstance")} />
              </div>
              <Input
                id="wpp-instance"
                value={get("messaging.whatsapp.instance")}
                onChange={(e) =>
                  set("messaging.whatsapp.instance", e.target.value)
                }
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

        {/* Email — Brevo / Resend */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {t("messaging.email.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("messaging.email.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Provider toggle */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 w-fit">
              {(["brevo", "resend"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("messaging.email.provider", p)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    emailProvider === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "brevo" ? "Brevo" : "Resend"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="email-key"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.email.apiKey")}
                </Label>
                <FieldTooltip
                  content={
                    emailProvider === "resend"
                      ? t("tooltips.resendKey")
                      : t("tooltips.brevoKey")
                  }
                />
              </div>
              <SecretInput
                id="email-key"
                value={
                  emailProvider === "resend"
                    ? get("messaging.email.resend_api_key")
                    : get("messaging.email.brevo_api_key")
                }
                onChange={(v) =>
                  set(
                    emailProvider === "resend"
                      ? "messaging.email.resend_api_key"
                      : "messaging.email.brevo_api_key",
                    v,
                    true,
                  )
                }
                placeholder={
                  emailProvider === "resend"
                    ? "re_••••••••••••••••"
                    : "xkeysib-••••••••••••"
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="email-from-name"
                    className="text-xs text-muted-foreground"
                  >
                    {t("messaging.email.senderName")}
                  </Label>
                  <FieldTooltip content={t("tooltips.senderName")} />
                </div>
                <Input
                  id="email-from-name"
                  value={get("messaging.email.from_name")}
                  onChange={(e) =>
                    set("messaging.email.from_name", e.target.value)
                  }
                  placeholder="AgentePro"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="email-from-address"
                    className="text-xs text-muted-foreground"
                  >
                    {t("messaging.email.senderAddress")}
                  </Label>
                  <FieldTooltip content={t("tooltips.senderAddress")} />
                </div>
                <Input
                  id="email-from-address"
                  type="email"
                  value={get("messaging.email.from_address")}
                  onChange={(e) =>
                    set("messaging.email.from_address", e.target.value)
                  }
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
                <CardTitle className="text-sm">
                  {t("messaging.telegram.name")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("messaging.telegram.description")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="tg-token"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.telegram.botToken")}
                </Label>
                <FieldTooltip content={t("tooltips.telegramToken")} />
              </div>
              <SecretInput
                id="tg-token"
                value={get("messaging.telegram.bot_token")}
                onChange={(v) => set("messaging.telegram.bot_token", v, true)}
                placeholder="1234567890:ABCDEFGxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="tg-chat-id"
                  className="text-xs text-muted-foreground"
                >
                  {t("messaging.telegram.chatId")}
                </Label>
                <FieldTooltip content={t("tooltips.telegramChatId")} />
              </div>
              <Input
                id="tg-chat-id"
                value={get("messaging.telegram.chat_id")}
                onChange={(e) =>
                  set("messaging.telegram.chat_id", e.target.value)
                }
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
    </TooltipProvider>
  );
}
