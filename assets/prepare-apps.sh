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

    # Get the directory name from the path
    dir_name=$(basename $dir)

    # Check if the directory name is __dynamic-add-app
    if [ "$dir_name" = "__dynamic-add-app" ]; then
      # Create the filename for the zip file
      zip_file="$HOME/_ck__dynamic-add-app_v0.1.0.zip"

      # Make a zip of the app for testing
      zip -r $zip_file ./.next/standalone
    fi

    # Go back to the parent directory
    cd ../..
  fi
done