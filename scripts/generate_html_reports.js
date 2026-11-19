/**
 * Converts Markdown Reports to Formatted Academic HTML Documents
 * Ready for 1-click viewing in browser or "Print to PDF" (Ctrl + P)
 */

const fs = require('fs');
const path = require('path');

const reports = [
  { md: 'ACADEMIC_BLOCKCHAIN_PBL_REPORT.md', html: 'ACADEMIC_BLOCKCHAIN_PBL_REPORT.html', title: 'Master Academic Blockchain PBL Report' },
  { md: 'GROUP1_CONTRIBUTOR_1_1_REPORT.md', html: 'GROUP1_CONTRIBUTOR_1_1_REPORT.html', title: 'Group 1 - Contributor 1.1 Technical Report' },
  { md: 'GROUP1_CONTRIBUTOR_1_2_REPORT.md', html: 'GROUP1_CONTRIBUTOR_1_2_REPORT.html', title: 'Group 1 - Contributor 1.2 Technical Report' },
  { md: 'GROUP1_CONTRIBUTOR_1_3_REPORT.md', html: 'GROUP1_CONTRIBUTOR_1_3_REPORT.html', title: 'Group 1 - Contributor 1.3 Technical Report' }
];

function markdownToHtml(mdText, title) {
  // Simple, clean Markdown to HTML parser
  let html = mdText
    // Code blocks
    .replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="code-block"><code class="language-${lang}">${escaped}</code></pre>`;
    })
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Horizontal Rule
    .replace(/^---$/gim, '<hr/>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');

  // Tables
  const lines = html.split('\n');
  const processedLines = [];
  let inTable = false;
  let tableHeaderParsed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      // Check if separator line
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        tableHeaderParsed = true;
        continue;
      }
      if (!inTable) {
        processedLines.push('<table class="academic-table">');
        inTable = true;
      }
      if (!tableHeaderParsed) {
        processedLines.push('<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>');
      } else {
        processedLines.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
      }
    } else {
      if (inTable) {
        processedLines.push('</tbody></table>');
        inTable = false;
        tableHeaderParsed = false;
      }
      if (line.length > 0 && !line.startsWith('<h') && !line.startsWith('<pre') && !line.startsWith('<li') && !line.startsWith('<block') && !line.startsWith('<hr')) {
        processedLines.push(`<p>${line}</p>`);
      } else {
        processedLines.push(line);
      }
    }
  }
  if (inTable) {
    processedLines.push('</tbody></table>');
  }

  const bodyContent = processedLines.join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      line-height: 1.6;
      color: #111827;
      background: #faf8f5;
      margin: 0;
      padding: 40px 20px;
    }
    .document-container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 50px 60px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    h1 {
      font-size: 1.65rem;
      text-align: center;
      line-height: 1.35;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 25px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
    }
    h2 {
      font-size: 1.3rem;
      color: #1e3a8a;
      margin-top: 35px;
      margin-bottom: 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
    }
    h3 {
      font-size: 1.1rem;
      color: #334155;
      margin-top: 25px;
      margin-bottom: 8px;
    }
    p, li {
      font-size: 1.02rem;
      text-align: justify;
    }
    .academic-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      font-size: 0.95rem;
    }
    .academic-table th, .academic-table td {
      border: 1px solid #94a3b8;
      padding: 8px 12px;
      text-align: left;
    }
    .academic-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
    }
    .academic-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .code-block {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #1e3a8a;
      padding: 12px 16px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.88rem;
      overflow-x: auto;
      margin: 20px 0;
      white-space: pre-wrap;
    }
    code {
      font-family: 'Courier New', Courier, monospace;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
      color: #1e3a8a;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      background: #eff6ff;
      margin: 20px 0;
      padding: 12px 20px;
      font-style: italic;
      color: #1e40af;
    }
    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
    .print-bar {
      position: sticky;
      top: 10px;
      max-width: 850px;
      margin: 0 auto 15px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e3a8a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .btn-print {
      background: #ffffff;
      color: #1e3a8a;
      font-weight: bold;
      border: none;
      padding: 8px 18px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.95rem;
    }
    .btn-print:hover {
      background: #f1f5f9;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .document-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .print-bar {
        display: none !important;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
      table, pre, blockquote {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>📄 <strong>${title}</strong> (National Institute of Technology Warangal)</span>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="document-container">
    ${bodyContent}
  </div>
</body>
</html>`;
}

const rootDir = path.join(__dirname, '..');
reports.forEach(r => {
  const mdPath = path.join(rootDir, r.md);
  const htmlPath = path.join(rootDir, r.html);
  if (fs.existsSync(mdPath)) {
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const htmlOutput = markdownToHtml(mdContent, r.title);
    fs.writeFileSync(htmlPath, htmlOutput, 'utf8');
    console.log(`Generated HTML: ${r.html}`);
  }
});
