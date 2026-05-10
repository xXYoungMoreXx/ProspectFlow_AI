'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your platform preferences</p>
      </div>

      <div className="border border-dashed border-border/50 rounded-xl bg-card/30 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Settings className="w-10 h-10 text-muted-foreground/50" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Coming soon</h3>
            <p className="text-sm text-muted-foreground mt-1">Settings page will be available in the next release</p>
          </div>
        </div>
      </div>
    </div>
  );
}
