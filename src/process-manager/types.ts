export type ProcessStatus =
  | "online"
  | "stopping"
  | "stopped"
  | "launching"
  | "errored"
  | "one-launch-status";
export type AppDefinition = {
  name: string;
  script: string;
  port: number;
  path: string;
};
export type AppPorts = { [key: string]: number };
export type AppVersions = { [key: string]: string[] }
export type AppPaths = { [key: string]: string };
export type PathToApps = { [key: string]: string[] };
export type AppIdentifier = { name: string, version: string }