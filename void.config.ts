import { defineConfig } from "void/config";

export default defineConfig({
  target: "cloudflare",
  routing: {
    // SSR app; avoids interactive ISR prompt on deploy.
    isr: false,
  },
  worker: {
    // Void deploy default; bump deliberately.
    compatibility_date: "2026-09-11",
    compatibility_flags: ["nodejs_compat", "nodejs_als"],
  },
  cloudflare: {
    name: "vektor",
    account_id: "ab816378ce175deba8768e44d4c9478b",
    // Custom-domain-only Worker (matches live dashboard visibility).
    workers_dev: false,
    preview_urls: false,
    observability: {
      enabled: true,
    },
    routes: [
      {
        pattern: "vektorhq.co.za",
        custom_domain: true,
      },
      {
        pattern: "www.vektorhq.co.za",
        custom_domain: true,
      },
    ],
    r2_buckets: [
      {
        binding: "STORAGE",
        bucket_name: "vektor-storage",
      },
    ],
    d1_databases: [
      {
        binding: "DB",
        database_name: "vektor-db",
        database_id: "ebb2cb84-3cc8-40ad-9558-f2cb9e40fc3c",
        migrations_dir: "./db/migrations",
      },
    ],
    // Workers AI has no local simulation; remote:true is required for preview.
    // CI smoke therefore needs CLOUDFLARE_API_TOKEN (ENVIRONMENT=local still
    // uses the stand-in in src/lib/ports.ts for analysis).
    ai: {
      binding: "AI",
      remote: true,
    },
  },
});
