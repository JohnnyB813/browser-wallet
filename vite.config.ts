import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { build as esbuild, buildSync } from "esbuild";

// warthog-ts is excluded from the dep optimizer and does `import pkg from "elliptic"`.
// The raw CJS package has no default export. Give that one importer an ESM build.
// Other packages (secp256k1) keep the real package so Vite can prebundle it.
function ellipticForWarthogTs(): Plugin {
  const dir = path.resolve("node_modules/.cache");
  const libFile = path.join(dir, "warthog-elliptic-lib.js");
  const outfile = path.join(dir, "warthog-elliptic-esm.js");
  return {
    name: "elliptic-for-warthog-ts",
    config() {
      mkdirSync(dir, { recursive: true });
      buildSync({
        entryPoints: [path.resolve("node_modules/elliptic/lib/elliptic.js")],
        bundle: true,
        format: "esm",
        platform: "browser",
        outfile: libFile,
        logLevel: "silent",
      });
      writeFileSync(
        outfile,
        [
          'import api from "./warthog-elliptic-lib.js";',
          "export const version = api.version;",
          "export const utils = api.utils;",
          "export const rand = api.rand;",
          "export const curve = api.curve;",
          "export const curves = api.curves;",
          "export const ec = api.ec;",
          "export const eddsa = api.eddsa;",
          "export default api;",
          "",
        ].join("\n"),
      );
    },
    resolveId(source, importer) {
      if (source !== "elliptic" || !importer?.includes(`${path.sep}warthog-ts${path.sep}`)) return null;
      return outfile;
    },
  };
}

// The background script needs `webextension-polyfill` in scope, which means it
// has to be bundled rather than copied verbatim from `public/`. Run in
// `closeBundle` so it lands *after* Vite has finished writing (and emptying)
// `build/` — an earlier hook would be wiped.
function bundleBackground(): Plugin {
  return {
    name: "bundle-background",
    apply: "build",
    async closeBundle() {
      await esbuild({
        entryPoints: ["src/background-entry.js"],
        outfile: "build/background.js",
        bundle: true,
        format: "iife",
        target: "chrome110",
        define: { "process.env.NODE_ENV": '"production"' },
        logLevel: "info",
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@react-native-async-storage/async-storage": path.resolve(
        "src/mobile-port/shims/asyncStorage.ts",
      ),
    },
  },
  plugins: [
    ellipticForWarthogTs(),
    react(),
    bundleBackground(),
    viteStaticCopy({
      targets: [
        {
          src: "public/manifest.json",
          dest: ".",
        },
        {
          src: "config/nodes.json",
          dest: ".",
        },
      ],
    }),
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "util"],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
    }),
  ],
optimizeDeps: {
    include: ["ethers", "elliptic"],
    // warthog-ts is consumed as ESM; pre-bundling it breaks its exports.
    exclude: ["warthog-ts"],
  },
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
