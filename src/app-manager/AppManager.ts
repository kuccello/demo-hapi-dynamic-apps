import { FileManager } from "../file-manager/FileManager";
import { PortScanner } from "../port-scanner/PortScanner";
import { AppDefinition } from "../process-manager/types";

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
  constructor(fileManager: FileManager, portScanner: PortScanner) {
    this.fileManager = fileManager;
    this.portScanner = portScanner;
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