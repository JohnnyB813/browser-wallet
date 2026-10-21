import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { build as esbuild } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The manifest is per browser. public/manifest.json holds what every browser
 * takes, config/manifest.targets.json holds what only some of them need.
 *
 * Chrome runs the background as a service worker and docks the wallet in a
 * side panel. Firefox has no service worker, so its background is an event
 * page, and its docked panel is a sidebar. The windows permission is not a
 * permission in either browser, so it is gone.
 */
type ManifestTarget = {
  manifest?: Record<string, unknown>;
  addPermissions?: string[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function manifestFor(root: string, target: string): Record<string, unknown> {
  const base = readJson<Record<string, unknown> & { permissions?: string[] }>(
    resolve(root, "public/manifest.json"),
  );
  const targets = readJson<Record<string, ManifestTarget>>(
    resolve(root, "config/manifest.targets.json"),
  );
  const extra = targets[target];
  if (!extra) {
    throw new Error(`unknown build target: ${target}`);
  }
  return {
    ...base,
    ...(extra.manifest ?? {}),
    permissions: [...(base.permissions ?? []), ...(extra.addPermissions ?? [])],
  };
}

/**
 * Write the manifest of the target over the copy Vite made from public/.
 * Vite empties the output and copies public/ into it before it writes the
 * bundle, so a closeBundle hook lands last.
 */
function writeManifest(target: string): Plugin {
  let root = process.cwd();
  let outDir = "build";
  return {
    name: "write-manifest",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    closeBundle() {
      const manifest = manifestFor(root, target);
      writeFileSync(
        resolve(root, outDir, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    },
  };
}

// The background script needs `webextension-polyfill` in scope, which means it
// has to be bundled rather than copied verbatim from `public/`. Run in
// `closeBundle` so it lands *after* Vite has finished writing (and emptying)
// `build/` — an earlier hook would be wiped.
function bundleBackground(): Plugin {
  let root = process.cwd();
  let outDir = "build";
  return {
    name: "bundle-background",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await esbuild({
        entryPoints: ["src/background-entry.js"],
        outfile: resolve(root, outDir, "background.js"),
        bundle: true,
        format: "iife",
        target: "chrome110",
        define: { "process.env.NODE_ENV": '"production"' },
        logLevel: "info",
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Firefox gets its own build. The plain build is the Chromium one.
  const target = mode === "firefox" ? "firefox" : "chromium";
  const outDir = target === "firefox" ? "build-firefox" : "build";

  return {
    plugins: [
      react(),
      bundleBackground(),
      viteStaticCopy({
        targets: [
          {
            src: "config/nodes.json",
            dest: ".",
          },
        ],
      }),
      writeManifest(target),
    ],
    optimizeDeps: {
      include: ["ethers"],
      // warthog-ts is consumed as ESM; pre-bundling it breaks its
      // `type: module` exports.
      exclude: ["warthog-ts"],
    },
    build: {
      outDir,
      rollupOptions: {
        input: {
          main: "./index.html",
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
