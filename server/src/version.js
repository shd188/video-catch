/** 比较扩展版本号（支持 2.6.9、2.6.10 等分段数字） */
export function compareVersions(a, b) {
  const pa = String(a || "0")
    .split(/[.+_-]/)
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0")
    .split(/[.+_-]/)
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function isVersionNewer(latest, current) {
  return compareVersions(latest, current) > 0;
}
