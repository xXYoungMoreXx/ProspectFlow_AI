"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Download,
  Zap,
  ZapOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOllamaStore } from "@/lib/stores/ollama-store";

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}

function ProgressBar({ percent }: { percent: number }) {
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

  const [modelInput, setModelInput] = useState("");
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchModels();
  }, [fetchStatus, fetchModels]);

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
              className={`h-3.5 w-3.5 ${
                isLoadingStatus || isLoadingModels ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Pull model */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t("ollama.pullModel")}
        </label>
        <p className="text-xs text-muted-foreground">
          Enter a model name from{" "}
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

        {/* Pull progress */}
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
        <label className="text-sm font-medium text-foreground">
          {t("ollama.installed")}
        </label>

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
            {models.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium truncate">
                      {model.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {model.details?.parameterSize && (
                        <span className="text-xs text-muted-foreground">
                          {model.details.parameterSize}
                        </span>
                      )}
                      {model.details?.quantizationLevel && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          {model.details.quantizationLevel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <HardDrive className="h-3 w-3" />
                    {formatBytes(model.size)}
                  </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
