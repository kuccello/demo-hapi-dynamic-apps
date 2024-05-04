#!/bin/bash

# Prepare the demo app for the standalone build
cd ./demo-app
npm install
npm run build
# mkdir -p ./.next/standalone
cp -r ./public ./.next/standalone
# mkdir -p ./.next/standalone/.next/static
cp -r ./.next/static ./.next/standalone/.next/static