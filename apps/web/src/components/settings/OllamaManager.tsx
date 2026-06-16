"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Download,
  Zap,
  ZapOff,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOllamaStore } from "@/lib/stores/ollama-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

const CTX_OPTIONS = [2048, 4096, 8192, 16384, 32768];

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}

function ProgressBar({ percent }: Readonly<{ percent: number }>) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function OllamaManager() {
  const t = useTranslations("settings");
  const {
    status,
    models,
    pullProgress,
    isLoadingStatus,
    isLoadingModels,
    fetchStatus,
    fetchModels,
    pullModel,
    deleteModel,
    clearPull,
  } = useOllamaStore();

  const { getValue, setPending, settings, fetchSettings } = useSettingsStore();

  const [modelInput, setModelInput] = useState("");
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchModels();
    if (settings.length === 0) fetchSettings();
  }, [fetchStatus, fetchModels, fetchSettings, settings.length]);

  const getParam = (key: string) => getValue(`llm.ollama.${key}`) ?? "";

  const setParam = (key: string, value: string) =>
    setPending({
      key: `llm.ollama.${key}`,
      category: "llm",
      value,
      isSecret: false,
    });

  const activeModel = getParam("default_model");

  const handlePull = () => {
    const name = modelInput.trim();
    if (!name) return;
    setModelInput("");
    pullModel(name);
  };

  const handleDelete = async (name: string) => {
    setDeletingModel(name);
    try {
      await deleteModel(name);
      if (activeModel === name) setParam("default_model", "");
    } finally {
      setDeletingModel(null);
    }
  };

  const isPulling =
    pullProgress?.status === "queued" ||
    pullProgress?.status === "downloading" ||
    pullProgress?.status === "verifying";

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-2 w-2 rounded-full ${
              status?.reachable
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                : "bg-red-400"
            }`}
          />
          <span className="text-sm font-medium">
            {status?.reachable ? t("ollama.online") : t("ollama.unreachable")}
          </span>
          {status?.version && (
            <Badge variant="secondary" className="text-xs font-mono">
              v{status.version}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          {status?.gpuAvailable ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
              <span>{status.gpuName ?? "GPU"}</span>
              {status.vramFree != null && (
                <span className="text-muted-foreground">
                  ({formatBytes(status.vramFree)} free)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ZapOff className="h-3.5 w-3.5" />
              <span>{t("ollama.cpuOnly")}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              fetchStatus();
              fetchModels();
            }}
            disabled={isLoadingStatus || isLoadingModels}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingStatus || isLoadingModels ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Diagnostic panel — only when Ollama is unreachable */}
      {status !== null && !status.reachable && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">
                {t("ollama.unreachableTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("ollama.unreachableSubtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {/* Causa 1 */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <p className="text-xs font-medium text-foreground">
                  {t("ollama.cause1")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                {t("ollama.cause1Fix")}
              </p>
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 pl-5 text-xs text-primary underline underline-offset-2"
              >
                {t("ollama.downloadLink")}
              </a>
            </div>

            {/* Causa 2 */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <p className="text-xs font-medium text-foreground">
                  {t("ollama.cause2")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                {t("ollama.cause2Fix")}
              </p>
              <code className="ml-5 text-xs font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/40 inline-block">
                ollama serve
              </code>
            </div>

            {/* Causa 3 */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                <p className="text-xs font-medium text-foreground">
                  {t("ollama.cause3")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                {t("ollama.cause3Fix")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pull model */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          {t("ollama.pullModel")}
        </Label>
        <p className="text-xs text-muted-foreground">
          Enter a model from{" "}
          <a
            href="https://ollama.com/library"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            ollama.com/library
          </a>{" "}
          (e.g. <span className="font-mono">llama3.2:3b</span>,{" "}
          <span className="font-mono">qwen2.5:7b</span>)
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={t("ollama.pullPlaceholder")}
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePull()}
            disabled={isPulling}
            className="font-mono text-sm"
          />
          <Button
            onClick={handlePull}
            disabled={isPulling || !modelInput.trim() || !status?.reachable}
            className="gap-1.5 min-w-[90px]"
          >
            {isPulling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("ollama.pull")}
          </Button>
        </div>

        {pullProgress && (
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-foreground truncate max-w-[200px]">
                {pullProgress.modelName}
              </span>
              <div className="flex items-center gap-2">
                {pullProgress.status === "done" && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    Done
                  </Badge>
                )}
                {pullProgress.status === "error" && (
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                )}
                {isPulling && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {pullProgress.status}
                  </Badge>
                )}
                <button
                  onClick={clearPull}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {isPulling && (
              <>
                <ProgressBar percent={pullProgress.percent ?? 0} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBytes(pullProgress.completed ?? 0)} /{" "}
                    {formatBytes(pullProgress.total ?? 0)}
                  </span>
                  <span>{pullProgress.percent ?? 0}%</span>
                </div>
              </>
            )}

            {pullProgress.error && (
              <p className="text-xs text-destructive">{pullProgress.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Installed models */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          {t("ollama.installed")}
        </Label>

        {isLoadingModels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : models.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center py-8 gap-2">
            <Cpu className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t("ollama.noModels")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
            {models.map((model) => {
              const isActive = activeModel === model.name;
              const rowCls = isActive
                ? "flex items-center justify-between px-4 py-3 transition-colors bg-primary/5"
                : "flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/30";
              return (
                <div key={model.name} className={rowCls}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Cpu
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono font-medium truncate">
                          {model.name}
                        </p>
                        {isActive && (
                          <Badge className="h-4 px-1.5 text-xs bg-primary/15 text-primary border-primary/25">
                            {t("ollama.active")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {model.details?.parameterSize && (
                          <span className="text-xs text-muted-foreground">
                            {model.details.parameterSize}
                          </span>
                        )}
                        {model.details?.quantizationLevel && (
                          <Badge
                            variant="secondary"
                            className="text-xs h-4 px-1"
                          >
                            {model.details.quantizationLevel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(model.size)}
                    </div>

                    {isActive ? (
                      <div className="flex items-center gap-1 text-xs text-primary px-2">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => setParam("default_model", model.name)}
                        disabled={!status?.reachable}
                      >
                        {t("ollama.setActive")}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(model.name)}
                      disabled={deletingModel === model.name}
                    >
                      {deletingModel === model.name ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inference parameters */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
          onClick={() => setShowParams((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            {t("ollama.inferenceParams")}
            {activeModel && (
              <span className="text-xs text-muted-foreground font-mono">
                ({activeModel})
              </span>
            )}
          </div>
          {showParams ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showParams && (
          <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4">
            {/* Context window */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("ollama.contextWindow")}
              </Label>
              <select
                value={getParam("num_ctx") || "4096"}
                onChange={(e) => setParam("num_ctx", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CTX_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()} tokens
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("ollama.temperature")}
                  <span className="ml-1.5 font-mono text-foreground">
                    {getParam("temperature") || "0.7"}
                  </span>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={getParam("temperature") || "0.7"}
                  onChange={(e) => setParam("temperature", e.target.value)}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>2.0</span>
                </div>
              </div>

              {/* Top-p */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("ollama.topP")}
                  <span className="ml-1.5 font-mono text-foreground">
                    {getParam("top_p") || "0.9"}
                  </span>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={getParam("top_p") || "0.9"}
                  onChange={(e) => setParam("top_p", e.target.value)}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.0</span>
                  <span>1.0</span>
                </div>
              </div>
            </div>

            {/* Max tokens */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("ollama.maxTokens")}
              </Label>
              <Input
                type="number"
                min={1}
                max={32768}
                placeholder="-1 (unlimited)"
                value={getParam("num_predict") || ""}
                onChange={(e) => setParam("num_predict", e.target.value)}
                className="text-sm font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
