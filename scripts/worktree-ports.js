#!/usr/bin/env node
/**
 * worktree-ports.js
 *
 * Bootstraps a git worktree for local dev. Run once, from the worktree root,
 * after creating a worktree:
 *
 *     node scripts/worktree-ports.js
 *
 * It does three things (worktrees only):
 *   1. Assigns a unique frontend/backend local port pair (deterministic from
 *      the worktree name) and rewrites .claude/launch.json, so several
 *      worktrees can run dev servers at once without colliding on 3000/8000.
 *   2. Copies the gitignored env files (frontend/.env.local, backend/.env)
 *      from the main checkout if this worktree doesn't have them yet — git
 *      worktree add only checks out tracked files, so these never come along.
 *   3. Rewrites NEXT_PUBLIC_API_BASE_URL in the copied frontend/.env.local to
 *      this worktree's backend port, but only when it points at localhost (a
 *      shared cloud test-backend URL is left untouched).
 *
 * The main checkout (any path not under .claude/worktrees/) always stays on
 * 3000/8000 and its env files are left untouched. Everything is idempotent:
 * re-running maps the same worktree to the same ports and never clobbers an
 * env file that already exists in the worktree.
 *
 * No dependencies — plain Node, CommonJS.
 */

const fs = require("fs");
const path = require("path");

const MAIN_FRONTEND_PORT = 3000;
const MAIN_BACKEND_PORT = 8000;

// Port pools for worktrees. Offsets are shared between frontend and backend so
// a worktree's two ports differ only by their base (e.g. 3037 / 8037), which
// makes them easy to eyeball. Range 1..899 keeps us clear of the base ports and
// well below the ephemeral range.
const OFFSET_MIN = 1;
const OFFSET_MAX = 899;

/** Stable non-negative hash of a string (djb2). */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // force unsigned
}

/** Deterministic offset in [OFFSET_MIN, OFFSET_MAX] from a worktree name. */
function offsetForName(name) {
  const span = OFFSET_MAX - OFFSET_MIN + 1;
  return OFFSET_MIN + (hashString(name) % span);
}

function main() {
  const cwd = process.cwd();
  const launchPath = path.join(cwd, ".claude", "launch.json");

  if (!fs.existsSync(launchPath)) {
    console.error(
      `No .claude/launch.json found at ${launchPath}.\n` +
        `Run this from the root of a worktree that has one.`
    );
    process.exit(1);
  }

  // A worktree checkout lives under <repo>/.claude/worktrees/<name>. The main
  // checkout does not, and must keep the canonical 3000/8000 ports.
  const normalized = cwd.replace(/\\/g, "/");
  const isWorktree = normalized.includes("/.claude/worktrees/");

  let frontendPort = MAIN_FRONTEND_PORT;
  let backendPort = MAIN_BACKEND_PORT;

  if (isWorktree) {
    const worktreeName = path.basename(cwd);
    const offset = offsetForName(worktreeName);
    frontendPort = MAIN_FRONTEND_PORT + offset;
    backendPort = MAIN_BACKEND_PORT + offset;
    console.log(`Worktree "${worktreeName}" -> offset ${offset}`);
  } else {
    console.log("Main checkout detected -> keeping default ports 3000/8000.");
  }

  const launch = JSON.parse(fs.readFileSync(launchPath, "utf8"));

  for (const config of launch.configurations || []) {
    if (config.name === "frontend") {
      config.port = frontendPort;
      config.runtimeArgs = setFrontendPort(config.runtimeArgs, frontendPort);
    } else if (config.name === "backend") {
      config.port = backendPort;
      config.runtimeArgs = setBackendPort(config.runtimeArgs, backendPort);
    }
  }

  fs.writeFileSync(launchPath, JSON.stringify(launch, null, 2) + "\n");

  console.log(`Frontend: ${frontendPort}`);
  console.log(`Backend:  ${backendPort}`);
  console.log(`Updated ${launchPath}`);

  if (isWorktree) {
    provisionEnvFiles(normalized, backendPort);
  }
}

// Gitignored env files that git worktree add does not copy. Paths are relative
// to a checkout root.
const ENV_FILES = ["frontend/.env.local", "backend/.env"];

/**
 * Copy the gitignored env files from the main checkout into this worktree if
 * they are missing, then point the frontend's API base URL at this worktree's
 * backend port. `normalizedCwd` uses forward slashes (fs accepts them on
 * Windows too).
 */
function provisionEnvFiles(normalizedCwd, backendPort) {
  const mainRoot = normalizedCwd.split("/.claude/worktrees/")[0];

  for (const rel of ENV_FILES) {
    const dest = `${normalizedCwd}/${rel}`;
    const src = `${mainRoot}/${rel}`;
    if (fs.existsSync(dest)) {
      console.log(`Kept existing ${rel} (not overwritten).`);
    } else if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`Copied ${rel} from main checkout.`);
    } else {
      console.warn(
        `No ${rel} in the main checkout to copy — set it up from the ` +
          `matching .example file.`
      );
    }
  }

  rewriteApiBaseUrl(`${normalizedCwd}/frontend/.env.local`, backendPort);
}

/**
 * Rewrite NEXT_PUBLIC_API_BASE_URL to use this worktree's backend port, but
 * only when it targets localhost/127.0.0.1. A shared cloud test-backend URL is
 * intentionally left alone.
 */
function rewriteApiBaseUrl(envPath, backendPort) {
  if (!fs.existsSync(envPath)) return;

  const original = fs.readFileSync(envPath, "utf8");
  const pattern =
    /^(NEXT_PUBLIC_API_BASE_URL=https?:\/\/(?:localhost|127\.0\.0\.1):)(\d+)(.*)$/m;
  const match = original.match(pattern);
  if (!match) return; // not set, or a non-localhost URL — leave untouched

  if (match[2] === String(backendPort)) return; // already correct

  const updated = original.replace(pattern, `$1${backendPort}$3`);
  fs.writeFileSync(envPath, updated);
  console.log(`Set NEXT_PUBLIC_API_BASE_URL -> localhost:${backendPort}`);
}

/**
 * npm swallows the dev server's own flags unless they follow a `--` separator,
 * so the port is passed as `npm run dev --prefix frontend -- -p <port>`. We
 * rebuild everything from the first `--` onward to stay idempotent.
 */
function setFrontendPort(args, port) {
  const base = [];
  for (const arg of args) {
    if (arg === "--") break;
    base.push(arg);
  }
  return [...base, "--", "-p", String(port)];
}

/** Replace (or append) the uvicorn `--port <n>` flag. */
function setBackendPort(args, port) {
  const out = [...args];
  const idx = out.indexOf("--port");
  if (idx !== -1 && idx + 1 < out.length) {
    out[idx + 1] = String(port);
  } else {
    out.push("--port", String(port));
  }
  return out;
}

main();
