import { getDb } from "./db.js";
import { sphDlCreateCodes, sphDlLookupCode, getSphDlConfig } from "./sph-dl-client.js";

/** 兑换码套餐：可解析/使用次数（与 sph-dl 一致） */
export const REDEEM_PACKS = [1, 5, 10, 30, 50, 100];

export function normalizeRedeemCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

export function isValidRedeemPack(pack) {
  return REDEEM_PACKS.includes(Number(pack));
}

export function findRedeemByCode(code) {
  const key = normalizeRedeemCode(code);
  if (!key) return null;
  return getDb().prepare(`SELECT * FROM redeem_codes WHERE code = ?`).get(key);
}

function isActivatedAt(value) {
  return Boolean(value);
}

function mapRedeemRow(row) {
  if (!row) return null;
  const remaining = Number(row.remaining);
  const total = Number(row.total);
  const activated_at = row.activated_at || null;
  const is_used = remaining < total;
  const is_activated = !is_used && isActivatedAt(activated_at);
  return {
    ...row,
    pack: Number(row.pack),
    total,
    remaining,
    used: Math.max(0, total - remaining),
    activated_at,
    is_used,
    is_activated,
    is_unused: !is_used && !is_activated,
    is_exhausted: remaining <= 0,
  };
}

/** 将 sph-dl 返回的码写入本地镜像（便于后台查询） */
function mirrorRedeemCodes({ pack, codes, details, note }) {
  const p = Number(pack);
  const batchNote = note || null;
  const insert = getDb().prepare(
    `INSERT INTO redeem_codes (code, pack, total, remaining, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       remaining = excluded.remaining,
       updated_at = datetime('now'),
       note = COALESCE(redeem_codes.note, excluded.note)`
  );
  const detailByCode = new Map(
    (details || []).map((d) => [normalizeRedeemCode(d.code), d])
  );
  const run = getDb().transaction((list) => {
    for (const raw of list) {
      const code = normalizeRedeemCode(raw);
      const d = detailByCode.get(code);
      const total = Number(d?.total ?? p);
      const remaining = Number(d?.remaining ?? total);
      insert.run(code, p, total, remaining, batchNote);
    }
  });
  run(codes);
}

/**
 * 经 sph-dl 生成兑换码（写入 KV），并镜像到本地库
 */
export async function createRedeemCode({ pack, note } = {}) {
  const result = await createRedeemCodesBulk({ pack, count: 1, note });
  const code = result.codes[0];
  return mapRedeemRow(findRedeemByCode(code));
}

/**
 * 批量：先调 sph-dl POST /api/admin/codes，再镜像本地
 */
export async function createRedeemCodesBulk({ pack, count, note } = {}) {
  const p = Number(pack);
  if (!isValidRedeemPack(p)) {
    throw new Error(`套餐无效，仅支持：${REDEEM_PACKS.join("/")}`);
  }
  const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 2000);
  const batchNote = note || `redeem-${p}-${new Date().toISOString().slice(0, 10)}`;

  const remote = await sphDlCreateCodes(p, n);
  mirrorRedeemCodes({
    pack: p,
    codes: remote.codes,
    details: remote.details,
    note: batchNote,
  });

  const csv = ["code,pack,total,remaining,note"]
    .concat(
      remote.codes.map((c) => {
        const row = findRedeemByCode(c);
        const total = row?.total ?? p;
        const remaining = row?.remaining ?? p;
        return `${c},${p},${total},${remaining},${(batchNote || "").replace(/,/g, " ")}`;
      })
    )
    .join("\n");

  return {
    pack: p,
    count: remote.codes.length,
    note: batchNote,
    codes: remote.codes,
    csv,
    source: "sph-dl",
  };
}

/** 从 sph-dl 同步一批码的剩余次数到本地镜像 */
export async function syncRedeemRemaining(codes) {
  const { apiBase, adminToken } = getSphDlConfig();
  if (!apiBase || !adminToken || !codes?.length) {
    return { synced: 0, skipped: true };
  }
  const update = getDb().prepare(
    `UPDATE redeem_codes
     SET remaining = ?,
         activated_at = CASE
           WHEN ? IS NOT NULL AND (activated_at IS NULL OR activated_at = '') THEN ?
           ELSE activated_at
         END,
         updated_at = datetime('now')
     WHERE code = ?`
  );
  let synced = 0;
  for (const raw of codes) {
    const code = normalizeRedeemCode(raw);
    if (!code) continue;
    try {
      const info = await sphDlLookupCode(code);
      if (info?.ok && info.remaining != null) {
        const activatedAt = info.activatedAt || info.activated_at || null;
        update.run(Number(info.remaining), activatedAt, activatedAt, code);
        synced += 1;
      }
    } catch {
      /* 单条失败跳过 */
    }
  }
  return { synced, skipped: false };
}

export function redeemCodeStats({ pack } = {}) {
  const packNum = pack != null && pack !== "" ? Number(pack) : null;
  const row =
    packNum != null && isValidRedeemPack(packNum)
      ? getDb()
          .prepare(
            `SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN remaining = total AND (activated_at IS NULL OR activated_at = '') THEN 1 ELSE 0 END) AS unused,
              SUM(CASE WHEN remaining = total AND activated_at IS NOT NULL AND activated_at != '' THEN 1 ELSE 0 END) AS activated,
              SUM(CASE WHEN remaining < total THEN 1 ELSE 0 END) AS used,
              COALESCE(SUM(remaining), 0) AS remaining_credits
             FROM redeem_codes WHERE pack = ?`
          )
          .get(packNum)
      : getDb()
          .prepare(
            `SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN remaining = total AND (activated_at IS NULL OR activated_at = '') THEN 1 ELSE 0 END) AS unused,
              SUM(CASE WHEN remaining = total AND activated_at IS NOT NULL AND activated_at != '' THEN 1 ELSE 0 END) AS activated,
              SUM(CASE WHEN remaining < total THEN 1 ELSE 0 END) AS used,
              COALESCE(SUM(remaining), 0) AS remaining_credits
             FROM redeem_codes`
          )
          .get();
  return {
    pack: packNum != null && isValidRedeemPack(packNum) ? packNum : null,
    packs: REDEEM_PACKS,
    total: Number(row?.total ?? 0),
    unused: Number(row?.unused ?? 0),
    activated: Number(row?.activated ?? 0),
    used: Number(row?.used ?? 0),
    remaining_credits: Number(row?.remaining_credits ?? 0),
  };
}

/** unused=未激活未使用, activated=已激活未使用, used=只要用过 1 次 */
function statusClause(status) {
  if (status === "unused") {
    return "AND remaining = total AND (activated_at IS NULL OR activated_at = '')";
  }
  if (status === "activated") {
    return "AND remaining = total AND activated_at IS NOT NULL AND activated_at != ''";
  }
  if (status === "used") return "AND remaining < total";
  return "";
}

/** 模糊搜兑换码 */
function redeemSearchClause(q) {
  const raw = String(q || "").trim();
  if (!raw) return { clause: "", params: [] };
  const needle = `%${raw.replace(/[%_\\]/g, "\\$&")}%`;
  return {
    clause: `AND code LIKE ? ESCAPE '\\'`,
    params: [needle],
  };
}

export function countRedeemCodes({ pack, status, q = "" } = {}) {
  const packNum = pack != null && pack !== "" ? Number(pack) : null;
  const st = statusClause(status);
  const search = redeemSearchClause(q);
  if (packNum != null && isValidRedeemPack(packNum)) {
    return Number(
      getDb()
        .prepare(`SELECT COUNT(*) AS c FROM redeem_codes WHERE pack = ? ${st} ${search.clause}`)
        .get(packNum, ...search.params)?.c ?? 0
    );
  }
  return Number(
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM redeem_codes WHERE 1=1 ${st} ${search.clause}`)
      .get(...search.params)?.c ?? 0
  );
}

export function listRedeemCodes({ pack, status, limit = 50, offset = 0, q = "" } = {}) {
  const packNum = pack != null && pack !== "" ? Number(pack) : null;
  const st = statusClause(status);
  const search = redeemSearchClause(q);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const rows =
    packNum != null && isValidRedeemPack(packNum)
      ? getDb()
          .prepare(
            `SELECT * FROM redeem_codes WHERE pack = ? ${st} ${search.clause}
             ORDER BY id DESC LIMIT ? OFFSET ?`
          )
          .all(packNum, ...search.params, lim, off)
      : getDb()
          .prepare(
            `SELECT * FROM redeem_codes WHERE 1=1 ${st} ${search.clause}
             ORDER BY id DESC LIMIT ? OFFSET ?`
          )
          .all(...search.params, lim, off);
  return rows.map(mapRedeemRow);
}
