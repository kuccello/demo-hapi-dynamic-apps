import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { AppDefinition } from '../process-manager/types';

export class FileManager {
  private rootDir: string;

  constructor(rootDir: string, private readonly fileName: string = 'wrs.config.yml') {
    this.rootDir = rootDir;
  }

  public getRootDir(): string {
    return this.rootDir;
  }

  public scanForAppDefinitions(): Map<string, AppDefinition> {
    const appDefinitions = new Map<string, AppDefinition>();
    this.scanDirectory(this.rootDir, appDefinitions);
    return appDefinitions;
  }

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