import net from "net";
import { timedMethod } from "../performance/utils";
import { Logger } from "../../logger";

/**
 * Represents a PortScanner that scans for open ports within a specified range.
 *
 * Example:
 *  const scanner = new PortScanner(3000, 4000);
 *  scanner.scan().then(openPorts => {
 *    console.log('Open ports:', openPorts);
 *  });
 */
export class PortScanner {
  private startPort: number;
  private endPort: number;

  /**
   * Creates a new instance of PortScanner.
   * @param startPort The starting port number of the scan range.
   * @param endPort The ending port number of the scan range.
   */
  constructor(
    private logger: Logger,
    startPort: number,
    endPort: number,
    enablePerformanceLogging: boolean = true
  ) {
    this.startPort = startPort;
    this.endPort = endPort;

    if (enablePerformanceLogging) {
      const methodsToTime = Object.getOwnPropertyNames(
        PortScanner.prototype
      ).filter(
        (name) =>
          typeof (PortScanner.prototype as any)[name] === "function" &&
          name !== "constructor"
      );

      // Wrap selected methods with timing
      for (const methodName of methodsToTime) {
        const originalMethod = (this as any)[methodName];
        if (typeof originalMethod === "function") {
          (this as any)[methodName] = (...args: any[]) =>
            timedMethod(originalMethod.bind(this), this.logger, ...args);
        }
      }
    }
  }

  /**
   * Checks if a port is open.
   * @param port The port number to check.
   * @returns A promise that resolves to true if the port is open, false otherwise.
   */
  private checkPortIsAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * Scans for open ports within the specified range.
   * @returns A promise that resolves to an array of open port numbers.
   */
  public async scanForOpenPorts(): Promise<number[]> {
    const openPorts: number[] = [];
    this.logger.info(
      `Scanning for open ports between ${this.startPort} and ${this.endPort}...`,
      ["port-scanner"]
    );
    for (let port = this.startPort; port <= this.endPort; port++) {
      this.logger.debug(`Checking port ${port}...`, ["port-scanner"]);
      const isOpen = await this.checkPortIsAvailable(port);
      if (isOpen) {
        this.logger.debug(`Port ${port} is open`, ["port-scanner"]);
        openPorts.push(port);
      }
    }
    this.logger.info(`Found ${openPorts.length} open ports.`, ["port-scanner"]);

    return openPorts;
  }
}
