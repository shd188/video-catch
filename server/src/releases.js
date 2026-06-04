import fs from "fs";
import path from "path";
import { getDb, getReleasesDir } from "./db.js";

export function getLatestRelease(channelId) {
  return getDb()
    .prepare(
      `SELECT * FROM releases WHERE channel_id = ?
       ORDER BY published_at DESC, id DESC LIMIT 1`
    )
    .get(channelId);
}

export function getReleaseFilePath(channelId, version) {
  const row = getDb()
    .prepare(`SELECT filename FROM releases WHERE channel_id = ? AND version = ?`)
    .get(channelId, version);
  if (!row) return null;
  const full = path.join(getReleasesDir(), channelId, row.filename);
  return fs.existsSync(full) ? full : null;
}

function upsertReleaseRow({ channelId, version, filename, releaseNotes }) {
  getDb()
    .prepare(
      `INSERT INTO releases (channel_id, version, filename, release_notes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(channel_id, version) DO UPDATE SET
         filename = excluded.filename,
         release_notes = excluded.release_notes,
         published_at = datetime('now')`
    )
    .run(channelId, version, filename, releaseNotes || null);
  return getDb()
    .prepare(`SELECT * FROM releases WHERE channel_id = ? AND version = ?`)
    .get(channelId, version);
}

export function listReleases(channelId) {
  if (channelId) {
    return getDb()
      .prepare(
        `SELECT * FROM releases WHERE channel_id = ? ORDER BY published_at DESC, id DESC`
      )
      .all(channelId);
  }
  return getDb()
    .prepare(`SELECT * FROM releases ORDER BY published_at DESC, id DESC LIMIT 100`)
    .all();
}

export function createRelease({ channelId, version, filename, releaseNotes }) {
  const dir = path.join(getReleasesDir(), channelId);
  const target = path.join(dir, filename);
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${target}. Upload zip in admin or copy file first.`);
  }
  return upsertReleaseRow({ channelId, version, filename, releaseNotes });
}

/** 管理后台上传 zip 后登记版本 */
export function registerRelease({ channelId, version, filename, releaseNotes }) {
  const dir = path.join(getReleasesDir(), channelId);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  if (!fs.existsSync(target)) {
    throw new Error(`Upload failed: ${target}`);
  }
  return upsertReleaseRow({ channelId, version, filename, releaseNotes });
}

export function sanitizeReleaseFilename(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildDownloadUrl(publicBaseUrl, channelId, version, licenseKey, installationId) {
  const q = new URLSearchParams({
    channel: channelId,
    version,
    key: licenseKey,
    installation_id: installationId,
  });
  return `${publicBaseUrl.replace(/\/$/, "")}/api/v1/download?${q}`;
}
