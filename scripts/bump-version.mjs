#!/usr/bin/env node
// Bumps the version in package.json, src-tauri/Cargo.toml and
// src-tauri/tauri.conf.json together, so they never drift apart.
//
// Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkgPath = path.join(root, "package.json");
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Not a valid semver version: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const { major, minor, patch } = parseSemver(current);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump type: ${bump} (use patch, minor, major, or X.Y.Z)`);
}

const bump = process.argv[2];
if (!bump) {
  console.error("Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const currentVersion = pkg.version;
const newVersion = nextVersion(currentVersion, bump);

pkg.version = newVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

let cargoToml = readFileSync(cargoPath, "utf8");
cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${newVersion}"`);
writeFileSync(cargoPath, cargoToml);

const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = newVersion;
writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);

console.log(`Bumped version: ${currentVersion} -> ${newVersion}`);
console.log("Updated: package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json");
console.log(`Next: git commit -am "Bump version to ${newVersion}" && git tag v${newVersion} && git push && git push --tags`);
