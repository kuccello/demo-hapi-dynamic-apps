import pm2 from "pm2";
import Hapi from "@hapi/hapi";
import H2o2 from "@hapi/h2o2";
import { AppStatus } from "./types";
import { Logger } from "../logger/types";
import * as pmUtils from "../process-manager/utils";
import { AppManager } from "../app-manager/AppManager";
import type { AppDefinition } from "../process-manager/types";
import { timedMethod } from "../performance/utils";

/**
 * Manages the server and its applications.
 */
export class ServerManager {
  private readonly server: Hapi.Server<Hapi.ServerApplicationState>;

  constructor(
    private logger: Logger,
    private port: number = 3000,
    private host: string = "localhost",
    private appManager: AppManager,
    private exposeHealthCheck: boolean = false
  ) {
    this.server = new Hapi.Server<Hapi.ServerApplicationState>({
      port,
      host,
    });
    // Maybe if we want to be selective about which methods to time, we could do something like this:
    // const methodsToTime = [
    //   'init', 'registerApplicationVersion', 'registerAppHandlerRoute', 'mapUri', 'preMethod',
    //   'performHealthCheck', 'healthCheckHandler', 'registerAppHealthCheckRoute', 'performHealthCheck',
    //   'registerAppRoute', 'respondWithError', 'respondWithSuccess', 'restartExistingApp',
    //   'startAndRegisterNewApp', 'startApp', 'manageApp', 'checkForConflicts', 'logRoutes',
    //   'getAppStatuses', 'getAppStatus', 'registerHealthCheckRoute', 'connectAndManageApps'
    // ];
    // Or maybe even pass in a list of methods to time as a parameter to the constructor?

    // For now, we'll just time all methods
    const methodsToTime = Object.getOwnPropertyNames(ServerManager.prototype)
      .filter(name => typeof (ServerManager.prototype as any)[name] === 'function' && name !== 'constructor');

    // Wrap selected methods with timing
    for (const methodName of methodsToTime) {
      const originalMethod = (this as any)[methodName];
      if (typeof originalMethod === 'function') {
        (this as any)[methodName] = (...args: any[]) => timedMethod(originalMethod.bind(this), this.logger, ...args);
      }
    }
  }

  /**
   * Initializes the server by registering plugins, connecting and managing apps,
   * registering routes, and starting the server.
   * @returns {Promise<void>} A promise that resolves when the server is initialized.
   */
  public async init() {
    this.logger.info("Initializing server...", ["method:ServerManager#init"]);

    // Register the h2o2 plugin
    await this.server.register(H2o2);

    await this.connectAndManageApps();

    this.registerHealthCheckRoute();
    this.registerAppRoute();

    await this.server.start();
    this.logger.info(`Server running on ${this.server.info.uri}`, ["method:ServerManager#init"]);
  }

  /**
   * Registers a new application version.
   *
   * @param newApp - The new application definition.
   * @param apps - The list of existing application definitions.
   */
  public registerApplicationVersion(
    newApp: AppDefinition,
    apps: AppDefinition[]
  ) {
    this.registerAppHandlerRoute(newApp, apps);
    this.registerAppHealthCheckRoute(newApp);
  }

  /**
   * Registers a new app handler route.
   *
   * @param newApp - The new app definition.
   * @param apps - The list of app definitions.
   */
  private registerAppHandlerRoute(
    newApp: AppDefinition,
    apps: AppDefinition[]
  ) {
    this.server.route({
      method: "*",
      path: `${newApp.path}/{any*}`,
      handler: {
        proxy: {
          mapUri: (request) => this.mapUri(request, newApp, apps),
          passThrough: true,
          xforward: true,
        },
      },
      options: {
        pre: [
          {
            method: async (request, h) =>
              this.preMethod(request, h, newApp, apps),
            assign: "healthCheck",
          },
        ],
      },
    });
  }

  /**
   * Maps the request URI based on the provided parameters.
   * If a version is specified in the request query, it checks if there is an app with that version and updates the port accordingly.
   * @param request - The Hapi request object.
   * @param newApp - The new app definition.
   * @param apps - The list of app definitions.
   * @returns An object containing the mapped URI.
   */
  private mapUri(
    request: Hapi.Request,
    newApp: AppDefinition,
    apps: AppDefinition[]
  ) {
    const version = request.query.version;
    let port = newApp.port;

    if (version) {
      const versionApp = apps.find(
        (app) => pmUtils.decomposeAppName(app).version === `${version}`
      );
      if (versionApp) {
        port = versionApp.port;
      }
    }

    return {
      uri: `http://127.0.0.1:${port}${request.path}`,
    };
  }

  /**
   * Performs pre-processing before executing the main method.
   *
   * @param request - The Hapi request object.
   * @param h - The Hapi response toolkit.
   * @param newApp - The new app definition.
   * @param apps - The list of app definitions.
   * @returns A promise that resolves to the result of the health check.
   */
  private async preMethod(
    request: Hapi.Request,
    h: Hapi.ResponseToolkit,
    newApp: AppDefinition,
    apps: AppDefinition[]
  ) {
    let app = newApp;
    const version = request.query.version;
    if (version) {
      const versionApp = apps.find(
        (app) => pmUtils.decomposeAppName(app).version === `${version}`
      );
      if (versionApp) {
        app = versionApp;
      }
    }
    if (!app) {
      this.logger.error(`App ${newApp.name} not found`, ["method:ServerManager#preMethod"]);
      return h.redirect("/error").takeover().code(404);
    }
    return this.performHealthCheck(app, h);
  }

  /**
   * Performs a health check for the specified app.
   * @param app - The app definition.
   * @param h - The Hapi response toolkit.
   * @returns A promise that resolves if the health check is successful, or rejects with an error if it fails.
   */
  private performHealthCheck(app: AppDefinition, h: Hapi.ResponseToolkit) {
    return new Promise((resolve, reject) => {
      pm2.describe(app.name, (err, processDescription) => {
        if (err) {
          this.logger.error(`${err}`, ["method:ServerManager#performHealthCheck"]);
          reject(err);
        } else {
          if (processDescription[0]?.pm2_env?.status !== "online") {
            return h.redirect("/error").takeover();
          }
          resolve(h.continue);
        }
      });
    });
  }

  /**
   * Registers a health check route for a new app.
   *
   * @param newApp - The definition of the new app.
   */
  private registerAppHealthCheckRoute(newApp: AppDefinition) {
    this.server.route({
      method: "GET",
      path: `/health/${newApp.name}`,
      options: {
        isInternal: !this.exposeHealthCheck, // <== make this route internal - with a flag for this so we can debug it locally
      },
      handler: async (request, h) =>
        this.healthCheckHandler(request, h, newApp),
    });
  }

  /**
   * Handles the health check request for a new application.
   *
   * @param request - The Hapi request object.
   * @param h - The Hapi response toolkit.
   * @param newApp - The definition of the new application.
   * @returns A promise that resolves with the health check response.
   */
  private async healthCheckHandler(
    request: Hapi.Request,
    h: Hapi.ResponseToolkit,
    newApp: AppDefinition
  ) {
    this.logger.info(`Health check for app ${newApp.name} requested.`, ["method:ServerManager#healthCheckHandler"]);
    const appStatus = await this.getAppStatus(newApp);
    return h
      .response({
        name: newApp.name,
        status: appStatus.status,
        mem: appStatus.mem,
        cpu: appStatus.cpu,
      })
      .code(200);
  }

  /**
   * Connects to the process manager and manages the applications.
   * @returns A promise that resolves when the applications are managed successfully, or rejects with an error.
   */
  private connectAndManageApps(): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          this.logger.error(`${err}`, ["method:ServerManager#connectAndManageApps"])
          process.exit(2);
        }

        this.appManager
          .getAppDefinitions()
          .then((apps) => this.manageApps(apps))
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Manages multiple applications asynchronously.
   *
   * @param apps - An array of AppDefinition objects representing the applications to be managed.
   * @returns A Promise that resolves when all the applications have been managed.
   */
  private async manageApps(apps: AppDefinition[]): Promise<void> {
    const appPromises = apps.map((app) => this.manageApp(app, apps));
    await Promise.all(appPromises);
  }

  /**
   * Manages the given app by starting it if it is not already running.
   * Also logs routes, checks for conflicts, registers the app, and its version.
   *
   * @param app - The app definition to manage.
   * @param apps - The list of all app definitions.
   * @returns A Promise that resolves when the app management is complete.
   */
  private async manageApp(
    app: AppDefinition,
    apps: AppDefinition[]
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      pm2.describe(app.name, (err, processDescription) => {
        if (err) {
          this.logger.error(`${err}`);
          process.exit(1);
        }

        if (
          !processDescription ||
          processDescription[0]?.pm2_env?.status !== "online"
        ) {
          this.startApp(app).then(resolve).catch(reject);
        } else {
          resolve();
        }
      });
    });
    this.logRoutes();
    this.checkForConflicts(app, apps);
    this.logger.info(`Registering app ${app.name}`, ["method:ServerManager#manageApp"]);
    this.registerApplicationVersion(app, apps);
  }

  /**
   * Starts an application using PM2.
   * @param app - The definition of the application to start.
   * @returns A promise that resolves when the application is started successfully, or rejects with an error if there was a problem.
   */
  private startApp(app: AppDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.start(
        {
          name: app.name,
          script: app.script,
          env: {
            PORT: app.port.toString(),
            // add other environment variables here
          },
        },
        (err, apps) => {
          if (err) {
            this.logger.error(`${err}`);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Logs the routes of the server.
   */
  private logRoutes(): void {
    const routes = this.server.table();
    routes.forEach((route) => {
      this.logger.info(`Path: ${route.path}, Method: ${route.method}`, [
        "method:ServerManager#logRoutes",
      ]);
    });
  }

  /**
   * Checks for conflicts between the given app and the existing apps.
   * @param app - The app to check for conflicts.
   * @param apps - The existing apps to compare against.
   */
  private checkForConflicts(app: AppDefinition, apps: AppDefinition[]): void {
    const conflictsExist = pmUtils.checkForConflicts(
      app,
      apps.filter((_app: AppDefinition) => _app.name !== app.name)
    );

    if (conflictsExist) {
      this.logger.error(
        `App ${app.name} conflicts with existing app: ${conflictsExist}`,
        ["method:ServerManager#checkForConflicts"]
      );
    }
  }

  /**
   * Registers a health check route on the server.
   * This route returns the status of the server and the apps.
   */
  private registerHealthCheckRoute() {
    this.server.route({
      method: "GET",
      path: "/health",
      options: {
        isInternal: !this.exposeHealthCheck, // <== make this route internal with a flag for this so we can debug it locally
      },
      handler: async (request, h) => {
        const apps = await this.appManager.getAppDefinitions();
        const appStatuses = await this.getAppStatuses(apps);

        // Return the status of the server and the apps
        return h
          .response({
            status: "ok",
            apps: appStatuses,
          })
          .code(200);
      },
    });
  }

  /**
   * Retrieves the status of multiple applications.
   * @param apps - An array of AppDefinition objects representing the applications.
   * @returns A Promise that resolves to an array of AppStatus objects representing the status of each application.
   */
  private getAppStatuses(apps: AppDefinition[]): Promise<AppStatus[]> {
    const promises = apps.map((app) => this.getAppStatus(app));
    return Promise.all(promises);
  }

  /**
   * Retrieves the status of an app.
   * @param app - The app definition.
   * @returns A promise that resolves to the app status.
   */
  private getAppStatus(app: AppDefinition): Promise<AppStatus> {
    return new Promise<AppStatus>((resolve, reject) => {
      pm2.describe(app.name, (err, processDescription) => {
        if (err) {
          this.logger.error(`${err}`, ["method:ServerManager#getAppStatus", `app:${app.name}`]);
          reject(err);
        } else {
          // Add the status of the app to the appStatuses array
          const appStatus = {
            name: app.name,
            status: processDescription[0]?.pm2_env?.status,
            mem: processDescription[0]?.monit?.memory,
            cpu: processDescription[0]?.monit?.cpu,
          };
          resolve(appStatus);
        }
      });
    });
  }

  /**
    * Registers the "/register-app" route on the server.
    * This route handles the registration of a new app.
    * @private
    */
  private registerAppRoute() {
    this.server.route({
      method: "POST",
      path: "/register-app",
      handler: async (request, h) => {
        const tags = ["method:ServerManager#registerAppRoute"]
        const newApp = request.payload as AppDefinition;
        if (!newApp) {
          this.logger.error("Invalid app definition", tags);
          return this.respondWithError(h, "Invalid app definition", 400);
        }

        const apps = await this.appManager.getAppDefinitions();

        const conflictsExist = pmUtils.checkForConflicts(newApp, apps);
        if (conflictsExist) {
          this.logger.error(
            `App conflicts with existing app: ${conflictsExist}`,
            tags
          );
          return this.respondWithError(
            h,
            `App conflicts with existing app: ${conflictsExist}`,
            400
          );
        }

        const existingApp = pmUtils.findExistingAppMaybe(apps, newApp.name);
        if (existingApp && pmUtils.isSameAppDefinition(existingApp, newApp)) {
          return this.restartExistingApp(h, existingApp);
        }

        apps.push(newApp);

        if (!existingApp) {
          return this.startAndRegisterNewApp(h, newApp, apps);
        }

        this.logger.info(`App ${newApp.name} registered successfully`, tags);
        return this.respondWithSuccess(h, "App registered successfully");
      },
    });
  }

  /**
   * Responds with an error message and status code.
   *
   * @param h - The Hapi response toolkit.
   * @param message - The error message to be sent.
   * @param statusCode - The HTTP status code to be returned.
   * @returns The Hapi response object with the error message and status code.
   */
  private respondWithError(
    h: Hapi.ResponseToolkit,
    message: string,
    statusCode: number
  ) {
    this.logger.error(message, [`statusCode:${statusCode}`,"response:error"]);
    return h
      .response({
        status: "error",
        message: message,
      })
      .code(statusCode);
  }

  /**
   * Responds with a success message and HTTP 200 status code.
   *
   * @param h - The Hapi response toolkit.
   * @param message - The success message to include in the response.
   * @returns The Hapi response object with the success message and HTTP 200 status code.
   */
  private respondWithSuccess(h: Hapi.ResponseToolkit, message: string) {
    this.logger.debug(message, ["response:success"]);
    return h
      .response({
        status: "ok",
        message: message,
      })
      .code(200);
  }

  /**
   * Restarts an existing app.
   *
   * @param h - The Hapi response toolkit.
   * @param existingApp - The existing app definition.
   * @returns A promise that resolves with the response.
   */
  private restartExistingApp(
    h: Hapi.ResponseToolkit,
    existingApp: AppDefinition
  ) {
    this.logger.info(`Restarting app ${existingApp.name}`, ['pm2'])
    return new Promise((resolve, reject) => {
      pm2.restart(existingApp.name, (err) => {
        if (err) {
          this.logger.error(
            `Failed to restart app ${existingApp.name}: ${err}`,
            ["fn:server.route#register-app", "pm2.restart"]
          );
          resolve(
            this.respondWithError(
              h,
              `Failed to restart app ${existingApp.name}:`,
              400
            )
          );
        } else {
          this.logger.debug(`App ${existingApp.name} restarted successfully.`, [
            "fn:server.route#register-app",
            "pm2.restart",
          ]);
          resolve(this.respondWithSuccess(h, "App refreshed successfully"));
        }
      });
    });
  }

  /**
   * Starts and registers a new app.
   *
   * @param h - The Hapi response toolkit.
   * @param newApp - The definition of the new app to start and register.
   * @param apps - The array of existing app definitions.
   * @returns A promise that resolves with the response.
   */
  private startAndRegisterNewApp(
    h: Hapi.ResponseToolkit,
    newApp: AppDefinition,
    apps: AppDefinition[]
  ) {
    this.logger.info(`Starting app ${newApp.name}`, ['pm2'])
    return new Promise((resolve, reject) => {
      pm2.start(
        {
          name: newApp.name,
          script: newApp.script,
          env: {
            PORT: newApp.port.toString(),
            // add other environment variables here
          },
        },
        (err) => {
          if (err) {
            this.logger.error(`${err}`, [
              `app:${newApp.name}`,
              "method:ServerManager#startAndRegisterNewApp",
              "pm2",
              "start"
            ]);
            resolve(this.respondWithError(h, "Failed to start app", 500));
          }
          this.logger.debug(
            `App Successfully started! Registering new app ${newApp.name}`,
            ["method:ServerManager#startAndRegisterNewApp", "pm2", "start"]
          );
          this.registerApplicationVersion(newApp, apps);
          this.logRoutes();
          resolve(this.respondWithSuccess(h, "App registered successfully"));
        }
      );
    });
  }
}
