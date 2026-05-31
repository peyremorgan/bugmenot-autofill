#!/bin/bash

# Package the extension as an XPI file

echo "Creating bugmenot-autofill.xpi..."

zip -r -FS bugmenot-autofill.xpi \
  manifest.json \
  background/ \
  content/ \
  -x "*.git*" "node_modules/*" "tests/*" "*.md" "package*.json" "*.config.js"

echo "Done! Load bugmenot-autofill.xpi in LibreWolf via about:debugging"
