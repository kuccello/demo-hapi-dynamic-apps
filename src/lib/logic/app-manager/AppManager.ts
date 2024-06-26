import { FileManager } from "../../system/file-manager/FileManager";
import { Logger } from "../../logger/types";
import { timedMethod } from "../../system/performance/utils";
import { PortScanner } from "../../system/port-scanner/PortScanner";
import { AppDefinition } from "../../system/process-manager/types";

/**
 * The AppManager class is responsible for managing the applications in the process manager.
 */
export class AppManager {
  private fileManager: FileManager;
  private portScanner: PortScanner;

  /**
   * Creates an instance of AppManager.
   * @param fileManager The FileManager instance used for managing files.
   * @param portScanner The PortScanner instance used for scanning open ports.
   */
  constructor(private logger: Logger, fileManager: FileManager, portScanner: PortScanner, enablePerformanceLogging: boolean = true) {
    this.fileManager = fileManager;
    this.portScanner = portScanner;

    if (enablePerformanceLogging) {
      const methodsToTime: string[] = [
        'getAppDefinitions',
      ];
      // const excludeList = ['appConfigs.entries', 'appConfigs'];
      // const methodsToTime = Object.getOwnPropertyNames(AppManager.prototype)
      //   .filter(name => typeof (AppManager.prototype as any)[name] === 'function' && name !== 'constructor')
      //   .filter(name => !excludeList.includes(name));

      // Wrap selected methods with timing
      for (const methodName of methodsToTime) {
        const originalMethod = (this as any)[methodName];
        if (typeof originalMethod === 'function') {
          (this as any)[methodName] = (...args: any[]) => timedMethod(originalMethod.bind(this), this.logger, ...args);
        }
      }
    }

  }

  /**
   * Retrieves the definitions of all the applications from the defined configuration of the FileManager.
   * @returns A promise that resolves to an array of AppDefinition objects.
   * @throws An error if there are no more available ports.
   */
  async getAppDefinitions(): Promise<AppDefinition[]> {
    const availablePorts = await this.portScanner.scanForOpenPorts();
    const appConfigs = this.fileManager.scanForAppDefinitions();
    const appDefinitions: AppDefinition[] = [];

    for (const [name, config] of appConfigs.entries()) {
      if (availablePorts.length === 0) {
        throw new Error('No more available ports');
      }

      const port = availablePorts.shift() as number;
      appDefinitions.push({
        name,
        script: config.script,
        port,
        path: config.path,
      });
    }

    return appDefinitions;
  }
}