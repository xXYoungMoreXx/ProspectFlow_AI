"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLeadsStore, Lead } from "@/lib/stores/leads-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, GripVertical } from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// S3-06: full funnel with PROSPECTED, APPROVED, NEGOTIATING (S0-03 additions)
const COLUMNS = [
  "PROSPECTED",
  "APPROVED",
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "NEGOTIATING",
  "CONVERTED",
  "LOST",
] as const;
type ColumnType = (typeof COLUMNS)[number];

const statusColors: Record<string, string> = {
  PROSPECTED: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  APPROVED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  NEW: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  CONTACTED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  QUALIFIED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  NEGOTIATING: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  CONVERTED: "bg-primary/10 text-primary border-primary/20",
  LOST: "bg-destructive/10 text-destructive border-destructive/20",
};

// Sortable Item Component
function SortableLeadCard({
  lead,
  columnLabel,
}: {
  lead: Lead;
  columnLabel: string;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: "Lead", lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={() => { if (!isDragging) router.push(`/leads/${lead.id}`); }}
      className="mb-3 cursor-pointer"
    >
      <Card className="group border-border/50 hover:border-primary/30 hover:shadow-sm transition-all bg-card/50 backdrop-blur-sm relative">
        {/* Drag handle isolated so DnD sensors don't intercept card scroll or click */}
        <div
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40" />
        </div>
        <CardContent className="py-3 px-4 pl-6">
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">
              {lead.contactName || "Unknown"}
            </p>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {lead.contactCompany && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" />
                  {lead.contactCompany}
                </span>
              )}
            </div>
            <div className="mt-1 flex justify-end">
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 ${statusColors[lead.status] || ""}`}
              >
                {columnLabel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeadsPage() {
  const t = useTranslations("leads");
  const token = useAuthStore((s) => s.token);
  const { leads, isLoading, fetchLeads, updateLeadStatus } = useLeadsStore();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (token) {
      fetchLeads();
    }
  }, [token, fetchLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead as Lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLeadData = leads.find((l) => l.id === activeId);

    // Check if we dragged over a column container or another item
    const isOverColumn = COLUMNS.includes(overId as ColumnType);

    let targetStatus: Lead["status"];

    if (isOverColumn) {
      targetStatus = overId as Lead["status"];
    } else {
      const overLeadData = leads.find((l) => l.id === overId);
      if (!overLeadData) return;
      targetStatus = overLeadData.status;
    }

    if (activeLeadData && activeLeadData.status !== targetStatus) {
      // Optimistic update + API call
      updateLeadStatus(activeId, targetStatus);
    }
  };

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="w-12 h-12 bg-muted rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-[200px]"></div>
            <div className="h-4 bg-muted rounded w-[150px]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-shrink-0 items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/leads/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t("newLead")}
          </Button>
        </Link>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const columnLeads = leads.filter((l) => l.status === col);
            const columnLabel = t(`columns.${col}`);

            return (
              <div
                key={col}
                className="flex flex-col flex-shrink-0 w-80 bg-muted/30 rounded-xl border border-border/50"
              >
                <div className="p-3 border-b border-border/50 flex items-center justify-between bg-card/50 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${statusColors[col]?.split(" ")[0] || "bg-muted"}`}
                    />
                    <h3 className="font-semibold text-sm tracking-tight">
                      {columnLabel}
                    </h3>
                  </div>
                  <Badge variant="secondary" className="bg-background">
                    {columnLeads.length}
                  </Badge>
                </div>

                {/* Column Drop Zone */}
                <div className="flex-1 p-3 overflow-y-auto">
                  <SortableContext
                    id={col}
                    items={columnLeads.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="min-h-[200px]">
                      {columnLeads.map((lead) => (
                        <SortableLeadCard
                          key={lead.id}
                          lead={lead as Lead}
                          columnLabel={columnLabel}
                        />
                      ))}
                      {columnLeads.length === 0 && (
                        <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg">
                          <p className="text-xs text-muted-foreground text-center px-4">
                            {t("dropHere")}
                          </p>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="w-80 opacity-90 rotate-2 scale-105 transition-transform cursor-grabbing shadow-xl">
              <Card className="border-primary/50 bg-card">
                <CardContent className="py-3 px-4 pl-6">
                  <div className="flex flex-col gap-2">
                    <p className="font-medium text-sm">
                      {activeLead.contactName || "Unknown"}
                    </p>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {activeLead.contactCompany && (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" />
                          {activeLead.contactCompany}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex justify-end">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${statusColors[activeLead.status] || ""}`}
                      >
                        {t(`columns.${activeLead.status}`)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
