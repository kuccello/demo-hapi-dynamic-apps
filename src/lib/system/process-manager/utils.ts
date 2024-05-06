import type {
  ProcessStatus,
  AppDefinition,
  AppPorts,
  AppVersions,
  AppPaths,
  PathToApps,
  AppIdentifier,
} from "./types";

/**
 * Extracts the app name from an AppDefinition object or a string.
 * @param appOrName - The AppDefinition object or the app name as a string.
 * @returns The extracted app name.
 */
export function extractAppNameOnly(appOrName: AppDefinition | string): string {
  return typeof appOrName === "string"
    ? appOrName.split("@")[1].split("@")[0]
    : appOrName.name.split("@")[1].split("@")[0];
}

/**
 * Extracts the app version from an AppDefinition object or a string.
 * @param appOrName - The AppDefinition object or the app name as a string.
 * @returns The extracted app version.
 */
export function extractAppVersionOnly(
  appOrName: AppDefinition | string
): string {
  return typeof appOrName === "string"
    ? appOrName.split("@")[2].split("@")[0].slice(1)
    : appOrName.name.split("@")[2].split("@")[0].slice(1);
}

/**
 * Decomposes an app name into its name and version components.
 * @param appOrName - The AppDefinition object or the app name as a string.
 * @returns The decomposed app identifier.
 */
export function decomposeAppName(
  appOrName: AppDefinition | string
): AppIdentifier {
  const appName = typeof appOrName === "string" ? appOrName : appOrName.name;
  return {
    name: extractAppNameOnly(appName),
    version: extractAppVersionOnly(appName),
  };
}

/**
 * Checks if two apps have the same name but different versions.
 * @param app1 - The first AppDefinition object or app name as a string.
 * @param app2 - The second AppDefinition object or app name as a string.
 * @returns True if the apps have the same name but different versions, false otherwise.
 */
export function isSameAppDifferentVersion(
  app1: AppDefinition | string,
  app2: AppDefinition | string
): boolean {
  const app1Name = typeof app1 === "string" ? app1 : app1.name;
  const app2Name = typeof app2 === "string" ? app2 : app2.name;
  return (
    decomposeAppName(app1Name).name === decomposeAppName(app2Name).name &&
    decomposeAppName(app1Name).version !== decomposeAppName(app2Name).version
  );
}

/**
 * Checks if two apps have the same name, different versions, and different ports.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have the same name, different versions, and different ports, false otherwise.
 */
export function isSameAppDifferentVersionAndPort(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return isSameAppDifferentVersion(app1, app2) && app1.port !== app2.port;
}

/**
 * Checks if two apps have the same name, different versions, different paths, and different ports.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have the same name, different versions, different paths, and different ports, false otherwise.
 */
export function isSameAppDifferentVersionAndDifferentPathAndDifferentPort(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return (
    isSameAppDifferentVersionAndPort(app1, app2) &&
    !thereIsAnAppPathConflict(app1, app2)
  );
}

/**
 * Checks if two apps have different names.
 * @param app1 - The first AppDefinition object or app name as a string.
 * @param app2 - The second AppDefinition object or app name as a string.
 * @returns True if the apps have different names, false otherwise.
 */
export function isDifferentAppName(
  app1: AppDefinition | string,
  app2: AppDefinition | string
): boolean {
  const app1Name = typeof app1 === "string" ? app1 : app1.name;
  const app2Name = typeof app2 === "string" ? app2 : app2.name;
  return decomposeAppName(app1Name).name !== decomposeAppName(app2Name).name;
}

/**
 * Checks if two apps have different names and different ports.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have different names and different ports, false otherwise.
 */
export function isDifferentAppOnDifferentPort(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return isDifferentAppName(app1, app2) && app1.port !== app2.port;
}

/**
 * Checks if two apps have different names and different paths.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have different names and different paths, false otherwise.
 */
export function isDifferentAppOnDifferentPath(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return (
    isDifferentAppName(app1, app2) && !thereIsAnAppPathConflict(app1, app2)
  );
}

/**
 * Checks if two apps have different names, different versions, different paths, and different ports.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have different names, different versions, different paths, and different ports, false otherwise.
 */
export function isDifferentAppOnDifferentPortAndDifferentPath(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return (
    isDifferentAppOnDifferentPath(app1, app2) &&
    isDifferentAppOnDifferentPort(app1, app2)
  );
}

/**
 * Checks if two apps have the same path.
 * @param app1 - The first AppDefinition object or app path as a string.
 * @param app2 - The second AppDefinition object or app path as a string.
 * @returns True if the apps have the same path, false otherwise.
 */
export function thereIsAnAppPathConflict(
  app1: AppDefinition | string,
  app2: AppDefinition | string
): boolean {
  const appPath1 = typeof app1 === "string" ? app1 : app1.path;
  const appPath2 = typeof app2 === "string" ? app2 : app2.path;
  return appPath1 === appPath2;
}

/**
 * Checks if two apps have the same port.
 * @param app1 - The first AppDefinition object or app port as a number.
 * @param app2 - The second AppDefinition object or app port as a number.
 * @returns True if the apps have the same port, false otherwise.
 */
export function thereIsAnAppPortConflict(
  app1: AppDefinition | number,
  app2: AppDefinition | number
): boolean {
  const appPort1 = typeof app1 === "number" ? app1 : app1.port;
  const appPort2 = typeof app2 === "number" ? app2 : app2.port;
  return appPort1 === appPort2;
}

/**
 * Checks if two apps have the same name, port, and path.
 * @param app1 - The first AppDefinition object.
 * @param app2 - The second AppDefinition object.
 * @returns True if the apps have the same name, port, and path, false otherwise.
 */
export function isSameAppDefinition(
  app1: AppDefinition,
  app2: AppDefinition
): boolean {
  return (
    app1.name === app2.name &&
    app1.port === app2.port &&
    app1.path === app2.path
  );
}

/**
 * Gets the versions of each app in the provided array.
 * @param apps - An array of AppDefinition objects.
 * @returns An object mapping app names to an array of their versions.
 */
export function getAppVersions(apps: AppDefinition[]): AppVersions {
  return apps.reduce((acc:AppVersions, app:AppDefinition) => {
    // Extract the app id and version from the name
    const { name, version } = decomposeAppName(app);

    // If the app id is not yet in the accumulator, add it
    if (!acc[name]) {
      acc[name] = [];
    }

    // Add the version to the array of versions for this app id
    acc[name].push(version);

    return acc;
  }, {});
}

/**
 * Gets the paths of each app in the provided array.
 * @param apps - An array of AppDefinition objects.
 * @returns An object mapping app names to their paths.
 */
export function getAppPaths(apps: AppDefinition[]): AppPaths {
  return apps.reduce((acc:AppPaths, app:AppDefinition) => {
    acc[app.name] = app.path;
    return acc;
  }, {});
}

/**
 * Gets the mapping of app paths to app names in the provided array.
 * @param apps - An array of AppDefinition objects.
 * @returns An object mapping app paths to an array of app names.
 */
export function getPathToApps(apps: AppDefinition[]): PathToApps {
  return apps.reduce((acc:PathToApps, app:AppDefinition) => {
    if (!acc[app.path]) {
      acc[app.path] = [];
    }
    acc[app.path].push(app.name);
    return acc;
  }, {});
}

/**
 * Gets the ports of each app in the provided array.
 * @param apps - An array of AppDefinition objects.
 * @returns An object mapping app names to their ports.
 */
export function getAppPorts(apps: AppDefinition[]): AppPorts {
  return apps.reduce((acc:AppPorts, app:AppDefinition) => {
    acc[app.name] = app.port;
    return acc;
  }, {});
}

/**
 * Finds an existing app with the given name in the provided array.
 * @param apps - An array of AppDefinition objects.
 * @param newAppName - The name of the new app to search for.
 * @returns The existing AppDefinition object with the same name, or undefined if not found.
 */
export function findExistingAppMaybe(
  apps: AppDefinition[],
  newAppName: string
): AppDefinition | undefined {
  return apps.find((app) => app.name === newAppName);
}

/**
 * Checks for conflicts between a new app and existing apps.
 * @param newApp - The new AppDefinition object to check for conflicts.
 * @param apps - An array of existing AppDefinition objects.
 * @returns True if there are conflicts, false otherwise.
 */
export function checkForConflicts(
  newApp: AppDefinition,
  apps: AppDefinition[]
): boolean | string {
  const existingApp = findExistingAppMaybe(apps, newApp.name);

  if (existingApp) {
    // Same app name, same port, and same version is ok
    if (isSameAppDefinition(existingApp, newApp)) {
      return false;
    }

    // Same port is an error when not the same app definition
    if (thereIsAnAppPortConflict(existingApp, newApp)) {
      return `App ${newApp.name} Port: ${newApp.port} is already in use.`;
    }

    // Same app name, different version, different port, same path is ok
    if (isSameAppDifferentVersion(existingApp, newApp)) {
      return false;
    }

    // Different app name, different version, different port, different path is ok
    if (isDifferentAppOnDifferentPortAndDifferentPath(existingApp, newApp)) {
      return false;
    }
  }

  // Check all apps Not the same app name and same port is an error
  if (apps.some((app) => thereIsAnAppPortConflict(app.port, newApp.port))) {
    return `App ${newApp.name} Port: ${newApp.port} is already in use.`;
  }

  // Check all apps to make sure not using same path unless same app name
  if (
    apps.some(
      (app) =>
        thereIsAnAppPathConflict(app, newApp) &&
        extractAppNameOnly(app) !== extractAppNameOnly(newApp)
    )
  ) {
    return `App ${newApp.name} Path: ${newApp.path} is already in use.`;
  }

  // No conflicts
  return false;
}
