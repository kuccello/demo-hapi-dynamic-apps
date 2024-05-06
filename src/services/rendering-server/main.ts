import path from "path";
import os from 'os';
import { ConfigurableWrappedLogger, LogLevel, Logger, SensitiveDataObfuscator } from "../../lib/logger";
import { FileManager, PortScanner } from "../../lib/system";
import { AppManager } from "../../lib/logic";
import { RenderingServer } from "./RenderingServer";
import { config } from "@creditkarma/dynamic-config";

process.on("unhandledRejection", (err) => {
  console.error({logger: 'process', hostname: os.hostname(), log: {type:['exception','error'], tags: ['unhandled','process','wrs'], message: `${err}`}});
  process.exit(1);
});

async function startServer() {
  const logger = new ConfigurableWrappedLogger(
    {
      error: (message: string | string[], tags?: string[]) =>
        {
          console.error(`{"logger": "server", "hostname":"${os.hostname()}", log: ${message}`)
        },
      warn: (message: string | string[], tags?: string[]) =>
        {
          console.warn(`{"logger": "server", "hostname":"${os.hostname()}", log: ${message}`)
        },
      info: (message: string | string[], tags?: string[]) =>
        {
          console.info(`{"logger": "server", "hostname":"${os.hostname()}", log: ${message}`)
        },
      debug: (message: string | string[], tags?: string[]) =>
        {
          console.debug(`{"logger": "server", "hostname":"${os.hostname()}", log: ${message}`)
        },
    } as Logger,
    LogLevel.DEBUG,
    new SensitiveDataObfuscator(),
    ["wrs","server"]
  );
  logger.toggleObfuscation(false)
  const applicationsDirectory = await config().get('applications.directory')
  const fileManager = new FileManager(
    logger,
    path.resolve(process.cwd(), applicationsDirectory),
    undefined,
    false
  );
  const portScanner = new PortScanner(logger, 7000, 7100, false);
  const appManager = new AppManager(logger, fileManager, portScanner, false);
  const renderingServer = new RenderingServer(logger, 3000, 'localhost', appManager, process.env.EXPOSE_HEALTHCHECK === 'true', false);
  renderingServer.init();
}
if (require.main === module) {
  // This file has been run directly
  startServer();
}