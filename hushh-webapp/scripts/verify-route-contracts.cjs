const fs = require("node:fs");
const path = require("node:path");

function repoRootFromHere() {
  // scripts/verify-route-contracts.cjs -> hushh-webapp/scripts -> hushh-webapp -> repo root
  return path.resolve(__dirname, "..", "..");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function listWebRouteFiles(repoRoot) {
  const appApiDir = path.join(repoRoot, "hushh-webapp", "app", "api");
  const out = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "route.ts") out.push(full);
    }
  };

  if (exists(appApiDir)) walk(appApiDir);
  return out;
}

function normalizeToForwardSlashes(p) {
  return p.replace(/\\/g, "/");
}

function resolveRepoFile(repoRoot, repoRelativeFile) {
  return path.join(repoRoot, repoRelativeFile);
}

function getDeclaredWebRouteFiles(manifest) {
  const files = [];
  for (const c of manifest.contracts) {
    if (c.webRouteFile) files.push(c.webRouteFile);
    if (c.webRouteFiles) files.push(...c.webRouteFiles);
  }
  return files;
}

function assertDeclaredWebRoutesExist(repoRoot, manifest) {
  const declared = getDeclaredWebRouteFiles(manifest).map(
    normalizeToForwardSlashes
  );

  const missing = declared.filter((f) => !exists(resolveRepoFile(repoRoot, f)));
  if (missing.length) {
    throw new Error(
      `Declared webRouteFile(s) missing on disk:\n` +
        missing.map((f) => `- ${f}`).join("\n")
    );
  }
}

function assertBackendPathsExist(repoRoot, contractId, backend) {
  const backendFile = resolveRepoFile(repoRoot, backend.file);
  if (!exists(backendFile)) {
    throw new Error(`[${contractId}] Backend file missing: ${backend.file}`);
  }

  const src = readText(backendFile);
  if (
    !src.includes(`prefix="${backend.routerPrefix}"`) &&
    !src.includes(`prefix='${backend.routerPrefix}'`)
  ) {
    throw new Error(
      `[${contractId}] Backend router prefix not found in ${backend.file}: ${backend.routerPrefix}`
    );
  }

  for (const p of backend.paths) {
    // In Python code this should appear as @router.get("/x") etc (path only, prefix is separate)
    if (!src.includes(`"${p}"`) && !src.includes(`'${p}'`)) {
      throw new Error(
        `[${contractId}] Backend path not found in ${backend.file}: ${p}`
      );
    }
  }
}

function assertNativeExists(repoRoot, contractId, native) {
  const filesToCheck = [
    native.tsPluginFile,
    native.iosPluginFile,
    native.androidPluginFile,
  ].filter(Boolean);

  for (const f of filesToCheck) {
    const full = resolveRepoFile(repoRoot, f);
    if (!exists(full)) {
      throw new Error(`[${contractId}] Native/TS plugin file missing: ${f}`);
    }
  }

  if (native.requiredMethodNames?.length && native.tsPluginFile) {
    const ts = readText(resolveRepoFile(repoRoot, native.tsPluginFile));
    for (const m of native.requiredMethodNames) {
      if (!ts.includes(m)) {
        throw new Error(
          `[${contractId}] Expected method name missing in ${native.tsPluginFile}: ${m}`
        );
      }
    }
  }
}

function main() {
  const repoRoot = repoRootFromHere();
  const manifestPath = path.join(
    repoRoot,
    "hushh-webapp",
    "route-contracts.json"
  );
  if (!exists(manifestPath)) {
    throw new Error(`Missing manifest: hushh-webapp/route-contracts.json`);
  }

  const manifest = JSON.parse(readText(manifestPath));

  // 0) Declared routes must exist on disk (prevents stale manifest entries)
  assertDeclaredWebRoutesExist(repoRoot, manifest);

  const actualWebRouteFiles = listWebRouteFiles(repoRoot).map((p) =>
    normalizeToForwardSlashes(path.relative(repoRoot, p))
  );

  const declaredWebRouteFiles = new Set(
    getDeclaredWebRouteFiles(manifest).map(normalizeToForwardSlashes)
  );
  const allowlisted = new Set(
    (manifest.allowlistedWebRouteFiles || []).map(normalizeToForwardSlashes)
  );

  // 1) No undeclared Next.js API routes (prevents lying endpoints)
  const undeclared = actualWebRouteFiles.filter(
    (f) => !declaredWebRouteFiles.has(f) && !allowlisted.has(f)
  );
  if (undeclared.length) {
    throw new Error(
      `Undeclared Next.js API routes found (add to route-contracts.json or allowlist):\n` +
        undeclared.map((f) => `- ${f}`).join("\n")
    );
  }

  // 2) Validate each contract's backend hints and native/plugin presence
  for (const c of manifest.contracts) {
    if (c.backend) assertBackendPathsExist(repoRoot, c.id, c.backend);
    if (c.native) assertNativeExists(repoRoot, c.id, c.native);
  }

  // eslint-disable-next-line no-console
  console.log("OK: route contracts verified");
}

main();
