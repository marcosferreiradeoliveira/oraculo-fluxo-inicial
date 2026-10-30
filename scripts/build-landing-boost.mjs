/**
 * Build oracle-culture-boost e copia para public/avalieseuprojeto (Hosting unificado).
 *
 * Caminho do repo boost (override): ORACLE_CULTURE_BOOST_PATH
 * URL do app principal (CTAs): VITE_ORACULO_PUBLIC_ORIGIN ou culturalapp / oraculocultural
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LANDING_SUBPATH = "avalieseuprojeto";
const LANDING_BASE = `/${LANDING_SUBPATH}/`;
const OUT_DIR = path.join(ROOT, "public", LANDING_SUBPATH);

const defaultBoostRoot = path.resolve(ROOT, "../../oracle-culture-boost");
const BOOST_ROOT = process.env.ORACLE_CULTURE_BOOST_PATH?.trim() || defaultBoostRoot;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function resolvePublicOrigin() {
  const explicit = process.env.VITE_ORACULO_PUBLIC_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://culturalapp-fb9b0.web.app";
}

function resolveOraculoAppUrl(origin) {
  const explicit = process.env.VITE_ORACULO_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://oraculocultural.com.br";
}

function main() {
  if (!fs.existsSync(BOOST_ROOT)) {
    console.warn(
      `[build-landing-boost] Repo não encontrado: ${BOOST_ROOT}\n` +
        "  Defina ORACLE_CULTURE_BOOST_PATH ou pule com SKIP_LANDING_BOOST=1.",
    );
    if (process.env.SKIP_LANDING_BOOST === "1") {
      console.warn("[build-landing-boost] SKIP_LANDING_BOOST=1 — continuando sem landing.");
      return;
    }
    process.exit(1);
  }

  const culturalEnv = readEnvFile(path.join(ROOT, ".env.culturalapp"));
  const origin = resolvePublicOrigin();
  const appUrl = resolveOraculoAppUrl(origin);
  const siteUrl = `${origin}/${LANDING_SUBPATH}`;

  const env = {
    ...process.env,
    VITE_APP_BASE: LANDING_BASE,
    VITE_SITE_URL: siteUrl,
    VITE_ORACULO_APP_URL: appUrl,
    VITE_FIREBASE_API_KEY: culturalEnv.VITE_API_KEY || process.env.VITE_API_KEY || "",
    VITE_FIREBASE_AUTH_DOMAIN: culturalEnv.VITE_AUTH_DOMAIN || process.env.VITE_AUTH_DOMAIN || "",
    VITE_FIREBASE_PROJECT_ID: culturalEnv.VITE_PROJECT_ID || process.env.VITE_PROJECT_ID || "",
    VITE_FIREBASE_STORAGE_BUCKET: culturalEnv.VITE_STORAGE_BUCKET || process.env.VITE_STORAGE_BUCKET || "",
    VITE_FIREBASE_MESSAGING_SENDER_ID:
      culturalEnv.VITE_MESSAGING_SENDER_ID || process.env.VITE_MESSAGING_SENDER_ID || "",
    VITE_FIREBASE_APP_ID: culturalEnv.VITE_APP_ID || process.env.VITE_APP_ID || "",
    VITE_FIREBASE_MEASUREMENT_ID:
      culturalEnv.VITE_MEASUREMENT_ID || process.env.VITE_MEASUREMENT_ID || "",
  };

  console.log(`[build-landing-boost] Building em ${BOOST_ROOT}`);
  console.log(`[build-landing-boost] base=${LANDING_BASE} site=${siteUrl} app=${origin}`);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  if (!fs.existsSync(path.join(BOOST_ROOT, "node_modules"))) {
    const install = spawnSync(npmCmd, ["install"], { cwd: BOOST_ROOT, stdio: "inherit", env });
    if (install.status !== 0) process.exit(install.status ?? 1);
  }

  const build = spawnSync(npmCmd, ["run", "build:hosting"], { cwd: BOOST_ROOT, stdio: "inherit", env });
  if (build.status !== 0) process.exit(build.status ?? 1);

  const distHosting = path.join(BOOST_ROOT, "dist-hosting");
  if (!fs.existsSync(path.join(distHosting, "index.html"))) {
    console.error("[build-landing-boost] dist-hosting/index.html em falta após build.");
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(OUT_DIR), { recursive: true });
  fs.cpSync(distHosting, OUT_DIR, { recursive: true });

  console.log(`[build-landing-boost] OK → public/${LANDING_SUBPATH}/`);
}

main();
