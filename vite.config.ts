import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [".agents/**", "src/routeTree.gen.ts"],
  },
  lint: {
    plugins: ["typescript", "react", "unicorn", "oxc", "import", "vitest", "jsx-a11y"],
    ignorePatterns: [".agents/**", "src/routeTree.gen.ts", "src/components/ui/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    tasks: {
      "check:tokens": "node scripts/check-tokens.mjs",
    },
  },
  resolve: { tsconfigPaths: true },
  // Lazy, so `vp check`, `vp lint`, and `vp fmt` read this file without
  // starting the plugins.
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // The plugin default is remote, which needs a Cloudflare login. Local
      // runs analyse tenders with a stand-in instead (src/lib/ports.ts).
      remoteBindings: false,
    }),
    tanstackStart(),
    viteReact(),
  ]),
});
