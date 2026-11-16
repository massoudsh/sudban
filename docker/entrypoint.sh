#!/bin/sh
set -eu

# Fail fast with a clear message instead of crashing later inside Prisma.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "sudban: DATABASE_URL is not set" >&2
  exit 1
fi

# Optional readiness wait, used by docker-compose so the API does not race Postgres.
if [ "${WAIT_FOR_DB:-false}" = "true" ]; then
  node <<'NODE'
const net = require("node:net");

const raw = process.env.DATABASE_URL;
let parsed;
try {
  parsed = new URL(raw);
} catch {
  console.error("sudban: DATABASE_URL is not a valid URL");
  process.exit(1);
}
const host = parsed.hostname;
const port = Number(parsed.port || 5432);
const deadline = Date.now() + Number(process.env.WAIT_FOR_DB_TIMEOUT_MS || 60000);

const attempt = () =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

(async () => {
  while (Date.now() < deadline) {
    if (await attempt()) process.exit(0);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`sudban: database at ${host}:${port} was not reachable in time`);
  process.exit(1);
})();
NODE
fi

exec "$@"
