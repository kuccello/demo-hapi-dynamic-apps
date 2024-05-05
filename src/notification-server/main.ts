import { ConfigurableWrappedLogger } from "../logger/Logger";
import { SensitiveDataObfuscator } from "../logger/SensitiveDataObfuscator";
import { LogLevel, Logger } from "../logger/types";
import os from 'os';
import { NotificationServer } from "./NotificationServer";
import * as path from 'path';

process.on("unhandledRejection", (err) => {
  console.error({logger: 'process', hostname: os.hostname(), log: {type:['exception','error'], tags: ['unhandled','process','wrs'], message: `${err}`}});
  process.exit(1);
});

const logger = new ConfigurableWrappedLogger(
  {
    error: (message: string | string[], tags?: string[]) =>
      {
        console.error(`{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`)
      },
    warn: (message: string | string[], tags?: string[]) =>
      {
        console.warn(`{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`)
      },
    info: (message: string | string[], tags?: string[]) =>
      {
        console.info(`{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`)
      },
    debug: (message: string | string[], tags?: string[]) =>
      {
        console.debug(`{"logger": "notification-server", "hostname":"${os.hostname()}", log: ${message}`)
      },
  } as Logger,
  LogLevel.DEBUG,
  new SensitiveDataObfuscator(),
  ["wrs","notification-server"]
);
logger.toggleObfuscation(false)

const notificationServer = new NotificationServer(logger, 3001, 'localhost', path.resolve(__dirname, "../../assets"), 'http://localhost:3000/register-app');
notificationServer.init();