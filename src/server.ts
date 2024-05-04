import Hapi from "@hapi/hapi";
import H2o2 from "@hapi/h2o2";
import pm2, { ProcessDescription } from "pm2";

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: "localhost",
  });

  // Register the h2o2 plugin
  await server.register(H2o2);

  server.route({
    method: '*',
    path: '/{any*}',
    handler: {
        proxy: {
            host: '127.0.0.1', // replace with the host of your Next.js app
            port: 10000, // replace with the port of your Next.js app
            passThrough: true,
            xforward: true
        }
    }
});

  server.route({
    method: "GET",
    path: "/health",
    handler: async (request, h) => {
      try {
        // replace 'demo-app' with the name of your process
        const processDescription: ProcessDescription[] = await new Promise((resolve, reject) => {
          pm2.describe("demo-app", (err, processDescription) => {
            if (err) reject(err);
            else resolve(processDescription);
          });
        });

        if (
          !processDescription ||
          processDescription[0]?.pm2_env?.status !== "online"
        ) {
          return h.response("PM2 process is not running").code(500);
        }

        return "OK";
      } catch (err) {
        console.error(err);
        return h.response("Health check failed").code(500);
      }
    },
  });

  // Connect to PM2
  pm2.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(2);
    }

    // Check if the Next.js app is already running
    pm2.describe('demo-app', (err, processDescription: ProcessDescription[]) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        // If the process is not running, start it
        if (!processDescription || processDescription[0]?.pm2_env?.status !== 'online') {
            pm2.start({
                name: 'demo-app',
                script: './assets/demo-app/.next/standalone/server.js',
                env: {
                    'PORT': '10000',
                    // add other environment variables here
                }
            }, (err, apps) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
            });
        }
    });
});

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
