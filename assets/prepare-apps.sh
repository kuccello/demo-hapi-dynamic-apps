#!/bin/bash

# Loop over each directory in the assets directory
for dir in ./assets/*/
do
  # Remove the trailing slash
  dir=${dir%*/}

  # Check if the next.config.mjs file exists in the directory
  if [[ -f "$dir/next.config.mjs" ]]; then
    # Get the name of the app
    app=${dir##*/}

    echo "Preparing $app..."

    # Change to the app's directory
    cd $dir

    # Install the dependencies and build the app
    npm install
    npm run build

    # Copy the public and static directories to the standalone build directory
    cp -r ./public ./.next/standalone
    cp -r ./.next/static ./.next/standalone/.next/static

    # Go back to the parent directory
    cd ../..
  fi
done