Example of working system

You will need several terminals to see it in action

1. NotificationServer
2. WRS Server
3. PM2 inspector
4. Curl

Steps:

1. npm i
2. npm run demo:build
3. in the "NotificationServer" terminal run: `npm run dev:start:notification-server`
4. in the "WRS Server" terminal run `npm run dev:start`
5. in the "PM2 inspector" terminal run `pm2 l` - you will see all the running next apps (note the absence of the `@ck/dynamic-add-app@v0.1.0` process)
6. in the "Curl" terminal execute: `curl -X GET "http://localhost:3001/install?filePath=<YOUR-HOME-DIRECTORY-PATH>/_ck__dynamic-add-app_v0.1.0.zip"`
7. in the "PM2 inspector" terminal run `pm2 l` - you will see all the running next apps (note presence of the `@ck/dynamic-add-app@v0.1.0` process)
8. visit `http://localhost:3000/dynamic-add-app
9. visit `http://localhost:3000/health/@ck/dynamic-add-app@v0.1.0
10. visit `http://localhost:3000/health