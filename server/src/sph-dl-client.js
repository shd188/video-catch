/**
 * 调用 sph-dl 管理端 API（兑换码写入 Cloudflare KV）
 * 环境变量：SPH_DL_API_BASE、SPH_DL_ADMIN_TOKEN
 */

export function getSphDlConfig() {
  const apiBase = String(process.env.SPH_DL_API_BASE || "")
    .trim()
    .replace(/\/$/, "");
  const adminToken = String(process.env.SPH_DL_ADMIN_TOKEN || "").trim();
  return { apiBase, adminToken };
}

export function assertSphDlConfigured() {
  const { apiBase, adminToken } = getSphDlConfig();
  if (!apiBase || !adminToken) {
    throw new Error(
      "未配置 sph-dl：请在 server/.env 设置 SPH_DL_API_BASE 与 SPH_DL_ADMIN_TOKEN"
    );
  }
  return { apiBase, adminToken };
}

async function sphDlFetch(path, { method = "GET", body } = {}) {
  const { apiBase, adminToken } = assertSphDlConfigured();
  const url = `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.message || `sph-dl HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

/**
 * 在 sph-dl 生成兑换码（写入 KV）
 * sph-dl 单次最多 200 张，超出时分批请求
 * @returns {Promise<{ pack: number, count: number, codes: string[], details: object[] }>}
 */
export async function sphDlCreateCodes(pack, count) {
  const p = Number(pack);
  const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 2000);
  const allCodes = [];
  const allDetails = [];
  let left = n;
  while (left > 0) {
    const batch = Math.min(left, 200);
    const data = await sphDlFetch("/api/admin/codes", {
      method: "POST",
      body: { pack: p, count: batch },
    });
    const codes = Array.isArray(data.codes) ? data.codes : [];
    const details = Array.isArray(data.details) ? data.details : [];
    allCodes.push(...codes);
    allDetails.push(...details);
    left -= batch;
  }
  return {
    pack: p,
    count: allCodes.length,
    codes: allCodes,
    details: allDetails,
  };
}

/** 查询单个兑换码余额（sph-dl POST /api/credits） */
export async function sphDlLookupCode(code) {
  return sphDlFetch("/api/credits", {
    method: "POST",
    body: { code },
  });
}
