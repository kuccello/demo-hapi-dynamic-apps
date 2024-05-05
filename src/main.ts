import { AppManager } from "./app-manager/AppManager";
import { FileManager } from "./file-manager/FileManager";
import { ConfigurableWrappedLogger } from "./logger/Logger";
import { SensitiveDataObfuscator } from "./logger/SensitiveDataObfuscator";
import { LogLevel, Logger } from "./logger/types";
import { PortScanner } from "./port-scanner/PortScanner";
import { ServerManager } from "./server-manager/ServerManager";
import path from "path";
import os from 'os';

process.on("unhandledRejection", (err) => {
  console.error({logger: 'process', hostname: os.hostname(), log: {type:['exception','error'], tags: ['unhandled','process','wrs'], message: `${err}`}});
  process.exit(1);
});

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
  LogLevel.INFO,
  new SensitiveDataObfuscator(),
  ["wrs","server"]
);
logger.toggleObfuscation(false)
const fileManager = new FileManager(
  logger,
  path.resolve(__dirname, "../assets")
);
const portScanner = new PortScanner(logger, 7000, 7100);
const appManager = new AppManager(logger, fileManager, portScanner);
const serverManager = new ServerManager(logger, 3000, 'localhost', appManager, process.env.EXPOSE_HEALTHCHECK === 'true');
serverManager.init();