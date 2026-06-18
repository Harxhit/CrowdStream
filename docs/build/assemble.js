// Assembles the combined "Production Plan" markdown from the architecture docs
// and the 7-week roadmap. Output: crowdstream-production-plan.md
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // CrowdStream/
const DOCS = path.join(ROOT, 'docs');
const ROADMAP = path.join(DOCS, 'roadmap');
const DATE = process.env.DOC_DATE || '2026-06-17';

const read = (p) => fs.readFileSync(p, 'utf8').trim();

// Strip the first H1 from a doc body (we provide our own section headings)
function stripLeadingH1(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines.splice(i, 1);
    // drop a single trailing blank line left behind
    if (lines[i] !== undefined && lines[i].trim() === '') lines.splice(i, 1);
  }
  return lines.join('\n').trim();
}

// Demote every ATX heading by `n` levels (so embedded docs nest under our parts)
function demote(md, n) {
  return md.replace(/^(#{1,6})(\s)/gm, (m, hashes, sp) => {
    const lvl = Math.min(6, hashes.length + n);
    return '#'.repeat(lvl) + sp;
  });
}

const WEEK_TITLES = {
  1: 'NAT Traversal & Configuration',
  2: 'Authentication & Access Control',
  3: 'SFU Scaling Foundation',
  4: 'State, Persistence & Reliability',
  5: 'Real-Time Messaging',
  6: 'Recording & VOD Pipeline',
  7: 'Observability, CI/CD & Disaster Recovery',
};

let out = [];

// ---- Cover ----
out.push(`<div class="cover">

<div class="cover-kicker">PRODUCTION READINESS PLAN</div>

# CrowdStream

## From Prototype to Production in 7 Weeks

<div class="cover-sub">Target architecture, scalability strategy, and a day-by-day execution roadmap for taking the CrowdStream WebRTC / MediaSoup live-streaming platform to an MVP-grade, production-ready system.</div>

<div class="cover-meta">
<strong>Document version:</strong> 1.0<br/>
<strong>Date:</strong> ${DATE}<br/>
<strong>Scope:</strong> Architecture &amp; 35-working-day execution plan (MVP target)
</div>

</div>

<div class="page-break"></div>
`);

// ---- How to read ----
out.push(`# How to Read This Document

This document is the single source of truth for taking **CrowdStream** to production. It is organised in three parts:

- **Part I — Target Production Architecture.** The production-scale architecture the system is evolving toward: high-level topology, WebRTC media flow, AWS infrastructure, scalability tiers, data model, security, observability, CI/CD, disaster recovery, cost, and the Production Readiness Checklist.
- **Part II — The 7-Week Production Roadmap.** A day-by-day execution plan (5 working days × 7 weeks = 35 days) that operationalises Part I, closing the production blockers in dependency order. Each day carries a goal, a task checklist, and acceptance criteria.
- **Appendix A — Current System Architecture.** The system *as built today*, the baseline the roadmap starts from.

**The throughline:** Part I §16 (the Production Readiness Checklist) defines *what* "done" means; Part II sequences *when* each item gets done; Appendix A describes *where we start*.

<div class="callout">
<strong>Definition of done (MVP).</strong> By the end of Week 7 the system satisfies the MVP target in Part I §15: single region, multi-AZ, TURN + JWT + Redis-backed signaling, durable lifecycle, chat / reactions / presence, a working recording pipeline, and baseline observability + CI/CD.
</div>

<div class="page-break"></div>
`);

// ---- Part I: Target Architecture ----
out.push(`# Part I — Target Production Architecture\n`);
out.push(demote(stripLeadingH1(read(path.join(DOCS, 'ARCHITECTURE.md'))), 1));
out.push(`\n<div class="page-break"></div>\n`);

// ---- Part II: Roadmap ----
out.push(`# Part II — The 7-Week Production Roadmap\n`);

// roadmap overview (strip its H1, demote)
out.push(demote(stripLeadingH1(read(path.join(ROADMAP, 'README.md'))), 1));
out.push(`\n<div class="page-break"></div>\n`);

for (let w = 1; w <= 7; w++) {
  const wdir = path.join(ROADMAP, `week-${w}`);
  out.push(`## Week ${w} — ${WEEK_TITLES[w]}\n`);
  // week overview
  out.push(demote(stripLeadingH1(read(path.join(wdir, 'README.md'))), 2));
  out.push('\n');
  // days
  for (let d = 1; d <= 5; d++) {
    const dfile = path.join(wdir, `day-${d}`, 'README.md');
    if (fs.existsSync(dfile)) {
      out.push(demote(stripLeadingH1(read(dfile)), 2));
      out.push('\n');
    }
  }
  // review
  const rfile = path.join(wdir, 'review.md');
  if (fs.existsSync(rfile)) {
    out.push(demote(stripLeadingH1(read(rfile)), 2));
    out.push('\n');
  }
  out.push(`<div class="page-break"></div>\n`);
}

// ---- Appendix A: Current architecture ----
out.push(`# Appendix A — Current System Architecture\n`);
out.push(`> The system as built today — the baseline the roadmap evolves from.\n`);
out.push(demote(stripLeadingH1(read(path.join(ROOT, 'ARCHITECTURE.md'))), 1));

const combined = out.join('\n');
const target = path.join(__dirname, 'crowdstream-production-plan.md');
fs.writeFileSync(target, combined);
console.log(`Wrote ${target} (${combined.length} chars)`);
