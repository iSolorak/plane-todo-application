#!/usr/bin/env node
/**
 * Monorepo dev-server fix for the pnpm "hoisted" layout.
 *
 * Expo Router serves the app entry from a projectRoot-relative URL
 * (`/node_modules/expo-router/entry.bundle`). With `.npmrc` `node-linker=hoisted`,
 * expo-router is installed at the WORKSPACE root, not in apps/mobile/node_modules,
 * so Metro's dev server can't resolve/hash the entry and fails with
 * "Failed to get the SHA-1 for: .../expo-router/entry.js".
 *
 * This recreates a local `apps/mobile/node_modules/expo-router` symlink pointing
 * at the hoisted copy. It's idempotent and safe to run on every install.
 * (Production bundling via `expo export` doesn't need this; the dev server does.)
 */
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const target = path.join(workspaceRoot, "node_modules", "expo-router");
const linkDir = path.join(projectRoot, "node_modules");
const linkPath = path.join(linkDir, "expo-router");

function log(msg) {
  console.log(`[link-expo-router] ${msg}`);
}

if (!fs.existsSync(target)) {
  // Nothing to link yet (e.g. deps not installed) — not an error.
  log(`skipped: ${path.relative(workspaceRoot, target)} not found`);
  process.exit(0);
}

// Already resolvable (real dir or correct symlink)? Leave it alone.
if (fs.existsSync(path.join(linkPath, "entry.js"))) {
  process.exit(0);
}

fs.mkdirSync(linkDir, { recursive: true });
try {
  fs.rmSync(linkPath, { recursive: true, force: true });
} catch {
  /* nothing to remove */
}

// Absolute target + platform-appropriate type (junction avoids the Windows
// symlink-privilege requirement; "dir" is a normal symlink elsewhere).
const type = process.platform === "win32" ? "junction" : "dir";
fs.symlinkSync(target, linkPath, type);
log(`linked node_modules/expo-router -> ${path.relative(workspaceRoot, target)}`);
