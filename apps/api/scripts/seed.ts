import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as argon2 from "argon2";
import * as schema from "../src/infrastructure/db/schema.js";

async function seed() {
  console.log("🌱 Starting database seeding...");

  // 1. Setup connection
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgres://agentepro:agentepro_dev@localhost:5432/agentepro";
  const queryClient = postgres(dbUrl);
  const db = drizzle(queryClient, { schema });

  try {
    // 2. Clear existing data (optional, but good for a fresh start in local dev)
    console.log("🧹 Clearing existing data...");
    await queryClient`TRUNCATE TABLE operators, agents, leads, deals, projects CASCADE`;

    // 3. Create Admin Operator
    console.log("👤 Creating admin operator...");
    const adminPasswordHash = await argon2.hash("admin_dev", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const [admin] = await db
      .insert(schema.operators)
      .values({
        email: "admin@agentepro.local",
        passwordHash: adminPasswordHash,
        name: "System Admin",
        isActive: true,
      })
      .returning();

    // 4. Create Agents
    console.log("🤖 Creating initial agents...");
    const [hunterAgent] = await db
      .insert(schema.agents)
      .values({
        operatorId: admin.id,
        name: "Hunter Pro",
        persona: "HUNTER",
        status: "ACTIVE",
        llmProvider: "OPENAI",
        llmModel: "gpt-4o",
        llmSystemPrompt: "You are a professional B2B Hunter agent.",
      })
      .returning();

    const [closerAgent] = await db
      .insert(schema.agents)
      .values({
        operatorId: admin.id,
        name: "Closer Elite",
        persona: "CLOSER",
        status: "ACTIVE",
        llmProvider: "ANTHROPIC",
        llmModel: "claude-3.5-sonnet",
        hitlTimeoutMinutes: 120,
      })
      .returning();

    const [builderAgent] = await db
      .insert(schema.agents)
      .values({
        operatorId: admin.id,
        name: "Builder AI",
        persona: "BUILDER",
        status: "ACTIVE",
        llmProvider: "OPENAI",
        llmModel: "gpt-4o",
      })
      .returning();

    // 5. Create a Lead
    console.log("🎯 Creating sample lead...");
    const [lead] = await db
      .insert(schema.leads)
      .values({
        operatorId: admin.id,
        assignedAgentId: hunterAgent.id,
        contactName: "João da Silva",
        contactCompany: "Clínica Odontológica Sorriso Feliz",
        contactEmail: "joao@sorrisofeliz.test",
        contactPhone: "5511999999999",
        source: "MANUAL",
        status: "NEW",
        notes: "Lead from test seed",
      })
      .returning();

    // 6. Create a Deal
    console.log("🤝 Creating sample deal...");
    const [deal] = await db
      .insert(schema.deals)
      .values({
        operatorId: admin.id,
        leadId: lead.id,
        agentId: closerAgent.id,
        serviceType: "WEBSITE",
        status: "PROPOSED",
        basePriceCents: 250000, // R$ 2500
        currency: "BRL",
      })
      .returning();

    // 7. Create a Project
    console.log("🏗️ Creating sample project...");
    await db.insert(schema.projects).values({
      operatorId: admin.id,
      dealId: deal.id,
      assignedAgentId: builderAgent.id,
      status: "PLANNING",
      templateId: "T001",
    });

    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  } finally {
    // 8. Close connection
    await queryClient.end();
  }
}

seed();
