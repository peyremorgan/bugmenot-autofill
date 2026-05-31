import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

async function build() {
  // Clean and create dist directory
  mkdirSync("dist", { recursive: true });
  mkdirSync("dist/background", { recursive: true });
  mkdirSync("dist/content", { recursive: true });

  // Bundle background script
  await esbuild.build({
    entryPoints: ["src/background/index.js"],
    bundle: true,
    outfile: "dist/background/background.js",
    format: "iife",
    platform: "browser",
    target: "firefox57",
    banner: {
      js: "// BugMeNot Autofill - Background Script (bundled)"
    }
  });

  // Bundle content script
  await esbuild.build({
    entryPoints: ["src/content/index.js"],
    bundle: true,
    outfile: "dist/content/content.js",
    format: "iife",
    platform: "browser",
    target: "firefox57",
    banner: {
      js: "// BugMeNot Autofill - Content Script (bundled)"
    }
  });

  // Copy manifest.json to dist
  copyFileSync("manifest.json", "dist/manifest.json");

  console.log("✓ Build completed successfully!");
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
