#!/bin/bash

rm -f radio_fip.zip

cd radio_fip

zip -r ../radio_fip.zip . \
-x ".DS_Store" \
-x "*/.DS_Store" \
-x "__MACOSX/*" \
-x "*/._*" \
-x ".git/*" \
-x "nodes_modules" \
-x ".gitignore" \
-x "*.zip"

cd ..

