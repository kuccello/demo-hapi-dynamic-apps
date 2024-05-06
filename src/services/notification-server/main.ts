import os from "os";
import { NotificationServer } from "./NotificationServer";
import * as path from "path";
import {
  ConfigurableWrappedLogger,
  LogLevel,
  Logger,
  SensitiveDataObfuscator,
} from "../../lib/logger";
import { config } from "@creditkarma/dynamic-config";

async function startServer() {
  process.on("unhandledRejection", (err) => {
    console.error({
      logger: "process",
      hostname: os.hostname(),
      log: {
        type: ["exception", "error"],
        tags: ["unhandled", "process", "wrs"],
        message: `${err}`,
      },
    });
    process.exit(1);
  });

  const logger = new ConfigurableWrappedLogger(
    {
      error: (message: string | string[], tags?: string[]) => {
        console.error(
          `{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`
        );
      },
      warn: (message: string | string[], tags?: string[]) => {
        console.warn(
          `{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`
        );
      },
      info: (message: string | string[], tags?: string[]) => {
        console.info(
          `{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`
        );
      },
      debug: (message: string | string[], tags?: string[]) => {
        console.debug(
          `{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`
        );
      },
    } as Logger,
    LogLevel.DEBUG,
    new SensitiveDataObfuscator(),
    ["wrs", "notification-server"]
  );
  logger.toggleObfuscation(false);

  const applicationsDirectory = await config().get('applications.directory')
  const notificationServer = new NotificationServer(
    logger,
    3001,
    "localhost",
    path.resolve(process.cwd(), applicationsDirectory),
    "http://localhost:3000/register-app"
  );
  notificationServer.init();
}

if (require.main === module) {
  // This file has been run directly
  startServer();
}
