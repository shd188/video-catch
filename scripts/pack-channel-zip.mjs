#!/usr/bin/env node
/**
 * GPL-3.0 — Pack dist/<channel>/ into releases/<channel>-<version>.zip
 * Zip root folder is the channel id (e.g. xiaoetong/) so users extract to a stable name.
 * Usage: node scripts/pack-channel-zip.mjs <channel-id>
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const channelId = process.argv[2];
if (!channelId) {
    console.error("Usage: npm run pack -- <channel-id>");
    console.error("Example: npm run pack -- xiaoetong");
    process.exit(1);
}

const srcDir = path.join(ROOT, "dist", channelId);
const manifestPath = path.join(srcDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
    console.error(`Missing ${manifestPath}. Run: npm run build -- ${channelId}`);
    process.exit(1);
}

const version = JSON.parse(fs.readFileSync(manifestPath, "utf8")).version;
const releasesDir = path.join(ROOT, "releases");
const archiveName = `${channelId}-${version}.zip`;
const archivePath = path.join(releasesDir, archiveName);

fs.mkdirSync(releasesDir, { recursive: true });
if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
}

const distDir = path.join(ROOT, "dist");
const excludes = [
    `${channelId}/server/*`,
    `${channelId}/.DS_Store`,
    `${channelId}/*/.DS_Store`,
    `${channelId}/.cursor/*`,
].map((x) => `-x "${x}"`).join(" ");

execSync(
    `cd "${distDir}" && zip -r "${archivePath}" "${channelId}" ${excludes}`,
    { stdio: "inherit" }
);

console.log("Done.");
console.log(`  Archive: ${archivePath}`);
console.log(`  Version: ${version}`);
console.log(`  Extract folder: ${channelId}/`);
console.log(`  User download name (via API): ${channelId}.zip`);
