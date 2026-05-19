"use client";

import { useEffect } from "react";
import { Loader2, Save, RotateCcw, Bot, MessageCircle, Puzzle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AIProvidersTab } from "@/components/settings/AIProvidersTab";
import { MessagingTab } from "@/components/settings/MessagingTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { SystemTab } from "@/components/settings/SystemTab";
import { useSettingsStore } from "@/lib/stores/settings-store";

export default function SettingsPage() {
  const { pending, isSaving, error, saveSettings, clearPending, fetchSettings } =
    useSettingsStore();

  const pendingCount = pending.size;
  const hasPending = pendingCount > 0;

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure AI providers, messaging channels, and integrations — no{" "}
            <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">.env</code>{" "}
            editing required
          </p>
        </div>

        {/* Save bar */}
        {hasPending && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in slide-in-from-right-4 duration-200">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs tabular-nums"
            >
              {pendingCount} unsaved
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={clearPending}
              disabled={isSaving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={saveSettings}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ai" className="space-y-5">
        <TabsList className="h-10 gap-1 bg-muted/50 p-1">
          <TabsTrigger
            value="ai"
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Bot className="h-3.5 w-3.5" />
            AI Providers
          </TabsTrigger>
          <TabsTrigger
            value="messaging"
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Messaging
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Puzzle className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings2 className="h-3.5 w-3.5" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-0 space-y-0">
          <AIProvidersTab />
        </TabsContent>

        <TabsContent value="messaging" className="mt-0 space-y-0">
          <MessagingTab />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0 space-y-0">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="system" className="mt-0 space-y-0">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
