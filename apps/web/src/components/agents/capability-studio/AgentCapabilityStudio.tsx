"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./tabs/OverviewTab";
import { SubAgentsTab } from "./tabs/SubAgentsTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { MCPsTab } from "./tabs/MCPsTab";
import { WorkflowsTab } from "./tabs/WorkflowsTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";

interface Agent {
  id: string;
  name: string;
  status: string;
  persona: string;
  llmConfig?: { provider?: string; modelName?: string };
  tokenBudgetRemaining?: number;
  tokenBudgetTotal?: number;
  [key: string]: unknown;
}

export function AgentCapabilityStudio({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <p className="text-sm text-muted-foreground">
          {agent.llmConfig?.provider} / {agent.llmConfig?.modelName} ·{" "}
          {agent.persona}
        </p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sub-agents">Sub-agentes</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="mcps">MCPs</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab agent={agent} />
        </TabsContent>
        <TabsContent value="sub-agents">
          <SubAgentsTab agentId={agent.id} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab agentId={agent.id} />
        </TabsContent>
        <TabsContent value="mcps">
          <MCPsTab agentId={agent.id} />
        </TabsContent>
        <TabsContent value="workflows">
          <WorkflowsTab agentId={agent.id} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
