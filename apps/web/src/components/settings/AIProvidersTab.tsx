"use client";

import { useEffect } from "react";
import { Bot, Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SecretInput } from "@/components/ui/secret-input";
import { OllamaManager } from "@/components/settings/OllamaManager";
import {
  TestButton,
  ConnectionBadge,
} from "@/components/settings/ConnectionStatus";
import {
  useSettingsStore,
  type PendingUpdate,
} from "@/lib/stores/settings-store";

interface ProviderConfig {
  id: string;
  category: "llm";
  keyField: string;
  keyPlaceholder: string;
  modelField: string;
  defaultModel: string;
  models: string[];
  hasBadge?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    category: "llm",
    keyField: "llm.openai.api_key",
    keyPlaceholder: "sk-••••••••••••••••",
    modelField: "llm.openai.default_model",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini"],
  },
  {
    id: "anthropic",
    category: "llm",
    keyField: "llm.anthropic.api_key",
    keyPlaceholder: "sk-ant-••••••••••••",
    modelField: "llm.anthropic.default_model",
    defaultModel: "claude-3-5-haiku-20241022",
    models: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
    ],
  },
  {
    id: "google",
    category: "llm",
    keyField: "llm.gemini.api_key",
    keyPlaceholder: "AIza••••••••••••••",
    modelField: "llm.gemini.default_model",
    defaultModel: "gemini-2.0-flash",
    models: [
      "gemini-2.0-flash",
      "gemini-2.0-pro",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
  },
  {
    id: "groq",
    category: "llm",
    keyField: "llm.groq.api_key",
    keyPlaceholder: "gsk_••••••••••••••••",
    modelField: "llm.groq.default_model",
    defaultModel: "llama-3.1-8b-instant",
    models: [
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "mixtral-8x7b-32768",
    ],
    hasBadge: true,
  },
];

export function AIProvidersTab() {
  const t = useTranslations("settings");
  const { settings, pending, setPending, getValue, fetchSettings } =
    useSettingsStore();

  useEffect(() => {
    if (settings.length === 0) fetchSettings();
  }, [settings.length, fetchSettings]);

  const get = (key: string) => {
    const pendingVal = pending.get(key)?.value;
    return pendingVal !== undefined ? pendingVal : (getValue(key) ?? "");
  };

  const set = (key: string, value: string, isSecret = false) => {
    const update: PendingUpdate = {
      key,
      category: "llm",
      value,
      isSecret,
    };
    setPending(update);
  };

  const isEnabled = (providerId: string) =>
    get(`llm.${providerId}.enabled`) !== "false";

  const toggleEnabled = (providerId: string, enabled: boolean) => {
    set(`llm.${providerId}.enabled`, String(enabled));
  };

  return (
    <div className="space-y-4">
      {/* Cloud providers */}
      {PROVIDERS.map((provider) => (
        <Card
          key={provider.id}
          className={`border-border/60 transition-opacity ${
            !isEnabled(provider.id) ? "opacity-60" : ""
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">
                      {t(`aiProviders.${provider.id}.name`)}
                    </CardTitle>
                    {provider.hasBadge && (
                      <Badge
                        variant="secondary"
                        className="text-xs h-4 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20"
                      >
                        {t(`aiProviders.${provider.id}.fastBadge`)}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    {t(`aiProviders.${provider.id}.description`)}
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={isEnabled(provider.id)}
                onCheckedChange={(v) => toggleEnabled(provider.id, v)}
                aria-label={t(`aiProviders.${provider.id}.name`)}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <Label
                htmlFor={`${provider.id}-key`}
                className="text-xs text-muted-foreground"
              >
                {t(`aiProviders.${provider.id}.apiKey`)}
              </Label>
              <SecretInput
                id={`${provider.id}-key`}
                value={get(provider.keyField)}
                onChange={(v) => set(provider.keyField, v, true)}
                placeholder={provider.keyPlaceholder}
                disabled={!isEnabled(provider.id)}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor={`${provider.id}-model`}
                className="text-xs text-muted-foreground"
              >
                {t(`aiProviders.${provider.id}.defaultModel`)}
              </Label>
              <select
                id={`${provider.id}-model`}
                value={get(provider.modelField) || provider.defaultModel}
                onChange={(e) => set(provider.modelField, e.target.value)}
                disabled={!isEnabled(provider.id)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {provider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <TestButton
                category={`llm_${provider.id}`}
                disabled={!isEnabled(provider.id)}
              />
              <ConnectionBadge category={`llm_${provider.id}`} />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Ollama local */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm">
                {t("aiProviders.ollama.name")}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {t("aiProviders.ollama.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <OllamaManager />
        </CardContent>
      </Card>
    </div>
  );
}
