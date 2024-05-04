import Hapi from "@hapi/hapi";
import H2o2 from "@hapi/h2o2";
import pm2, { ProcessDescription } from "pm2";

type ProcessStatus = 'online' | 'stopping' | 'stopped' | 'launching' | 'errored' | 'one-launch-status';

// Define your applications
const apps = [
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
                process.exit(1);
              }
            }
          );
        }
      });

      server.route({
        method: 'GET',
        path: `/health/${app.name}`,
        options: {
          isInternal: true, // make this route internal
        },
        handler: async (request, h) => {
          return new Promise((resolve, reject) => {
            pm2.describe(app.name, (err, processDescription) => {
              if (err) {
                reject(err);
              } else {
                // Return the status of the app
                resolve(h.response({
                  name: app.name,
                  status: processDescription[0]?.pm2_env?.status,
                }).code(200));
              }
            });
          });
        },
      });

      // Add a route that proxies calls to the app
      server.route({
        method: "*",
        path: `${app.path}/{any*}`,
        handler: {
          proxy: {
            host: "127.0.0.1",
            port: app.port,
            passThrough: true,
            xforward: true,
          },
        },
        options: {
          pre: [
            // Add a pre method to perform a health check
            {
              method: async (request, h) => {
                return new Promise((resolve, reject) => {
                  pm2.describe(app.name, (err, processDescription) => {
                    if (err) {
                      reject(err);
                    } else {
                      // If the app is not running, redirect to an error page
                      if (processDescription[0]?.pm2_env?.status !== 'online') {
                        console.error(`App ${app.name} is not running`)
                        resolve(h.redirect('/error-page').takeover());
                      }

                      resolve(h.continue);
                    }
                  });
                });
              },
              assign: 'healthCheck',
            },
          ],
        },
      });

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
      const appStatuses: { name: string; status: ProcessStatus | undefined; mem: number | undefined; cpu: number | undefined; }[] = [];

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

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
