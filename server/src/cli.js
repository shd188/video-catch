import "dotenv/config";
import { createLicense } from "./licenses.js";
import { createRelease } from "./releases.js";
import "./init-db.js";

const [cmd, ...args] = process.argv.slice(2);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && argv[i + 1]) {
      out[argv[i].slice(2)] = argv[++i];
    }
  }
  return out;
}

const opts = parseArgs(args);

if (cmd === "license:create") {
  if (!opts.channel) {
    console.error("Usage: npm run license:create -- --channel xiaoetong [--email x@y.com] [--max-devices 2] [--expires 2026-12-31]");
    process.exit(1);
  }
  const row = createLicense({
    channelId: opts.channel,
    email: opts.email,
    maxDevices: opts["max-devices"] ? Number(opts["max-devices"]) : 2,
    expiresAt: opts.expires || null,
    note: opts.note,
  });
  console.log("License created:");
  console.log("  key:", row.license_key);
  console.log("  channel:", row.channel_id);
  console.log("  expires:", row.expires_at || "(none)");
} else if (cmd === "release:create") {
  if (!opts.channel || !opts.version || !opts.file) {
    console.error("Usage: npm run release:create -- --channel xiaoetong --version 1.0.1 --file xiaoetong-1.0.1.zip [--notes 'changelog']");
    process.exit(1);
  }
  const row = createRelease({
    channelId: opts.channel,
    version: opts.version,
    filename: opts.file,
    releaseNotes: opts.notes,
  });
  console.log("Release published:", row.channel_id, row.version, row.filename);
} else {
  console.log("Commands: license:create | release:create");
  process.exit(1);
}
