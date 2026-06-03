# S5-06 Frontend Pages + Briefing Extract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add POST /briefings/:id/extract fallback endpoint + 4 frontend pages (/projects/[id], /briefings, /prospecting, /agents/[id]) + sidebar nav links + card navigation.

**Architecture:** Backend-first. Extract route validates briefing state (IN_PROGRESS), reads Redis transcript list, dispatches to Python runtime directly (same pattern as whatsapp.webhook.routes.ts). Frontend pages follow existing "use client" + useQuery + Card/Badge/Tabs pattern. No new design tokens or fonts.

**Tech Stack:** Node.js 22 + Fastify 5 + Drizzle + ioredis — API. Next.js 15 App Router + Tailwind 4 + shadcn/ui + React Query — Web. Vitest unit tests.

---

## File Map

**Create:**

- `apps/api/src/application/briefing/ExtractBriefingUseCase.ts`
- `apps/web/src/app/(dashboard)/projects/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/briefings/page.tsx`
- `apps/web/src/app/(dashboard)/prospecting/page.tsx`
- `apps/web/src/app/(dashboard)/agents/[id]/page.tsx`

**Modify:**

- `apps/api/src/http/routes/briefings.routes.ts` — add POST /:id/extract
- `apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts` — add ExtractBriefingUseCase tests
- `apps/web/src/lib/api.ts` — add api.briefings, api.prospecting, api.agents.update
- `apps/web/src/app/(dashboard)/layout.tsx` — add Briefings + Prospecting to navItems
- `apps/web/src/app/(dashboard)/projects/page.tsx` — wrap cards with Link
- `apps/web/src/app/(dashboard)/agents/page.tsx` — wrap cards with Link

---

## Task 1: ExtractBriefingUseCase — application layer

**Files:**

- Create: `apps/api/src/application/briefing/ExtractBriefingUseCase.ts`
- Modify: `apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts`

**Important:** `BriefingStatus` is `"IN_PROGRESS" | "COMPLETED" | "APPROVED"`.
Extract is only allowed when status is `"IN_PROGRESS"` (briefing collecting WhatsApp messages).
Transcript Redis key: `whatsapp:transcript:{briefingId}` (list, each entry is JSON `{ from, body, timestamp }`).

- [ ] **Step 1.1: Write failing tests**

Append to `apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts`:

```typescript
import { ExtractBriefingUseCase } from "../ExtractBriefingUseCase.js";
import type { Redis } from "ioredis";

// Add this describe block at the end of the file (after ListBriefingsQuery describe)

describe("ExtractBriefingUseCase", () => {
  let repo: Mocked<BriefingRepository>;
  let redis: Mocked<Pick<Redis, "lrange">>;
  let uc: ExtractBriefingUseCase;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByDealId: vi.fn(),
      listByOperator: vi.fn(),
      save: vi.fn(),
    };
    redis = { lrange: vi.fn() } as unknown as Mocked<Pick<Redis, "lrange">>;
    uc = new ExtractBriefingUseCase(repo, redis as unknown as Redis);
  });

  function makeInProgressBriefing() {
    const b = Briefing.create({
      id: randomUUID(),
      dealId: randomUUID(),
      operatorId: "op-1",
    }).unwrap();
    b.clearDomainEvents();
    return b;
  }

  it("returns transcript when briefing is IN_PROGRESS and transcript exists", async () => {
    const briefing = makeInProgressBriefing();
    repo.findById.mockResolvedValue(briefing);
    redis.lrange.mockResolvedValue([
      JSON.stringify({
        from: "+5511999990000",
        body: "sim",
        timestamp: "2026-06-02T10:00:00.000Z",
      }),
    ]);

    const result = await uc.execute({
      briefingId: briefing.id,
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().transcript).toContain("sim");
    expect(redis.lrange).toHaveBeenCalledWith(
      `whatsapp:transcript:${briefing.id}`,
      0,
      -1,
    );
  });

  it("returns NOT_FOUND when briefing does not exist", async () => {
    repo.findById.mockResolvedValue(null);

    const result = await uc.execute({
      briefingId: randomUUID(),
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("NOT_FOUND");
  });

  it("returns INVALID_STATE when briefing is not IN_PROGRESS", async () => {
    const briefing = makeBriefing("COMPLETED");
    repo.findById.mockResolvedValue(briefing);

    const result = await uc.execute({
      briefingId: briefing.id,
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("INVALID_STATE");
  });

  it("returns VALIDATION_ERROR when transcript is empty in Redis", async () => {
    const briefing = makeInProgressBriefing();
    repo.findById.mockResolvedValue(briefing);
    redis.lrange.mockResolvedValue([]);

    const result = await uc.execute({
      briefingId: briefing.id,
      operatorId: "op-1",
      correlationId: randomUUID(),
    });

    expect(result.isErr()).toBe(true);
    expect(errCode(result)).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 1.2: Run tests — verify they fail**

```bash
npx vitest run apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts --root apps/api -t "ExtractBriefingUseCase"
```

Expected: FAIL with "Cannot find module '../ExtractBriefingUseCase.js'"

- [ ] **Step 1.3: Implement ExtractBriefingUseCase**

Create `apps/api/src/application/briefing/ExtractBriefingUseCase.ts`:

```typescript
import type { BriefingRepository } from "../../domain/briefing/BriefingRepository.js";
import { NotFoundError, DomainError } from "../../domain/shared/Result.js";
import { type Result, ok, err } from "../../domain/shared/Result.js";
import type { Redis } from "ioredis";

export interface ExtractBriefingCommand {
  briefingId: string;
  operatorId: string;
  correlationId: string;
}

export interface ExtractBriefingResult {
  briefingId: string;
  transcript: string;
}

export class ExtractBriefingUseCase {
  constructor(
    private readonly repo: BriefingRepository,
    private readonly redis: Redis,
  ) {}

  async execute(
    cmd: ExtractBriefingCommand,
  ): Promise<Result<ExtractBriefingResult, Error>> {
    const briefing = await this.repo.findById(cmd.briefingId, cmd.operatorId);
    if (!briefing) {
      return err(new NotFoundError("Briefing", cmd.briefingId));
    }

    if (briefing.status !== "IN_PROGRESS") {
      return err(
        new DomainError(
          `Cannot extract: briefing status is ${briefing.status}, expected IN_PROGRESS`,
          "INVALID_STATE",
          { briefingId: cmd.briefingId, status: briefing.status },
        ),
      );
    }

    const rawEntries = await this.redis.lrange(
      `whatsapp:transcript:${cmd.briefingId}`,
      0,
      -1,
    );

    if (rawEntries.length === 0) {
      return err(
        new DomainError(
          "No transcript found in Redis for this briefing",
          "VALIDATION_ERROR",
          { briefingId: cmd.briefingId },
        ),
      );
    }

    const transcript = rawEntries
      .map((raw: string) => {
        try {
          const parsed = JSON.parse(raw) as {
            from: string;
            body: string;
            timestamp: string;
          };
          return `[${parsed.timestamp}] ${parsed.from}: ${parsed.body}`;
        } catch {
          return raw;
        }
      })
      .join("\n");

    return ok({ briefingId: cmd.briefingId, transcript });
  }
}
```

- [ ] **Step 1.4: Run tests — verify they pass**

```bash
npx vitest run apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts --root apps/api -t "ExtractBriefingUseCase"
```

Expected: PASS (4 tests)

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/src/application/briefing/ExtractBriefingUseCase.ts apps/api/src/application/briefing/__tests__/briefing.usecases.test.ts
git commit -m "$(cat <<'EOF'
feat(briefing): add ExtractBriefingUseCase for manual transcript extraction

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: POST /briefings/:id/extract route

**Files:**

- Modify: `apps/api/src/http/routes/briefings.routes.ts`

The route: calls `ExtractBriefingUseCase` → gets transcript → dispatches to Python runtime directly (same pattern as `whatsapp.webhook.routes.ts` — `agent_id: "system"`).

- [ ] **Step 2.1: Add the route to briefings.routes.ts**

In `apps/api/src/http/routes/briefings.routes.ts`, add import at top (after existing imports):

```typescript
import { ExtractBriefingUseCase } from "../../application/briefing/ExtractBriefingUseCase.js";
```

Then add this route inside `briefingRoutes` function, after the `POST /:id/assets` route (before the closing `}`):

```typescript
// POST /api/v1/briefings/:id/extract — manual fallback for operators when WhatsApp fails
app.post<{ Params: { id: string } }>("/:id/extract", async (request, reply) => {
  const uc = new ExtractBriefingUseCase(
    app.container.briefingRepo,
    app.container.redis,
  );
  const result = await uc.execute({
    briefingId: request.params.id,
    operatorId: request.operatorId,
    correlationId: request.requestId,
  });

  if (result.isErr()) {
    const e = result.error as DomainError;
    return reply.status(domainErrToHttp(e.code)).send({
      errors: [
        { code: e.code, message: e.message, requestId: request.requestId },
      ],
    });
  }

  const { briefingId, transcript } = result.unwrap();

  // Dispatch to Python runtime — same pattern as whatsapp.webhook.routes.ts
  const runtimeUrl =
    process.env["PYTHON_RUNTIME_URL"] ?? "http://localhost:8001";

  try {
    await fetch(`${runtimeUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: "briefing.extract",
        agent_id: "system",
        correlation_id: request.requestId,
        payload: { briefingId, transcript },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (fetchErr) {
    request.log.warn(
      { err: fetchErr, briefingId },
      "briefing_extract_runtime_dispatch_failed",
    );
  }

  return reply.status(200).send({
    data: { briefingId, status: "queued" },
    meta: {
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    },
  });
});
```

- [ ] **Step 2.2: Run typecheck**

```bash
npm run typecheck -w @agentepro/api
```

Expected: no errors

- [ ] **Step 2.3: Commit**

```bash
git add apps/api/src/http/routes/briefings.routes.ts
git commit -m "$(cat <<'EOF'
feat(briefing): add POST /briefings/:id/extract manual fallback endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend API client additions

**Files:**

- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 3.1: Add briefings, prospecting, agents.update to api.ts**

In `apps/web/src/lib/api.ts`, find the `agents:` section (around line 99):

Replace:

```typescript
  agents: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/agents", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>("/agents", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
  },
```

With:

```typescript
  agents: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/agents", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, { token }),
    create: (data: any, token: string) =>
      request<{ data: any; meta: any }>("/agents", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    update: (id: string, data: any, token: string) =>
      request<{ data: any; meta: any }>(`/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
  },
```

Then, after the `projects:` section, add before `hitl:`:

```typescript
  briefings: {
    list: (token: string) =>
      request<{ data: any[]; meta: any }>("/briefings", { token }),
    getById: (id: string, token: string) =>
      request<{ data: any; meta: any }>(`/briefings/${id}`, { token }),
    extract: (id: string, token: string) =>
      request<{ data: { briefingId: string; status: string } }>(
        `/briefings/${id}/extract`,
        { method: "POST", body: JSON.stringify({}), token },
      ),
    approve: (id: string, token: string) =>
      request<{ data: any }>(`/briefings/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({}),
        token,
      }),
  },

  prospecting: {
    searchMaps: (
      data: {
        categories: string[];
        region: { city: string; state: string; radiusKm: number };
        minScore?: number;
        limit?: number;
      },
      token: string,
    ) =>
      request<{ data: any; meta: any }>("/prospecting/search-maps", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    queue: (token: string) =>
      request<{ data: { leads: any[] }; meta: any }>("/prospecting/queue", {
        token,
      }),
    getConfig: (token: string) =>
      request<{ data: any }>("/prospecting/config", { token }),
    updateConfig: (data: any, token: string) =>
      request<{ data: any }>("/prospecting/config", {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
  },
```

- [ ] **Step 3.2: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(web): add api.briefings, api.prospecting, api.agents.update to client

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: /projects/[id] — timeline + delivery page

**Files:**

- Create: `apps/web/src/app/(dashboard)/projects/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/page.tsx` — add Link to cards

- [ ] **Step 4.1: Create /projects/[id]/page.tsx**

Create `apps/web/src/app/(dashboard)/projects/[id]/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  Play,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";

const statusColors: Record<string, string> = {
  PENDING: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REVIEW: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REVISION: "bg-destructive/10 text-destructive border-destructive/20",
};

function lighthouseColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-amber-400";
  return "text-destructive";
}

const PIPELINE_STAGES = [
  { key: "created", label: "Project Created" },
  { key: "briefing_approved", label: "Briefing Approved" },
  { key: "builder_started", label: "Builder Started" },
  { key: "staging_approved", label: "Staging Approved" },
  { key: "delivered", label: "Delivered" },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.projects.getById(id, token!),
    enabled: !!token,
  });

  const project = data?.data;

  const lighthouse = project?.lighthouse ?? {};
  const deliverableMeta = project?.deliverableMeta ?? {};
  const videoUrl = (deliverableMeta as any).videoUrl as string | undefined;

  const currentStageIndex = project
    ? project.status === "DELIVERED"
      ? PIPELINE_STAGES.length - 1
      : project.status === "IN_PROGRESS"
        ? 2
        : project.status === "REVIEW"
          ? 3
          : project.status === "PENDING"
            ? 0
            : 4
    : -1;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="animate-pulse h-10 w-48 bg-muted rounded" />
        <div className="animate-pulse h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="animate-pulse h-64 bg-muted rounded-xl" />
          <div className="animate-pulse h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            Project #{id.slice(-8)}
          </h2>
          <Badge
            variant="outline"
            className={`text-xs ${statusColors[project.status] ?? ""}`}
          >
            {project.status}
          </Badge>
        </div>
      </div>

      {/* Hero card — deliverable URL */}
      {project.deliverableUrl ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="py-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Site Entregue
              </p>
              <p className="text-sm text-emerald-400 font-mono break-all">
                {project.deliverableUrl}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Play className="w-4 h-4" />
                    Tutorial
                  </Button>
                </a>
              )}
              <a
                href={project.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Site
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Site not yet delivered — pipeline in progress.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {PIPELINE_STAGES.map((stage, index) => {
                const isDone = index <= currentStageIndex;
                const isActive = index === currentStageIndex;
                return (
                  <div key={stage.key} className="flex gap-4 pb-6 last:pb-0">
                    {/* Line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-border bg-background"
                        } ${isActive ? "ring-2 ring-emerald-500/30" : ""}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      {index < PIPELINE_STAGES.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 mt-1 ${isDone ? "bg-emerald-500/30" : "bg-border"}`}
                        />
                      )}
                    </div>
                    {/* Label */}
                    <div className="pt-1 pb-2">
                      <p
                        className={`text-sm font-medium ${isDone ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {stage.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          Current stage
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lighthouse Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Lighthouse Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(lighthouse).length === 0 ? (
              <div className="flex items-center gap-3 py-8">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Scores not yet available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    key: "performance",
                    label: "Performance",
                    value: (lighthouse as any).performance,
                  },
                  {
                    key: "accessibility",
                    label: "Accessibility",
                    value: (lighthouse as any).accessibility,
                  },
                  {
                    key: "seo",
                    label: "SEO",
                    value: (lighthouse as any).seo,
                  },
                  {
                    key: "bestPractices",
                    label: "Best Practices",
                    value: (lighthouse as any).bestPractices,
                  },
                ].map(({ key, label, value }) => (
                  <div
                    key={key}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/20 gap-1"
                  >
                    <span
                      className={`text-4xl font-bold tabular-nums ${lighthouseColor(value ?? 0)}`}
                    >
                      {value ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meta */}
      <p className="text-xs text-muted-foreground">
        Created {new Date(project.createdAt).toLocaleString()} · Updated{" "}
        {new Date(project.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
```

- [ ] **Step 4.2: Make project cards clickable in projects/page.tsx**

In `apps/web/src/app/(dashboard)/projects/page.tsx`, add `import Link from "next/link";` at top (after existing imports).

Find:

```tsx
            <Card
              key={project.id}
              className="group hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
            >
```

Replace with:

```tsx
            <Link key={project.id} href={`/projects/${project.id}`}>
            <Card
              className="group hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
            >
```

And close the Link tag after the closing `</Card>` tag:

```tsx
            </Card>
            </Link>
```

- [ ] **Step 4.3: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

- [ ] **Step 4.4: Commit**

```bash
git add apps/web/src/app/(dashboard)/projects/
git commit -m "$(cat <<'EOF'
feat(web): add /projects/[id] page with pipeline timeline and lighthouse scores

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: /briefings — list + Force Extract

**Files:**

- Create: `apps/web/src/app/(dashboard)/briefings/page.tsx`

- [ ] **Step 5.1: Create /briefings/page.tsx**

Create `apps/web/src/app/(dashboard)/briefings/page.tsx`:

```tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "Collecting",
  COMPLETED: "Completed",
  APPROVED: "Approved",
};

export default function BriefingsPage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn: () => api.briefings.list(token!),
    enabled: !!token,
  });

  const extractMutation = useMutation({
    mutationFn: (briefingId: string) =>
      api.briefings.extract(briefingId, token!),
    onSuccess: (_, briefingId) => {
      toast({
        title: "Extract triggered",
        description: `Briefing ${briefingId.slice(-8)} queued for extraction.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["briefings"] });
    },
    onError: () => {
      toast({
        title: "Extract failed",
        description:
          "Could not trigger extraction. Check that briefing has WhatsApp transcript.",
        variant: "destructive",
      });
    },
  });

  const briefings: any[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Briefings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage client briefings and trigger extractions
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-14" />
            </Card>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No briefings yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Deal
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Started
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {briefings.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    #{b.id?.slice(-8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {b.dealId?.slice(-8) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusColors[b.status] ?? ""}`}
                    >
                      {statusLabels[b.status] ?? b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-7 text-xs"
                        disabled={
                          extractMutation.isPending &&
                          extractMutation.variables === b.id
                        }
                        onClick={() => extractMutation.mutate(b.id)}
                      >
                        {extractMutation.isPending &&
                        extractMutation.variables === b.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          "Force Extract"
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5.2: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors. If `@/hooks/use-toast` doesn't exist, check `apps/web/src/hooks/` — may be `use-toast.ts` from shadcn. If missing, use `console.error` as fallback and note to add toast later.

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/app/(dashboard)/briefings/
git commit -m "$(cat <<'EOF'
feat(web): add /briefings page with force-extract action for IN_PROGRESS briefings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: /prospecting — 3-tab page

**Files:**

- Create: `apps/web/src/app/(dashboard)/prospecting/page.tsx`

- [ ] **Step 6.1: Create /prospecting/page.tsx**

Create `apps/web/src/app/(dashboard)/prospecting/page.tsx`:

```tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ProspectingPage() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  // Form state
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radiusKm, setRadiusKm] = useState(20);
  const [minScore, setMinScore] = useState(40);
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.agents.list(token!),
    enabled: !!token,
  });

  const hunterAgents = (agentsQuery.data?.data ?? []).filter(
    (a: any) => a.persona === "HUNTER",
  );

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const queueQuery = useQuery({
    queryKey: ["prospecting-queue"],
    queryFn: () => api.prospecting.queue(token!),
    enabled: !!token,
  });

  const configQuery = useQuery({
    queryKey: ["prospecting-config"],
    queryFn: () => api.prospecting.getConfig(token!),
    enabled: !!token,
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      api.prospecting.searchMaps(
        {
          categories,
          region: { city, state, radiusKm },
          minScore,
        },
        token!,
      ),
    onSuccess: () => {
      toast({
        title: "Search queued",
        description: "Hunter agent dispatched.",
      });
      void queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });
    },
    onError: () => {
      toast({
        title: "Search failed",
        description: "Check categories and region fields.",
        variant: "destructive",
      });
    },
  });

  const addCategory = () => {
    const trimmed = categoryInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setCategoryInput("");
    }
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const canSearch =
    categories.length > 0 && city.trim().length >= 2 && state.length === 2;

  const leads: any[] = queueQuery.data?.data?.leads ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Prospecting</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Dispatch Hunter agent and manage prospected leads
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="search">New Search</TabsTrigger>
          <TabsTrigger value="queue">
            Queue
            {leads.length > 0 && (
              <Badge
                variant="default"
                className="ml-2 h-4 min-w-4 text-[9px] px-1 bg-primary/80"
              >
                {leads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        {/* Tab 1 — New Search */}
        <TabsContent value="search" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Search Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categories */}
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. restaurantes"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addCategory())
                    }
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={addCategory}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeCategory(cat)}
                      >
                        {cat}
                        <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Region */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>City</Label>
                  <Input
                    placeholder="São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>State (2 chars)</Label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Radius (km): {radiusKm}</Label>
                  <Input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Min Score: {minScore}</Label>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2"
                disabled={!canSearch || searchMutation.isPending}
                onClick={() => searchMutation.mutate()}
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Start Search
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2 — Queue */}
        <TabsContent value="queue" className="mt-6">
          {queueQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-12" />
                </Card>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
                <Search className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No leads in queue
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Business
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Score
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      HITL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead: any) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {lead.businessName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono font-semibold ${
                            (lead.qualificationScore ?? 0) >= 70
                              ? "text-emerald-400"
                              : (lead.qualificationScore ?? 0) >= 40
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {lead.qualificationScore ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {lead.source ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {lead.pendingHitl && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                          >
                            HITL
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3 — Config */}
        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Prospecting Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configQuery.isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {configQuery.data?.data &&
                    Object.entries(
                      configQuery.data.data as Record<string, unknown>,
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between py-2 border-b border-border last:border-0"
                      >
                        <span className="text-muted-foreground font-mono text-xs">
                          {key}
                        </span>
                        <span className="font-medium text-xs">
                          {String(value ?? "—")}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 6.2: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/app/(dashboard)/prospecting/
git commit -m "$(cat <<'EOF'
feat(web): add /prospecting page with search form, queue table, and config view

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: /agents/[id] — editor básico

**Files:**

- Create: `apps/web/src/app/(dashboard)/agents/[id]/page.tsx`

- [ ] **Step 7.1: Create /agents/[id]/page.tsx**

Create `apps/web/src/app/(dashboard)/agents/[id]/page.tsx`:

```tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Zap, Pause } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const personaColors: Record<string, string> = {
  HUNTER: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  CLOSER: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  BUILDER: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  QA: "bg-chart-4/10 text-chart-4 border-chart-4/20",
};

const MODEL_OPTIONS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "gpt-4o",
  "gemini-pro",
];

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.agents.getById(id, token!),
    enabled: !!token,
  });

  const agent = data?.data;

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name ?? "");
      setModel(agent.llmConfig?.model ?? "claude-sonnet-4-6");
      setStatus(agent.status ?? "ACTIVE");
    }
  }, [agent]);

  useEffect(() => {
    if (agent) {
      setIsDirty(
        name !== (agent.name ?? "") ||
          model !== (agent.llmConfig?.model ?? "claude-sonnet-4-6") ||
          status !== (agent.status ?? "ACTIVE"),
      );
    }
  }, [name, model, status, agent]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.agents.update(
        id,
        { name, status, llmConfig: { ...agent?.llmConfig, model } },
        token!,
      ),
    onSuccess: () => {
      toast({
        title: "Agent updated",
        description: "Changes saved successfully.",
      });
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["agents", id] });
      setIsDirty(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not save changes.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="animate-pulse h-10 w-48 bg-muted rounded" />
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents">
          <Button variant="outline">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
          <Badge
            variant="outline"
            className={`text-xs ${personaColors[agent.persona] ?? ""}`}
          >
            {agent.persona}
          </Badge>
        </div>
      </div>

      {/* Config form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-model">LLM Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="agent-model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="agent-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    ACTIVE
                  </div>
                </SelectItem>
                <SelectItem value="PAUSED">
                  <div className="flex items-center gap-2">
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    PAUSED
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              className="gap-2"
              disabled={!isDirty || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Skills (read-only) */}
      {agent.skills && agent.skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill: any) => (
                <Badge
                  key={skill.id ?? skill}
                  variant="secondary"
                  className="text-xs"
                >
                  {skill.skillType ?? skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Created {new Date(agent.createdAt).toLocaleString()} · Last updated{" "}
        {new Date(agent.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}
```

- [ ] **Step 7.2: Make agent cards clickable in agents/page.tsx**

In `apps/web/src/app/(dashboard)/agents/page.tsx`, add `import Link from "next/link";` at top.

Find the agent card element:

```tsx
              <Card
                key={agent.id}
                className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer"
              >
```

Replace with (removing `key` from Card, adding to Link):

```tsx
              <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card
                className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer"
              >
```

Add closing `</Link>` after `</Card>`.

- [ ] **Step 7.3: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/app/(dashboard)/agents/
git commit -m "$(cat <<'EOF'
feat(web): add /agents/[id] editor page with name/model/status editing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Sidebar nav — add Briefings + Prospecting

**Files:**

- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 8.1: Add nav items and icons to layout.tsx**

In `apps/web/src/app/(dashboard)/layout.tsx`:

1. Add `FileText` and `Search` to the lucide-react import (line ~16):

Find:

```typescript
import {
  Bot,
  Users,
  Handshake,
  FolderKanban,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  ChevronRight,
  DollarSign,
} from "lucide-react";
```

Replace with:

```typescript
import {
  Bot,
  Users,
  Handshake,
  FolderKanban,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  ChevronRight,
  DollarSign,
  FileText,
  Search,
} from "lucide-react";
```

2. Add Briefings + Prospecting to `navItems` (after `/projects` entry, before `/hitl`):

Find:

```typescript
  { href: "/projects", label: "Projects", icon: FolderKanban, badge: null },
  { href: "/hitl", label: "Approvals", icon: ShieldCheck, badge: "3" },
```

Replace with:

```typescript
  { href: "/projects", label: "Projects", icon: FolderKanban, badge: null },
  { href: "/briefings", label: "Briefings", icon: FileText, badge: null },
  { href: "/prospecting", label: "Prospecting", icon: Search, badge: null },
  { href: "/hitl", label: "Approvals", icon: ShieldCheck, badge: "3" },
```

- [ ] **Step 8.2: Run typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/app/(dashboard)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): add briefings and prospecting links to sidebar navigation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Full test run + unit tests

- [ ] **Step 9.1: Run all API unit tests**

```bash
npm run test:unit -w @agentepro/api
```

Expected: all pass (including the 4 new ExtractBriefingUseCase tests)

- [ ] **Step 9.2: Run API typecheck**

```bash
npm run typecheck -w @agentepro/api
```

Expected: no errors

- [ ] **Step 9.3: Run web typecheck**

```bash
npm run typecheck -w @agentepro/web
```

Expected: no errors

---

## Self-Review

**Spec coverage check:**

- ✅ `POST /briefings/:id/extract` — Task 2
- ✅ `ExtractBriefingUseCase` — Task 1
- ✅ `api.briefings` + `api.prospecting` + `api.agents.update` — Task 3
- ✅ `/projects/[id]` timeline + Lighthouse — Task 4
- ✅ `/briefings` list + Force Extract button — Task 5
- ✅ `/prospecting` search + queue + config tabs — Task 6
- ✅ `/agents/[id]` editor — Task 7
- ✅ Sidebar nav Briefings + Prospecting — Task 8
- ✅ Project cards clickable — Task 4
- ✅ Agent cards clickable — Task 7

**Fixed spec inconsistencies captured in plan:**

- `BriefingStatus` is `IN_PROGRESS` not `COLLECTING` — corrected in Task 1 + 5
- Extract dispatches to Python runtime directly (not BullMQ) — matches WhatsApp webhook pattern
- `lighthouse` field (not `lighthouseScores`) — corrected in Task 4
- `videoUrl` via `deliverableMeta` cast — Task 4
