import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { build as esbuild } from "esbuild";

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
  plugins: [
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
      include: ["buffer"],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
    }),
  ],
  optimizeDeps: {
    include: ["ethers"],
    exclude: ["warthog-ts", "elliptic"],
  },
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});
