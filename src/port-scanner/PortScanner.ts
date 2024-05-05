import net from 'net';

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
  constructor(startPort: number, endPort: number) {
    this.startPort = startPort;
    this.endPort = endPort;
  }

  /**
   * Checks if a port is open.
   * @param port The port number to check.
   * @returns A promise that resolves to true if the port is open, false otherwise.
   */
  private checkPortIsAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
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

    for (let port = this.startPort; port <= this.endPort; port++) {
      console.log(`Checking port ${port}...`);
      const isOpen = await this.checkPortIsAvailable(port);
      if (isOpen) {
        console.log(`Port ${port} is open`);
        openPorts.push(port);
      }
    }

    return openPorts;
  }
}