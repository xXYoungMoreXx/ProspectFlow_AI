"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SkillCatalogModal } from "../SkillCatalogModal";
import { useAuthStore } from "@/lib/stores/auth-store";

interface AgentSkill {
  id: string;
  name: string;
  skillType: string;
  isEnabled: boolean;
}

export function SkillsTab({ agentId }: { agentId: string }) {
  const token = useAuthStore((s) => s.token);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/agents/${agentId}/skills`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSkills(d.data ?? []));
  }, [agentId, token]);

  const handleAddFromCatalog = async (catalogSkillId: string) => {
    if (!token) return;
    const res = await fetch(`/api/v1/agents/${agentId}/skills/from-catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ catalogSkillId }),
    });
    const data = (await res.json()) as { data?: AgentSkill };
    if (data.data) setSkills((p) => [...p, data.data!]);
    setCatalogOpen(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Skills Ativas ({skills.length})</h3>
        <Button size="sm" onClick={() => setCatalogOpen(true)}>
          + Add do Catálogo
        </Button>
      </div>
      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center justify-between p-3 border rounded"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={skill.isEnabled}
                onCheckedChange={() => undefined}
              />
              <span className="font-medium">{skill.name}</span>
              <Badge variant="secondary" className="text-xs">
                {skill.skillType}
              </Badge>
            </div>
          </div>
        ))}
        {skills.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma skill. Adicione do catálogo.
          </p>
        )}
      </div>
      <SkillCatalogModal
        agentId={agentId}
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAdd={handleAddFromCatalog}
      />
    </div>
  );
}
