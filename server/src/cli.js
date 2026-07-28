import "dotenv/config";
import { createLicense } from "./licenses.js";
import { createRelease } from "./releases.js";
import { REDEEM_PACKS, createRedeemCode, createRedeemCodesBulk } from "./redeem-codes.js";
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
} else if (cmd === "redeem:create") {
  const pack = Number(opts.pack);
  if (!REDEEM_PACKS.includes(pack)) {
    console.error(
      `Usage: npm run redeem:create -- --pack 5 [--count 10] [--note batch]\npack 仅支持：${REDEEM_PACKS.join("/")}`
    );
    process.exit(1);
  }
  const count = opts.count ? Number(opts.count) : 1;
  try {
    if (count > 1) {
      const result = await createRedeemCodesBulk({ pack, count, note: opts.note });
      console.log(`Redeem codes created via sph-dl: ${result.count} × pack ${result.pack}`);
      for (const c of result.codes) console.log(c);
    } else {
      const row = await createRedeemCode({ pack, note: opts.note });
      console.log("Redeem code created via sph-dl:");
      console.log("  code:", row.code);
      console.log("  pack:", row.pack);
      console.log("  remaining:", row.remaining);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
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
  console.log("Commands: license:create | redeem:create | release:create");
  process.exit(1);
}
