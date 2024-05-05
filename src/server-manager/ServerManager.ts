import Hapi from "@hapi/hapi";
import H2o2 from "@hapi/h2o2";
import pm2 from "pm2";
import type { AppDefinition, ProcessStatus } from "../process-manager/types";
import { Logger } from "../logger/types";
import { PortScanner } from "../port-scanner/PortScanner";
import { AppManager } from "../app-manager/AppManager";
import * as pmUtils from "../process-manager/utils";

export class ServerManager {
  private readonly server: Hapi.Server<Hapi.ServerApplicationState>;

  constructor(
    private logger: Logger,
    private port: number = 3000,
    private host: string = "localhost",
    private portScanner: PortScanner,
    private appManager: AppManager,
  ) {
    this.server = new Hapi.Server<Hapi.ServerApplicationState>({
      port,
      host,
    });
  }

  public async init() {
    this.logger.info("Initializing server...", ["server-manager"]);

    // Register the h2o2 plugin
    await this.server.register(H2o2);

    await this.connectAndManageApps();

    this.registerHealthCheckRoute();
    this.registerAppRoute();

    await this.server.start();
    this.logger.info(`Server running on ${this.server.info.uri}`, ['fn:init']);
  }

  public registerApplicationVersion(newApp: AppDefinition, apps: AppDefinition[]) {
    this.server.route({
      method: "*",
      path: `${newApp.path}/{any*}`,
      handler: {
        proxy: {
          mapUri: (request) => {
            const version = request.query.version; // TODO - here we can add a toggle check for version
            let port = newApp.port;

            // If a version query parameter is provided, find the corresponding app and port
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
          },
          passThrough: true,
          xforward: true,
        },
      },
      options: {
        pre: [
          // Add a pre method to perform a health check
          {
            method: async (request, h) => {
              let app = newApp;
              const version = request.query.version; // TODO - here we can add a toggle check for version
              if (version) {
                const versionApp = apps.find(
                  (app) => pmUtils.decomposeAppName(app).version === `${version}`
                );
                if (versionApp) {
                  app = versionApp;
                }
              }
              if (!app) {
                return h.redirect("/error").takeover().code(404);
              }
              return new Promise((resolve, reject) => {
                pm2.describe(app.name, (err, processDescription) => {
                  // I suspect this is costly to call every time and will need to be optimized
                  if (err) {
                    reject(err);
                  } else {
                    // If the app is not running, redirect to an error page
                    if (processDescription[0]?.pm2_env?.status !== "online") {
                      return h.redirect("/error").takeover();
                    }

                    resolve(h.continue);
                  }
                });
              });
            },
            assign: "healthCheck",
          },
        ],
      },
    });
    this.server.route({
      method: "GET",
      path: `/health/${newApp.name}`,
      options: {
        isInternal: true, // make this route internal
      },
      handler: async (request, h) => {
        return new Promise((resolve, reject) => {
          pm2.describe(newApp.name, (err, processDescription) => {
            if (err) {
              reject(err);
            } else {
              // Return the status of the app
              resolve(
                h
                  .response({
                    name: newApp.name,
                    status: processDescription[0]?.pm2_env?.status,
                  })
                  .code(200)
              );
            }
          });
        });
      },
    });
  }

  private connectAndManageApps(): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          this.logger.error(`${err}`);
          process.exit(2);
        }

        this.appManager.getAppDefinitions().then((apps) => {
          for (const app of apps) {
            pm2.describe(app.name, (err, processDescription) => {
              if (err) {
                this.logger.error(`${err}`);
                process.exit(1);
              }

              if (!processDescription || processDescription[0]?.pm2_env?.status !== 'online') {
                pm2.start({
                  name: app.name,
                  script: app.script,
                  env: {
                    PORT: app.port.toString(),
                    // add other environment variables here
                  },
                }, (err, apps) => {
                  if (err) {
                    this.logger.error(`${err}`);
                  }
                });
              }
            });

            const routes = this.server.table();
            routes.forEach((route) => {
              this.logger.info(`Path: ${route.path}, Method: ${route.method}`, ['fn:init']);
            });

            const conflictsExist = pmUtils.checkForConflicts(
              app,
              apps.filter((_app: AppDefinition) => _app.name !== app.name)
            );

            if (conflictsExist) {
              this.logger.error(`App ${app.name} conflicts with existing app: ${conflictsExist}`, ['fn:init']);
              continue;
            }

            this.logger.info(`Registering app ${app.name}`, ['fn:init']);
            this.registerApplicationVersion(app, apps);
          }
          resolve();
        }).catch(reject);
      });
    });
  }

  private registerHealthCheckRoute() {
    this.server.route({
      method: "GET",
      path: "/health",
      options: {
        isInternal: true, // make this route internal
      },
      handler: async (request, h) => {
        const appStatuses: {
          name: string;
          status: ProcessStatus | undefined;
          mem: number | undefined;
          cpu: number | undefined;
        }[] = [];

        const apps = await this.appManager.getAppDefinitions();

        // Use a promise to handle the asynchronous nature of the pm2.describe function
        const promises = apps.map(
          (app) =>
            new Promise<void>((resolve, reject) => {
              pm2.describe(app.name, (err, processDescription) => {
                if (err) {
                  reject(err);
                } else {
                  // Add the status of the app to the appStatuses array
                  appStatuses.push({
                    name: app.name,
                    status: processDescription[0]?.pm2_env?.status,
                    mem: processDescription[0]?.monit?.memory,
                    cpu: processDescription[0]?.monit?.cpu,
                  });
                  resolve();
                }
              });
            })
        );

        // Wait for all promises to resolve
        await Promise.all(promises);

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

  private registerAppRoute() {
    this.server.route({
      method: "POST",
      path: "/register-app",
      // TODO: re-enable this after local testing
      // options: {
      //   isInternal: true, // make this route internal
      // },
      handler: async (request, h) => {
        // Get the app details from the request payload
        const newApp = request.payload as AppDefinition;
        if (!newApp) {
          return h
            .response({
              status: "error",
              message: "Invalid app definition",
            })
            .code(400);
        }

        const apps = await this.appManager.getAppDefinitions();

        const conflictsExist = pmUtils.checkForConflicts(newApp, apps);
        if (conflictsExist) {
          this.logger.error(`App conflicts with existing app: ${conflictsExist}`, ['fn:server.route#register-app']);
          return h
            .response({
              status: "error",
              message: `App conflicts with existing app: ${conflictsExist}`,
            })
            .code(400);
        }
        const existingApp = pmUtils.findExistingAppMaybe(apps, newApp.name);
        if (existingApp && pmUtils.isSameAppDefinition(existingApp, newApp)) {
          pm2.restart(existingApp.name, (err) => {
            if (err) {
              this.logger.error(`Failed to restart app ${existingApp.name}: ${err}`, ['fn:server.route#register-app', 'pm2.restart']);
              return h
                .response({
                  status: "error",
                  message: `Failed to restart app ${existingApp.name}:`,
                  error: err,
                })
                .code(400);
            } else {
              this.logger.debug(`App ${existingApp.name} restarted successfully.`, ['fn:server.route#register-app', 'pm2.restart']);
              return h
                .response({
                  status: "ok",
                  message: "App refreshed successfully",
                })
                .code(200);
            }
          });
        }

        // Add the new app to the apps array
        apps.push(newApp);

        if (!existingApp) {
          // Start the new app using PM2
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
                this.logger.error(`${err}`, ['fn:server.route#register-app', 'pm2.start']);
                return h
                  .response({ status: "error", message: "Failed to start app" })
                  .code(500);
              }
              this.logger.debug(
                `App Successfully started! Registering new app ${newApp.name}`,
                ['fn:server.route#register-app', 'pm2.start']
              );
              // Set up the route for the new app
              this.registerApplicationVersion(newApp, apps);
              const routes = this.server.table();
              routes.forEach((route) => {
                this.logger.debug(`Path: ${route.path}, Method: ${route.method}`, ['fn:server.route#register-app']);
              });
            }
          );
        }
        this.logger.info(`App ${newApp.name} registered successfully`, ['fn:server.route#register-app']);
        return h
          .response({ status: "ok", message: "App registered successfully" })
          .code(200);
      },
    });
  }
}
