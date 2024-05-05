import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { AppDefinition } from '../process-manager/types';
import { Logger } from '../logger/types';

/**
 * FileManager class for scanning directories and retrieving app definitions.
 */
export class FileManager {
  private rootDir: string;

  /**
   * Constructs a new FileManager instance.
   * @param rootDir The root directory to scan.
   * @param fileName The name of the configuration file (default: 'wrs.config.yml').
   */
  constructor(private logger: Logger, rootDir: string, private readonly fileName: string = 'wrs.config.yml') {
    this.rootDir = rootDir;
  }

  /**
   * Scans the root directory for app definitions.
   * @returns A map of app definitions.
   */
  public scanForAppDefinitions(): Map<string, AppDefinition> {
    const appDefinitions = new Map<string, AppDefinition>();
    this.scanDirectory(this.rootDir, appDefinitions);
    return appDefinitions;
  }

  /**
   * Recursively scans a directory for app definitions.
   * @param dir The directory to scan.
   * @param appDefinitions The map to store the app definitions.
   */
  private scanDirectory(dir: string, appDefinitions: Map<string, AppDefinition>): void {
    const files = fs.readdirSync(dir);
    let packageVersion: string | null = null;
    let packageName: string | null = null;

    // Check if package.json exists in the directory
    if (files.includes('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      packageVersion = packageJson.version;
      packageName = packageJson.name;
    }

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        this.scanDirectory(filePath, appDefinitions);
      } else if (file === this.fileName) {
        const appConfig = yaml.load(fs.readFileSync(filePath, 'utf8')) as {application: {path: string, script: string, name?: string, version?: string}};
        // If package.json was found in the directory, add the version to the app definition
        const appDefinition: AppDefinition = {
          name: `@ck/${appConfig.application.name??packageName}@v${appConfig.application.version??packageVersion}`,
          script: path.resolve(filePath.replace('/'+this.fileName, ''), appConfig.application.script),
          port: -1,
          path: appConfig.application.path,
        };

        appDefinitions.set(appDefinition.name, appDefinition);
      }
    }
  }
}