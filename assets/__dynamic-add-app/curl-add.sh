#!/bin/bash

curl -X POST -H "Content-Type: application/json" -d '{
    "name": "@ck/dynamic-add-app@v0.1.0",
    "script": "./assets/dynamic-add-app/.next/standalone/server.js",
    "port": 11000,
    "path": "/dynamic-add-app"
}' http://localhost:3000/register-app