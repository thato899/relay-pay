import { buildApplication } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";

const { app, monitor } = await buildApplication();

try {
  await app.listen({ host: "0.0.0.0", port: config.port });
  monitor.start();
} catch (error) {
  app.log.error({ err: error }, "Could not start Merchant & Machine Payments API");
  await closeDatabase();
  process.exitCode = 1;
}

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "Shutting down");
  await monitor.stop();
  await app.close();
  await closeDatabase();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
