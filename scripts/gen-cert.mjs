/**
 * Generate a self-signed TLS cert for local HTTPS dev (idempotent).
 *
 * Why: Xendit Components requires an HTTPS origin even in test mode, so the
 * Xendit checkout can't run on http://localhost. `netlify dev` serves HTTPS
 * using this cert (see netlify.toml [dev].https). Cert lives in .cert/ and is
 * gitignored. Requires `openssl` (preinstalled on macOS/Linux).
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dir = ".cert";
const cert = `${dir}/cert.pem`;
const key = `${dir}/key.pem`;

if (existsSync(cert) && existsSync(key)) {
  console.log("[cert] .cert present — skipping");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
const cnf = `${dir}/openssl.cnf`;
writeFileSync(cnf, "[req]\ndistinguished_name=req\n[san]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n");
try {
  execFileSync(
    "openssl",
    // prettier-ignore
    ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert,
     "-days", "825", "-subj", "/CN=localhost", "-extensions", "san", "-config", cnf],
    { stdio: "inherit" },
  );
  console.log("[cert] generated a self-signed localhost cert in .cert/");
} finally {
  rmSync(cnf, { force: true });
}
