// Renders crowdstream-production-plan.md -> crowdstream-production-plan.pdf
// Mermaid is rendered offline via the bundled dist file inside headless Chrome.
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

const SRC = path.join(__dirname, 'crowdstream-production-plan.md');
const OUT = path.resolve(__dirname, '..', 'CrowdStream-Production-Plan.pdf');
const MERMAID_JS = fs.readFileSync(
  path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
  'utf8'
);

let md = fs.readFileSync(SRC, 'utf8');

// Render GitHub task-list markers as checkbox glyphs (markdown-it leaves them literal)
md = md
  .replace(/^(\s*[-*]) \[ \] /gm, '$1 ☐ ')
  .replace(/^(\s*[-*]) \[[xX]\] /gm, '$1 ☑ ');

const mdit = new MarkdownIt({ html: true, linkify: true, typographer: true });

// Turn ```mermaid fences into <div class="mermaid"> blocks for client-side render
const defaultFence = mdit.renderer.rules.fence.bind(mdit.renderer.rules);
mdit.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if ((token.info || '').trim().toLowerCase() === 'mermaid') {
    return `<div class="mermaid">${mdit.utils.escapeHtml(token.content)}</div>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Heading anchors so the TOC links in the source resolve within the PDF
mdit.renderer.rules.heading_open = (tokens, idx) => {
  const level = tokens[idx].tag;
  const text = tokens[idx + 1].content;
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `<${level} id="${slug}">`;
};

const body = mdit.render(md);

const css = `
  :root {
    --ink: #1a2027; --muted: #5b6770; --line: #e2e6ea;
    --accent: #b5121b; --accent-soft: #fbeaea; --code-bg: #f6f8fa;
    --blue: #0b4f8a;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink); font-size: 10.5pt; line-height: 1.55; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3, h4 { line-height: 1.25; font-weight: 700; color: var(--ink); }
  h1 {
    font-size: 22pt; margin: 0 0 14px; padding-bottom: 8px;
    border-bottom: 3px solid var(--accent); page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    font-size: 15.5pt; margin: 26px 0 10px; padding-bottom: 4px;
    border-bottom: 1px solid var(--line); color: var(--blue);
  }
  h3 { font-size: 12.5pt; margin: 18px 0 6px; color: var(--ink); }
  h4 { font-size: 11pt; margin: 14px 0 4px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
  p { margin: 8px 0; }
  a { color: var(--blue); text-decoration: none; }
  ul, ol { margin: 8px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  code {
    font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 9pt; background: var(--code-bg); padding: 1px 5px;
    border-radius: 4px; border: 1px solid var(--line);
  }
  pre {
    background: var(--code-bg); border: 1px solid var(--line); border-radius: 6px;
    padding: 12px 14px; overflow-x: auto; font-size: 8.6pt; line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code { background: none; border: none; padding: 0; font-size: inherit; }
  blockquote {
    margin: 10px 0; padding: 8px 14px; border-left: 4px solid var(--blue);
    background: #f3f7fb; color: #314e63; border-radius: 0 4px 4px 0;
  }
  blockquote p { margin: 4px 0; }
  table {
    border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9pt;
    page-break-inside: avoid;
  }
  th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #eef2f5; font-weight: 700; }
  tr:nth-child(even) td { background: #fafbfc; }
  hr { border: none; border-top: 1px solid var(--line); margin: 22px 0; }
  .page-break { page-break-after: always; }
  .mermaid {
    text-align: center; margin: 16px 0; page-break-inside: avoid;
    background: #fff;
  }
  .mermaid svg { max-width: 100%; height: auto; }

  /* Cover */
  .cover {
    height: 9.6in; display: flex; flex-direction: column; justify-content: center;
    padding: 0 12px;
  }
  .cover .cover-kicker {
    color: var(--accent); font-weight: 700; letter-spacing: .28em;
    font-size: 11pt; margin-bottom: 18px;
  }
  .cover h1 { font-size: 52pt; border: none; margin: 0; page-break-before: avoid; }
  .cover h2 { font-size: 20pt; color: var(--muted); border: none; font-weight: 600; margin: 6px 0 28px; }
  .cover .cover-sub { font-size: 12.5pt; color: var(--ink); max-width: 32em; line-height: 1.6; }
  .cover .cover-meta {
    margin-top: 40px; padding-top: 18px; border-top: 2px solid var(--line);
    font-size: 10.5pt; color: var(--muted); line-height: 1.9;
  }
  .callout {
    background: var(--accent-soft); border: 1px solid #f0c9cb; border-left: 4px solid var(--accent);
    border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 16px 0; font-size: 10pt;
  }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${body}
<script>${MERMAID_JS}</script>
<script>
  window.__mermaidDone = (async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral',
      flowchart: { htmlLabels: true, useMaxWidth: true },
      sequence: { useMaxWidth: true }, er: { useMaxWidth: true } });
    try { await mermaid.run({ querySelector: '.mermaid', suppressErrors: true }); }
    catch (e) { console.error('mermaid run error', e); }
    return true;
  })();
</script>
</body></html>`;

const debugHtml = path.join(__dirname, 'debug.html');
fs.writeFileSync(debugHtml, html);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + debugHtml, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => window.__mermaidDone);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
  const diagramCount = await page.evaluate(() =>
    document.querySelectorAll('.mermaid svg').length);
  console.log(`Rendered mermaid diagrams: ${diagramCount}`);
  if (errors.length) console.log('Page warnings:\n' + errors.slice(0, 8).join('\n'));

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#8a949c;padding:0 16mm;display:flex;justify-content:space-between;">' +
      '<span>CrowdStream — Production Plan</span>' +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`Wrote ${OUT} (${kb} KB)`);
})().catch((e) => { console.error(e); process.exit(1); });
