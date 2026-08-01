import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/auth", changefreq: "monthly", priority: "0.6" },
          { path: "/onboarding", changefreq: "monthly", priority: "0.6" },
          { path: "/assessment", changefreq: "monthly", priority: "0.7" },
          { path: "/results", changefreq: "weekly", priority: "0.8" },
          { path: "/dashboard", changefreq: "weekly", priority: "0.8" },
          { path: "/guidance", changefreq: "weekly", priority: "0.8" },
          { path: "/career-path", changefreq: "weekly", priority: "0.7" },
          { path: "/mentorship", changefreq: "weekly", priority: "0.7" },
          { path: "/skill-lab", changefreq: "weekly", priority: "0.7" },
          { path: "/activity", changefreq: "monthly", priority: "0.4" },
          { path: "/settings", changefreq: "monthly", priority: "0.3" },
          { path: "/help", changefreq: "monthly", priority: "0.5" },
          { path: "/mentor-portal", changefreq: "monthly", priority: "0.5" },
          { path: "/admin", changefreq: "monthly", priority: "0.5" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
