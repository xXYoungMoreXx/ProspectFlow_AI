"use client";

import { Loader2, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/stores/settings-store";

interface ConnectionBadgeProps {
  category: string;
}

export function ConnectionBadge({ category }: ConnectionBadgeProps) {
  const { connections } = useSettingsStore();
  const conn = connections[category];

  if (!conn || conn.status === "idle") return null;

  if (conn.status === "testing") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Testing…
      </span>
    );
  }

  if (conn.status === "ok") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {conn.message ?? "Connected"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5" />
      {conn.message ?? "Failed"}
    </span>
  );
}

interface TestButtonProps {
  category: string;
  disabled?: boolean;
}

export function TestButton({ category, disabled }: TestButtonProps) {
  const { testConnection, connections } = useSettingsStore();
  const isTesting = connections[category]?.status === "testing";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs h-8"
      disabled={disabled || isTesting}
      onClick={() => testConnection(category)}
    >
      {isTesting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FlaskConical className="h-3.5 w-3.5" />
      )}
      Test
    </Button>
  );
}
