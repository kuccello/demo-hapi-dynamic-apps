import Hapi from "@hapi/hapi";
import H2o2 from "@hapi/h2o2";
import pm2 from "pm2";
import type {
  ProcessStatus,
  AppDefinition
} from "./process-manager/types";
import * as pmUtils from "./process-manager/utils";

// Define your applications
const apps: AppDefinition[] = [
  {
    name: "@ck/error-page@v0.1.0",
    script: "./assets/error-page/.next/standalone/server.js",
    port: 9999,
    path: "/error-page",
  },
  {
    name: "@ck/home@v0.1.0",
    script: "./assets/home/.next/standalone/server.js",
    port: 10000,
    path: "",
  },
  {
    name: "@ck/demo-app@v0.1.0",
    script: "./assets/demo-app/.next/standalone/server.js",
    port: 10001,
    path: "/demo-app",
  },
  {
    name: "@ck/demo-app-2@v0.1.0",
    script: "./assets/demo-app-2/.next/standalone/server.js",
    port: 10002,
    path: "/demo-app-2",
  },
  // add more applications as needed
];

function registerApplicationVersion(server: Hapi.Server<Hapi.ServerApplicationState>, newApp: AppDefinition, apps: AppDefinition[]) {
  server.route({
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
            if(!app) {
              return h.redirect("/error").takeover().code(404);
            }
            return new Promise((resolve, reject) => {
              pm2.describe(app.name, (err, processDescription) => { // I suspect this is costly to call every time and will need to be optimized
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
  server.route({
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

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: "localhost",
  });

  // Register the h2o2 plugin
  await server.register(H2o2);

  // Connect to PM2
  pm2.connect((err) => {
    if (err) {
      console.error(err);
      process.exit(2);
    }

    // For each application
    for (const app of apps) {
      // Check if the app is already running
      pm2.describe(app.name, (err, processDescription) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        // If the app is not running, start it
        if (
          !processDescription ||
          processDescription[0]?.pm2_env?.status !== "online"
        ) {
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
                console.error(err);
                // process.exit(1);
              }
            }
          );
        }
      });

      // Register the application
      const routes = server.table();
      routes.forEach(route => {
        console.log(`Path: ${route.path}, Method: ${route.method}`);
      });
      const conflictsExist = pmUtils.checkForConflicts(app, apps.filter((_app:AppDefinition) => _app.name !== app.name));
      if (conflictsExist) {
        console.error(`App ${app.name} conflicts with existing app: ${conflictsExist}`);
        // process.exit(1);
        continue;
      }
      console.info(`Registering app ${app.name}`);
      registerApplicationVersion(server, app, apps);
    }
  });

  // Add a health check route
  server.route({
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

  // Add a route to register new apps
  server.route({
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

      const conflictsExist = pmUtils.checkForConflicts(newApp, apps);
      if (conflictsExist) {
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
            console.error(`Failed to restart app ${existingApp.name}:`, err);
            return h
              .response({
                status: "error",
                message: `Failed to restart app ${existingApp.name}:`,
                error: err,
              })
              .code(400);
          } else {
            console.log(`App ${existingApp.name} restarted successfully.`);
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
              console.error(err);
              return h
                .response({ status: "error", message: "Failed to start app" })
                .code(500);
            }
            console.log("App Successfully started! Registering new app", newApp.name);
            // Set up the route for the new app
            registerApplicationVersion(server, newApp, apps);
            const routes = server.table();
            routes.forEach(route => {
              console.log(`Path: ${route.path}, Method: ${route.method}`);
            });
          }
        );
      }

      return h
        .response({ status: "ok", message: "App registered successfully" })
        .code(200);
    },
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();

