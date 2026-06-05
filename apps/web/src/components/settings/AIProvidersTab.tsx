"use client";

import { useEffect } from "react";
import { Bot, Cpu, HelpCircle, Video } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SecretInput } from "@/components/ui/secret-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    defaultModel: "gpt-4.1-mini",
    models: [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "o4-mini",
      "o3",
      "o3-pro",
    ],
  },
  {
    id: "anthropic",
    category: "llm",
    keyField: "llm.anthropic.api_key",
    keyPlaceholder: "sk-ant-••••••••••••",
    modelField: "llm.anthropic.default_model",
    defaultModel: "claude-sonnet-4-6",
    models: [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ],
  },
  {
    id: "google",
    category: "llm",
    keyField: "llm.gemini.api_key",
    keyPlaceholder: "AIza••••••••••••••",
    modelField: "llm.gemini.default_model",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    id: "groq",
    category: "llm",
    keyField: "llm.groq.api_key",
    keyPlaceholder: "gsk_••••••••••••••••",
    modelField: "llm.groq.default_model",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.3-70b-specdec",
      "gemma2-9b-it",
      "compound-beta",
    ],
    hasBadge: true,
  },
  {
    id: "deepseek",
    category: "llm",
    keyField: "llm.deepseek.api_key",
    keyPlaceholder: "sk-••••••••••••••••",
    modelField: "llm.deepseek.default_model",
    defaultModel: "deepseek-v4-pro",
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
  },
  {
    id: "openrouter",
    category: "llm",
    keyField: "llm.openrouter.api_key",
    keyPlaceholder: "sk-or-••••••••••••••",
    modelField: "llm.openrouter.default_model",
    defaultModel: "anthropic/claude-sonnet-4-6",
    models: [
      "anthropic/claude-opus-4-8",
      "anthropic/claude-sonnet-4-6",
      "openai/gpt-4.1",
      "openai/o4-mini",
      "openai/o3",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-v4-flash",
      "x-ai/grok-3",
      "qwen/qwen3-235b-a22b",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
];

interface VideoProviderConfig {
  id: string;
  keyField: string;
  keyPlaceholder: string;
  urlField?: string;
  modelField?: string;
  defaultModel?: string;
  models?: string[];
}

const VIDEO_PROVIDERS: VideoProviderConfig[] = [
  {
    id: "heygen",
    keyField: "media.heygen.api_key",
    keyPlaceholder: "••••••••••••••••••••••••••••••••",
  },
  {
    id: "higgsfield",
    keyField: "media.higgsfield.api_key",
    keyPlaceholder: "hf-••••••••••••••••",
  },
  {
    id: "seedance",
    keyField: "media.seedance.api_key",
    keyPlaceholder: "sk-••••••••••••••••",
    modelField: "media.seedance.default_model",
    defaultModel: "seedance-1.0-pro",
    models: ["seedance-1.0-pro", "seedance-1.0-lite"],
  },
  {
    id: "remotion",
    keyField: "media.remotion.api_key",
    keyPlaceholder: "rmtn-••••••••••••••••",
    urlField: "media.remotion.serve_url",
  },
];

function FieldTooltip({ content }: { content: string }) {
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

  const setMedia = (key: string, value: string, isSecret = false) =>
    setPending({ key, category: "media", value, isSecret });

  return (
    <TooltipProvider delayDuration={300}>
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
                      <FieldTooltip
                        content={t(`aiProviders.${provider.id}.description`)}
                      />
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      {t(`aiProviders.${provider.id}.description`)}
                    </CardDescription>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Switch
                      checked={isEnabled(provider.id)}
                      onCheckedChange={(v) => toggleEnabled(provider.id, v)}
                      aria-label={t(`aiProviders.${provider.id}.name`)}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className="max-w-[220px] text-xs leading-relaxed"
                  >
                    {t("tooltips.enableProvider")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor={`${provider.id}-key`}
                    className="text-xs text-muted-foreground"
                  >
                    {t(`aiProviders.${provider.id}.apiKey`)}
                  </Label>
                  <FieldTooltip content={t("tooltips.apiKey")} />
                </div>
                <SecretInput
                  id={`${provider.id}-key`}
                  value={get(provider.keyField)}
                  onChange={(v) => set(provider.keyField, v, true)}
                  placeholder={provider.keyPlaceholder}
                  disabled={!isEnabled(provider.id)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor={`${provider.id}-model`}
                    className="text-xs text-muted-foreground"
                  >
                    {t(`aiProviders.${provider.id}.defaultModel`)}
                  </Label>
                  <FieldTooltip content={t("tooltips.defaultModel")} />
                </div>
                <Select
                  value={get(provider.modelField) || provider.defaultModel}
                  onValueChange={(v) => set(provider.modelField, v)}
                  disabled={!isEnabled(provider.id)}
                >
                  <SelectTrigger
                    id={`${provider.id}-model`}
                    className="w-full h-9 text-sm font-mono"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provider.models.map((m) => (
                      <SelectItem
                        key={m}
                        value={m}
                        className="font-mono text-sm"
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Video Generation section */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-xs font-medium text-muted-foreground px-1">
            {t("aiProviders.videoSection")}
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {VIDEO_PROVIDERS.map((vp) => {
          const urlField = vp.urlField;
          const modelField = vp.modelField;
          const models = vp.models;
          return (
            <Card key={vp.id} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Video className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">
                        {t(`aiProviders.${vp.id}.name`)}
                      </CardTitle>
                      <FieldTooltip
                        content={t(`aiProviders.${vp.id}.description`)}
                      />
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      {t(`aiProviders.${vp.id}.description`)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label
                      htmlFor={`${vp.id}-key`}
                      className="text-xs text-muted-foreground"
                    >
                      {t(`aiProviders.${vp.id}.apiKey`)}
                    </Label>
                    <FieldTooltip content={t("tooltips.apiKey")} />
                  </div>
                  <SecretInput
                    id={`${vp.id}-key`}
                    value={get(vp.keyField)}
                    onChange={(v) => setMedia(vp.keyField, v, true)}
                    placeholder={vp.keyPlaceholder}
                  />
                </div>

                {urlField !== undefined && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`${vp.id}-url`}
                      className="text-xs text-muted-foreground"
                    >
                      {t(`aiProviders.${vp.id}.serveUrl`)}
                    </Label>
                    <Input
                      id={`${vp.id}-url`}
                      value={get(urlField)}
                      onChange={(e) => setMedia(urlField, e.target.value)}
                      placeholder="https://..."
                      className="text-sm font-mono"
                    />
                  </div>
                )}

                {modelField !== undefined && models !== undefined && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor={`${vp.id}-model`}
                        className="text-xs text-muted-foreground"
                      >
                        {t(`aiProviders.${vp.id}.defaultModel`)}
                      </Label>
                      <FieldTooltip content={t("tooltips.defaultModel")} />
                    </div>
                    <Select
                      value={get(modelField) || vp.defaultModel}
                      onValueChange={(v) => setMedia(modelField, v)}
                    >
                      <SelectTrigger
                        id={`${vp.id}-model`}
                        className="w-full h-9 text-sm font-mono"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem
                            key={m}
                            value={m}
                            className="font-mono text-sm"
                          >
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Ollama local */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">
                    {t("aiProviders.ollama.name")}
                  </CardTitle>
                  <FieldTooltip content={t("aiProviders.ollama.description")} />
                </div>
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
    </TooltipProvider>
  );
}
