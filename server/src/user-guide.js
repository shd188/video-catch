import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 优先仓库 docs/USER-GUIDE.md，回退到 server/public/guide/user-guide.md */
export function resolveUserGuidePath(publicDir) {
  const fromRepo = path.join(__dirname, "..", "..", "docs", "USER-GUIDE.md");
  const bundled = path.join(publicDir, "guide", "user-guide.md");
  if (fs.existsSync(fromRepo)) return fromRepo;
  if (fs.existsSync(bundled)) return bundled;
  return null;
}
