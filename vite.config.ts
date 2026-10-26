import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { voidPlugin } from "void";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [".agents/**", "**/routeTree.gen.ts", "void.lock.json"],
  },
  lint: {
    plugins: ["typescript", "react", "unicorn", "oxc", "import", "vitest", "jsx-a11y"],
    categories: {
      correctness: "error",
    },
    ignorePatterns: [".agents/**", "**/routeTree.gen.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["src/components/ui/**", "src/hooks/**"],
        rules: {
          "jsx-a11y/label-has-associated-control": "off",
          "jsx-a11y/click-events-have-key-events": "off",
          "jsx-a11y/no-noninteractive-element-interactions": "off",
          "jsx-a11y/prefer-tag-over-role": "off",
          "typescript/restrict-template-expressions": "off",
          "react/set-state-in-effect": "off",
        },
      },
    ],
  },
  run: {
    tasks: {
      "check:tokens": "node scripts/check-tokens.mjs",
    },
  },
  resolve: { tsconfigPaths: true },
  // Lazy, so `vp check`, `vp lint`, and `vp fmt` read this file without
  // starting the plugins. voidPlugin must come before the framework plugin.
  plugins: lazyPlugins(() => [
    devtools(),
    voidPlugin(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]),
});
