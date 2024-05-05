import Hapi from "@hapi/hapi";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import extract from 'extract-zip';
import { Logger } from "../logger/types";

export class NotificationServer {
  private server: Hapi.Server;

  constructor(
    private logger: Logger,
    private port: number = 3001,
    private host: string = "localhost",
    private rootDir: string,
    private messageToUrl: string
  ) {
    this.server = Hapi.server({
      port,
      host,
    });
  }

  async init() {
    this.server.route({
      method: "POST",
      path: "/upload",
      options: {
        payload: {
          output: "stream",
          parse: true,
          allow: "multipart/form-data",
          maxBytes: 10485760 // Increase limit to 10MB
        },
      },
      handler: async (request, h) => {
        this.logger.info("Received POST request", ["notification-server"]);
        const data = request.payload;
        this.logger.info(`Data: ${JSON.stringify(data)}`, ["notification-server"]);
        const file = (data as any)["file"];

        const filePath = path.join(
          path.resolve(this.rootDir),
          file.hapi.filename
        );
        const fileStream = fs.createWriteStream(filePath);

        return new Promise((resolve, reject) => {
          file.pipe(fileStream);
          file.on("end", async (err: any) => {
            const ret = {
              filename: file.hapi.filename,
              headers: file.hapi.headers,
            };

            // Define the data to send
            const data = {
              name: "@ck/dynamic-add-app@v0.1.0",
              script: "./assets/dynamic-add-app/.next/standalone/server.js",
              port: 11000,
              path: "/dynamic-add-app",
            };

            // Send the POST request
            const response = await this.sendPostRequest(
              "http://localhost:3000/register-app",
              data
            );

            // Log the response
            this.logger.info(
              `Response from POST request: ${JSON.stringify(response)}`,
              ["notification-server"]
            );

            resolve(h.response(ret));
          });
          file.pipe(unzipper.Extract({ path: "destination_path" }));
        });
      },
    });

    // Try another way since curl upload does not appear to work
    this.server.route({
      method: 'GET',
      path: '/install',
      handler: async (request, h) => {
        const filePath = request.query.filePath;
        const dirName = '@ck/dynamic-add-app@v0.1.0'; //filePath.split("/").pop().replace(".zip", "");
        const targetPath = this.rootDir + '/' + dirName; // Replace with your target directory

        // Unzip the file
        try {
          await extract(filePath, { dir: path.resolve(targetPath) });
          this.logger.info(`Successfully unzipped ${filePath} to ${targetPath}`, ['notification-server']);
        } catch (err) {
          this.logger.error(`Failed to unzip ${filePath}: ${err}`, ['notification-server']);
          return h.response('Failed to unzip file').code(500);
        }

        // Define the data to send
        const data = {
          name: "@ck/dynamic-add-app@v0.1.0",
          script: `./assets/@ck/dynamic-add-app@v0.1.0/.next/standalone/server.js`,
          port: 11000,
          path: "/dynamic-add-app",
        };

        // Send the POST request
        try {
          const response = await this.sendPostRequest("http://localhost:3000/register-app", data);
          return h.response('File unzipped and POST request sent').code(200);
        } catch (err) {
          this.logger.error(`Failed to send POST request: ${err} using data: ${JSON.stringify(data, null, 2)}`, ['notification-server']);
          return h.response('Failed to send POST request').code(500);
        }
      }
    });

    await this.server.start();
    this.logger.info(`Server running on ${this.server.info.uri}`, [
      "notification-server",
    ]);
  }

  async sendPostRequest(url: string, data: any) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error sending POST request: ${error}`, [
        "notification-server",
      ]);
      throw error;
    }
  }
}
