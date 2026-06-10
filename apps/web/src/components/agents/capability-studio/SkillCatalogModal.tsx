"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SERVICE_TYPE_LABELS, SERVICE_TYPES } from "@agentepro/shared-types";
import { useAuthStore } from "@/lib/stores/auth-store";

interface CatalogSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  skillType: string;
  serviceTypes: string[];
  isBuiltin: boolean;
}

interface Props {
  agentId: string;
  open: boolean;
  onClose: () => void;
  onAdd: (catalogSkillId: string) => Promise<void>;
}

export function SkillCatalogModal({ open, onClose, onAdd }: Props) {
  const token = useAuthStore((s) => s.token);
  const [skills, setSkills] = useState<CatalogSkill[]>([]);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    const params = new URLSearchParams();
    if (serviceFilter) params.set("serviceType", serviceFilter);
    fetch(`/api/v1/skill-catalog?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSkills(d.data ?? []));
  }, [open, serviceFilter, token]);

  const filtered = skills.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Catálogo de Skills</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select
            value={serviceFilter}
            onValueChange={(v) => {
              setServiceFilter(v ?? "");
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {SERVICE_TYPES.map((st) => (
                <SelectItem key={st} value={st}>
                  {SERVICE_TYPE_LABELS[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-y-auto space-y-2 flex-1">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start justify-between p-3 border rounded gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{skill.name}</span>
                  {skill.isBuiltin && (
                    <Badge variant="outline" className="text-xs">
                      builtin
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {skill.skillType}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {skill.description}
                </p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {skill.serviceTypes.map((st) => (
                    <Badge key={st} variant="outline" className="text-xs">
                      {st}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                disabled={adding === skill.id}
                onClick={async () => {
                  setAdding(skill.id);
                  await onAdd(skill.id);
                  setAdding(null);
                }}
              >
                {adding === skill.id ? "…" : "+ Add"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
