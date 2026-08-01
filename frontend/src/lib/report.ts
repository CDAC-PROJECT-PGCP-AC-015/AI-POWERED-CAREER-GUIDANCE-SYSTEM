/**
 * Generates the "Career Report" (SDD §9.4 AI Career Report Generator / §10.1
 * Career Report Page) as a standalone HTML document and opens the browser's
 * native print dialog on it, so the student can "Save as PDF". This avoids
 * pulling in a PDF-generation library — every browser already does this
 * reliably, and the result matches the "Download PDF" button in the design.
 */
import type { CareerPrediction, StudentProfile } from "./career-data";

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function downloadCareerReport(career: CareerPrediction, profile: StudentProfile | null) {
  const name = profile?.name ?? "Student";
  const generatedAt = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const mentor = career.mentors[0];

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Career Report — ${esc(name)} — ${esc(career.title)}</title>
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a2e; max-width: 820px; margin: 0 auto; padding: 32px; }
  .brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b8a; margin-bottom: 4px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .sub { color: #6b6b8a; margin: 0 0 24px; font-size: 14px; }
  .badge { display: inline-block; background: #eef0ff; color: #4338ca; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; margin-bottom: 18px; }
  .card { border: 1px solid #e5e5f0; border-radius: 14px; padding: 20px 22px; margin-bottom: 18px; page-break-inside: avoid; }
  .card h2 { font-size: 16px; margin: 0 0 10px; }
  .row { display: flex; gap: 24px; flex-wrap: wrap; }
  .metric { flex: 1; min-width: 140px; }
  .metric .val { font-size: 22px; font-weight: 700; }
  .metric .lbl { font-size: 12px; color: #6b6b8a; }
  .bar-track { background: #eee; border-radius: 999px; height: 8px; overflow: hidden; margin-top: 6px; }
  .bar-fill { background: #4338ca; height: 100%; }
  .skill-row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 14px; }
  .skill-row:first-child { margin-top: 0; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 8px; font-size: 14px; }
  .footer { color: #9a9ab0; font-size: 11px; margin-top: 30px; text-align: center; }
  .print-bar { text-align: center; margin-bottom: 24px; }
  .print-bar button { background: #4338ca; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; cursor: pointer; }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <div class="brand">CareerAI — C-DAC Bangalore</div>
  <h1>${esc(name)}</h1>
  <p class="sub">Comprehensive Career Analysis Report · Generated ${esc(generatedAt)}</p>
  <div class="badge">Top match: ${esc(career.title)} — ${career.confidence}%</div>

  <div class="card">
    <h2>Executive Summary</h2>
    <p style="font-size:14px; line-height:1.6; margin:0;">${esc(career.aiSummary)}</p>
  </div>

  <div class="card">
    <h2>Career Fit</h2>
    <div class="row">
      <div class="metric">
        <div class="val">${career.confidence}%</div>
        <div class="lbl">Overall match</div>
        <div class="bar-track"><div class="bar-fill" style="width:${career.confidence}%"></div></div>
      </div>
      <div class="metric">
        <div class="val">${esc(career.salaryRange)}</div>
        <div class="lbl">Salary range</div>
      </div>
      <div class="metric">
        <div class="val">${esc(career.demand)}</div>
        <div class="lbl">Market demand</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Skill Gap Analysis</h2>
    ${career.skillGaps
      .map(
        (g) => `
      <div class="skill-row"><span>${esc(g.skill)}</span><span>${g.match}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${g.match}%; background:${g.match >= 70 ? "#16a34a" : g.match >= 45 ? "#d97706" : "#dc2626"}"></div></div>
      <div style="font-size:12px; color:#6b6b8a; margin-top:4px;">${esc(g.note)}</div>
    `,
      )
      .join("")}
  </div>

  ${
    mentor
      ? `<div class="card">
    <h2>Recommended Mentor</h2>
    <p style="font-size:14px; margin:0 0 4px; font-weight:600;">${esc(mentor.name)}</p>
    <p style="font-size:13px; color:#6b6b8a; margin:0 0 8px;">${esc(mentor.title)} · ${esc(mentor.company)}</p>
    <p style="font-size:13px; margin:0;">${esc(mentor.bio)}</p>
  </div>`
      : ""
  }

  <div class="card">
    <h2>Next Steps &amp; Timeline</h2>
    <ul>
      ${career.path
        .map(
          (p) =>
            `<li><strong>${esc(p.phase)}: ${esc(p.title)}</strong> — ${esc(p.detail)} <em style="color:#6b6b8a;">(${esc(p.status.replace("-", " "))})</em></li>`,
        )
        .join("")}
    </ul>
  </div>

  <div class="footer">Generated by CareerAI · AI Powered Career Guidance System · This report is AI-generated guidance, not a guarantee of employment outcomes.</div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    // Popup blocked — fall back to a direct HTML download so the action never silently fails.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `career-report-${career.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
