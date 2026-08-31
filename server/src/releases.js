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

function fileIfExists(filePath) {
  return filePath && fs.existsSync(filePath) ? filePath : null;
}

function findZipInDir(dir, { filename, version }) {
  if (!dir || !fs.existsSync(dir)) return null;
  if (filename) {
    const exact = fileIfExists(path.join(dir, filename));
    if (exact) return exact;
  }
  const zips = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".zip") && (!version || name.includes(version)));
  if (zips.length === 1) return path.join(dir, zips[0]);
  if (filename && zips.includes(filename)) return path.join(dir, filename);
  return null;
}

/** 按 DB 记录解析磁盘上的 zip（兼容上传到 default/ 目录的历史包） */
export function resolveReleaseFilePath(channelId, version) {
  const row = getDb()
    .prepare(`SELECT filename FROM releases WHERE channel_id = ? AND version = ?`)
    .get(channelId, version);
  if (!row) return null;
  const base = getReleasesDir();
  const hints = { filename: row.filename, version };
  return (
    findZipInDir(path.join(base, channelId), hints) ||
    findZipInDir(path.join(base, "default"), hints) ||
    findZipInDir(base, hints)
  );
}

export function getReleaseFilePath(channelId, version) {
  return resolveReleaseFilePath(channelId, version);
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

/** 删除版本记录，并可选删除磁盘上的 zip */
export function deleteRelease({ channelId, version, removeFile = true }) {
  const row = getDb()
    .prepare(`SELECT * FROM releases WHERE channel_id = ? AND version = ?`)
    .get(channelId, version);
  if (!row) {
    throw new Error("版本记录不存在");
  }
  const filePath = resolveReleaseFilePath(channelId, version);
  const deleted = getDb()
    .prepare(`DELETE FROM releases WHERE channel_id = ? AND version = ?`)
    .run(channelId, version);
  if (deleted.changes === 0) {
    throw new Error("版本记录不存在");
  }
  let fileRemoved = false;
  if (removeFile && filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    fileRemoved = true;
  }
  return {
    channel_id: channelId,
    version,
    filename: row.filename,
    file_removed: fileRemoved,
  };
}

export function sanitizeReleaseFilename(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** 用户下载时的文件名：仅渠道名，不含版本号 */
export function releaseDownloadFilename(channelId) {
  const id = String(channelId || "").trim();
  return id ? `${id}.zip` : "extension.zip";
}

/** 发货页直链：最新版本且磁盘上有 zip */
export function getLatestPackage(channelId) {
  const latest = getLatestRelease(channelId);
  if (!latest) return null;
  const filePath = resolveReleaseFilePath(channelId, latest.version);
  if (!filePath) return null;
  return {
    channel_id: channelId,
    version: latest.version,
    filename: releaseDownloadFilename(channelId),
    stored_filename: latest.filename,
    filePath,
  };
}

export function buildDownloadUrl(
  publicBaseUrl,
  channelId,
  version,
  licenseKey,
  installationId,
  { strict = false } = {}
) {
  const q = new URLSearchParams({
    channel: channelId,
    version,
    installation_id: installationId,
    strict: strict ? "1" : "0",
  });
  if (licenseKey) {
    q.set("key", licenseKey);
  }
  return `${publicBaseUrl.replace(/\/$/, "")}/api/v1/download?${q}`;
}
