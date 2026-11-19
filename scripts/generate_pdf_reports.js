/**
 * Generates Real Binary PDF Documents from the Academic PBL Reports
 * Using PDFKit with Academic Styling, Page Numbers, and Formatted Tables
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const reports = [
  {
    md: 'GROUP1_CONTRIBUTOR_1_1_REPORT.md',
    pdf: 'GROUP1_CONTRIBUTOR_1_1_REPORT.pdf',
    title: 'Group 1 - Contributor 1.1 Technical Report: Academic Chaincode Lead'
  },
  {
    md: 'GROUP1_CONTRIBUTOR_1_2_REPORT.md',
    pdf: 'GROUP1_CONTRIBUTOR_1_2_REPORT.pdf',
    title: 'Group 1 - Contributor 1.2 Technical Report: CouchDB State & Identity Lead'
  },
  {
    md: 'GROUP1_CONTRIBUTOR_1_3_REPORT.md',
    pdf: 'GROUP1_CONTRIBUTOR_1_3_REPORT.pdf',
    title: 'Group 1 - Contributor 1.3 Technical Report: Org 1 Academic Agent Lead'
  },
  {
    md: 'ACADEMIC_BLOCKCHAIN_PBL_REPORT.md',
    pdf: 'ACADEMIC_BLOCKCHAIN_PBL_REPORT.pdf',
    title: 'Master Academic Blockchain PBL Consortium Technical Report'
  }
];

function createPdfFromMarkdown(mdContent, outputPath, docTitle) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 45, left: 45, right: 45 },
      bufferPages: true
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const lines = mdContent.split('\n');

    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    function flushTable() {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        doc.moveDown(0.5);
        const colCount = tableHeaders.length || (tableRows[0] ? tableRows[0].length : 1);
        const colWidth = (doc.page.width - 90) / colCount;

        // Render Header
        if (tableHeaders.length > 0) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
          const startX = doc.x;
          let currentX = startX;
          const startY = doc.y;

          doc.rect(startX, startY, doc.page.width - 90, 18).fillAndStroke('#f1f5f9', '#cbd5e1');
          doc.fillColor('#0f172a');

          tableHeaders.forEach((h, idx) => {
            doc.text(h, currentX + 4, startY + 4, { width: colWidth - 8, height: 12, ellipsis: true });
            currentX += colWidth;
          });
          doc.moveDown(0.8);
        }

        // Render Rows
        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
        tableRows.forEach((row, rIdx) => {
          if (doc.y > doc.page.height - 60) {
            doc.addPage();
          }
          const startX = doc.x;
          let currentX = startX;
          const startY = doc.y;

          if (rIdx % 2 === 1) {
            doc.rect(startX, startY, doc.page.width - 90, 16).fill('#f8fafc');
          }
          doc.rect(startX, startY, doc.page.width - 90, 16).stroke('#e2e8f0');
          doc.fillColor('#1e293b');

          row.forEach((c) => {
            doc.text(c, currentX + 4, startY + 3, { width: colWidth - 8, height: 12, ellipsis: true });
            currentX += colWidth;
          });
          doc.moveDown(0.7);
        });

        tableHeaders = [];
        tableRows = [];
        doc.moveDown(0.5);
      }
      inTable = false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if page needs break
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
      }

      // Table row check
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim().replace(/\*\*/g, ''));
        if (cells.every(c => /^:?-+:?$/.test(c))) {
          continue; // separator
        }
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (line.startsWith('# ')) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a');
        doc.text(line.replace('# ', '').toUpperCase(), { align: 'center' });
        doc.rect(doc.x, doc.y + 4, doc.page.width - 90, 1.5).fill('#1e3a8a');
        doc.moveDown(1);
      } else if (line.startsWith('## ')) {
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a');
        doc.text(line.replace('## ', ''));
        doc.rect(doc.x, doc.y + 2, doc.page.width - 90, 0.5).fill('#cbd5e1');
        doc.moveDown(0.5);
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155');
        doc.text(line.replace('### ', ''));
        doc.moveDown(0.3);
      } else if (line.startsWith('---')) {
        doc.moveDown(0.5);
        doc.rect(doc.x, doc.y, doc.page.width - 90, 0.5).fill('#e2e8f0');
        doc.moveDown(0.5);
      } else if (line.startsWith('> ')) {
        doc.moveDown(0.3);
        const quoteText = line.replace('> ', '');
        const y = doc.y;
        doc.rect(doc.x, y, 3, 20).fill('#3b82f6');
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#1e40af');
        doc.text(quoteText, doc.x + 8, y + 2, { width: doc.page.width - 110 });
        doc.moveDown(0.5);
      } else if (line.startsWith('```')) {
        // Code fence
        let codeContent = '';
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent += lines[i] + '\n';
          i++;
        }
        doc.moveDown(0.4);
        const y = doc.y;
        const boxHeight = Math.min(Math.max(codeContent.split('\n').length * 10, 20), 180);
        doc.rect(doc.x, y, doc.page.width - 90, boxHeight).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font('Courier').fontSize(7.5).fillColor('#0f172a');
        doc.text(codeContent.trim(), doc.x + 6, y + 6, { width: doc.page.width - 102, height: boxHeight - 12 });
        doc.y = y + boxHeight + 4;
        doc.moveDown(0.4);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
        const bulletText = line.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
        doc.text('•  ' + bulletText, { indent: 10, align: 'left' });
        doc.moveDown(0.2);
      } else if (line.length > 0) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
        const cleanText = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\$(.*?)\$/g, '$1');
        doc.text(cleanText, { align: 'justify', lineGap: 1.5 });
        doc.moveDown(0.3);
      }
    }

    if (inTable) {
      flushTable();
    }

    // Add running headers & footers with page numbers
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);

      // Header
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
      doc.text('NATIONAL INSTITUTE OF TECHNOLOGY WARANGAL — BLOCKCHAIN PBL CONSORTIUM', 45, 25, {
        align: 'left'
      });
      doc.text('HYPERLEDGER FABRIC 2.5', doc.page.width - 170, 25, {
        align: 'right'
      });
      doc.rect(45, 35, doc.page.width - 90, 0.5).fill('#e2e8f0');

      // Footer
      doc.rect(45, doc.page.height - 35, doc.page.width - 90, 0.5).fill('#e2e8f0');
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
      doc.text(docTitle, 45, doc.page.height - 25, { align: 'left', width: 350 });
      doc.text(`Page ${p + 1} of ${range.count}`, doc.page.width - 120, doc.page.height - 25, { align: 'right' });
    }

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

async function generateAllPdfs() {
  const rootDir = path.join(__dirname, '..');
  const downloadsDir = 'C:\\Users\\PC\\Downloads';
  const desktopDir = 'C:\\Users\\PC\\Desktop\\Academic_Blockchain_Reports';

  for (const r of reports) {
    const mdPath = path.join(rootDir, r.md);
    if (!fs.existsSync(mdPath)) continue;

    const mdContent = fs.readFileSync(mdPath, 'utf8');

    // Generate in project root
    const rootPdfPath = path.join(rootDir, r.pdf);
    await createPdfFromMarkdown(mdContent, rootPdfPath, r.title);
    console.log(`✅ Generated PDF: ${rootPdfPath}`);

    // Copy to Downloads
    try {
      const dlPdfPath = path.join(downloadsDir, r.pdf);
      fs.copyFileSync(rootPdfPath, dlPdfPath);
      console.log(`   -> Copied to Downloads: ${dlPdfPath}`);
    } catch (e) {
      console.warn(`   Notice: Could not copy to Downloads: ${e.message}`);
    }

    // Copy to Desktop
    try {
      if (!fs.existsSync(desktopDir)) fs.mkdirSync(desktopDir, { recursive: true });
      const deskPdfPath = path.join(desktopDir, r.pdf);
      fs.copyFileSync(rootPdfPath, deskPdfPath);
      console.log(`   -> Copied to Desktop: ${deskPdfPath}`);
    } catch (e) {
      console.warn(`   Notice: Could not copy to Desktop: ${e.message}`);
    }
  }
}

generateAllPdfs().catch(console.error);
