import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Colours and sizes in the UI come from src/styles.css, on the 4px grid.
// Email HTML and PDF fills live outside these paths: mail clients and pdf-lib
// cannot read the theme.
const skip = new Set([
  "src/components/google-icon.tsx", // Google's own logo colours
]);

const files = execFileSync("git", ["ls-files", "src/routes", "src/components"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !file.startsWith("src/components/ui/"))
  .filter((file) => !skip.has(file));

const rules = [
  { name: "an oklch() colour", pattern: /oklch\(/ },
  // A hex colour has a letter, or six digits; "#111" alone is an issue number.
  { name: "a hex colour", pattern: /#(?=[0-9a-f]{0,5}[a-f])[0-9a-f]{3}\b|#[0-9a-f]{6}\b/i },
  { name: "an arbitrary value", pattern: /\b[a-z][a-z0-9-]*-\[[^\]\s]+\]/ },
  {
    name: "a half step off the 4px grid",
    pattern:
      /\b-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|size|inset|top|right|bottom|left)-\d+\.5\b/,
  },
];

const found = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const rule of rules) {
        // theme-color is a browser chrome hint. It cannot read a CSS variable.
        if (line.includes("theme-color")) continue;
        if (rule.pattern.test(line))
          found.push(`${file}:${index + 1}: ${rule.name}: ${line.trim()}`);
      }
    });
}

if (found.length > 0) {
  console.error(`Use a token from src/styles.css instead:\n${found.join("\n")}`);
  process.exit(1);
}

console.log(`Tokens only, on the 4px grid: ${files.length} files.`);
