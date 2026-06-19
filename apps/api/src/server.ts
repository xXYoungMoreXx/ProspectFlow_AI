import { buildApp } from "./app.js";
import { config } from "./config.js";
import { destroyContainer, redis } from "./container.js";
import { bootstrapOrganization } from "./infrastructure/db/seeds/bootstrap.js";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url:
      config.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: "hefesto-api",
});

sdk.start();

async function bootstrap(): Promise<void> {
  const app = await buildApp();

  await redis.connect();
  app.log.info("✅ Database and Redis connected");

  await bootstrapOrganization(app.container.db, app.log);

  // ── Start ───────────────────────────────────────────────────────────────
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    `🚀 Hefesto API running at http://${config.HOST}:${config.PORT}`,
  );

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      if (app.hasDecorator("container")) {
        await destroyContainer(app.container as any);
      } else {
        await destroyContainer();
      }
      app.log.info("💤 All connections closed");
      await sdk.shutdown();
      process.exit(0);
    });
  }
}

bootstrap().catch((err) => {
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
