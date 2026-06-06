"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Bot,
  Save,
  Sparkles,
  ShieldAlert,
  Cpu,
  UploadCloud,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const AVAILABLE_SKILLS = [
  "web_search",
  "places_search",
  "cnpj_lookup",
  "cnpj_enricher",
  "email_sender",
  "whatsapp_sender",
  "contract_notifier",
  "site_generator",
] as const;

type AgentSkill = (typeof AVAILABLE_SKILLS)[number];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> =
  {
    anthropic: [
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
    openai: [
      { value: "o3", label: "o3" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    google: [
      { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { value: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
    ],
  };

export default function NewAgentPage() {
  const t = useTranslations("agents");
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState("");
  const [persona, setPersona] = useState("HUNTER");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<AgentSkill[]>([]);
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const tokenCount = Math.ceil(
    systemPrompt.split(/\s+/).filter(Boolean).length * 1.3,
  );

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const models = MODELS_BY_PROVIDER[newProvider];
    if (models && models.length > 0) setModel(models[0]!.value);
  };

  const toggleSkill = (skillId: AgentSkill) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    setTimeout(() => {
      const newFiles = Array.from(e.target.files!).map((f) => ({
        name: f.name,
        size: f.size,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      setIsUploading(false);
    }, 1500);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.agents.create(
        {
          name,
          persona,
          llmConfig: { provider, model, temperature: temperature[0] },
          systemPrompt,
          skills: selectedSkills,
        },
        token!,
      ),
    onSuccess: () => router.push("/agents"),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("new.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("new.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* General Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                {t("new.identity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("new.agentName")}</Label>
                <Input
                  id="name"
                  placeholder={t("new.agentNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("new.persona")}</Label>
                <Select
                  value={persona}
                  onValueChange={(v) => v && setPersona(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("new.personaPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUNTER">
                      {t("new.personas.HUNTER")}
                    </SelectItem>
                    <SelectItem value="CLOSER">
                      {t("new.personas.CLOSER")}
                    </SelectItem>
                    <SelectItem value="BUILDER">
                      {t("new.personas.BUILDER")}
                    </SelectItem>
                    <SelectItem value="QA">{t("new.personas.QA")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="prompt">{t("new.systemPrompt")}</Label>
                  <span
                    className={`text-xs ${tokenCount > 6000 ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                  >
                    ~{tokenCount} {t("new.tokens")}
                  </span>
                </div>
                <Textarea
                  id="prompt"
                  placeholder={t("new.systemPromptPlaceholder")}
                  className="min-h-[200px] font-mono text-sm"
                  value={systemPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSystemPrompt(e.target.value)
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  {t("new.systemPromptHint")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* LLM Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="w-5 h-5 text-primary" />
                {t("new.llmConfig")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("new.provider")}</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("new.providerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("new.model")}</Label>
                  <Select value={model} onValueChange={(v) => v && setModel(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("new.modelPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODELS_BY_PROVIDER[provider] ?? []).map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>{t("new.temperature")}</Label>
                  <span className="text-sm text-muted-foreground font-mono">
                    {temperature[0]}
                  </span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={(v) =>
                    setTemperature(Array.isArray(v) ? [...v] : [v])
                  }
                  max={2}
                  step={0.1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("new.tempMin")}</span>
                  <span>{t("new.tempMax")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t("new.knowledgeBase")}
              </CardTitle>
              <CardDescription>{t("new.knowledgeHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 hover:bg-muted/50 transition-colors relative">
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.csv,.md"
                  disabled={isUploading}
                />
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {isUploading ? t("new.uploading") : t("new.uploadCta")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("new.uploadHint")}
                  </p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-sm font-medium">
                    {t("new.uploadedFiles")} ({files.length})
                  </h4>
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded border bg-muted/30 text-sm"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFile(i)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Skills */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                {t("new.agentSkills")}
              </CardTitle>
              <CardDescription>{t("new.skillsHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {AVAILABLE_SKILLS.map((skill) => (
                <div
                  key={skill}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <Switch
                    id={`skill-${skill}`}
                    checked={selectedSkills.includes(skill)}
                    onCheckedChange={() => toggleSkill(skill)}
                  />
                  <div className="space-y-1 mt-[-2px]">
                    <Label
                      htmlFor={`skill-${skill}`}
                      className="font-semibold cursor-pointer"
                    >
                      {t(`new.skillLabels.${skill}`)}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t(`new.skillLabels.${skill}Desc`)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <ShieldAlert className="w-5 h-5" />
                Security Guard
              </div>
              <p className="text-xs text-muted-foreground">
                {t("new.securityNote")}
              </p>
              {createMutation.isError && (
                <p className="text-xs text-destructive">
                  {t("new.deployError")}
                </p>
              )}
              <Button
                onClick={() => createMutation.mutate()}
                className="w-full gap-2 mt-4"
                disabled={!name || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("new.deploying")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("new.deploy")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
