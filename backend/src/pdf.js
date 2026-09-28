'use strict';

const os = require('os');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Get host address accessible from mobile phones on the same Wi-Fi network.
 */
function getPortalBaseUrl() {
  if (process.env.PORTAL_URL) {
    return process.env.PORTAL_URL.replace(/\/$/, '');
  }
  if (process.env.HOST_IP) {
    return `http://${process.env.HOST_IP}:3000`;
  }
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Find non-internal IPv4 address (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x)
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.')) {
          return `http://${iface.address}:3000`;
        }
      }
    }
  } catch (e) {
    // fallback
  }
  return 'http://localhost:3000';
}

/**
 * Draw realistic simulated handwritten signatures using vector curves.
 */
function drawHODSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0f2b5c').lineWidth(1.4).lineCap('round').lineJoin('round');
  
  // Initial loop & K
  doc.moveTo(x + 5, y + 15)
     .bezierCurveTo(x + 8, y - 10, x + 15, y - 15, x + 18, y - 5)
     .bezierCurveTo(x + 20, y + 5, x + 14, y + 18, x + 12, y + 22);
  
  // V loop
  doc.moveTo(x + 16, y)
     .bezierCurveTo(x + 24, y - 8, x + 30, y + 12, x + 36, y - 2)
     .bezierCurveTo(x + 42, y - 14, x + 46, y + 16, x + 50, y + 6);
  
  // Rao cursive
  doc.moveTo(x + 48, y + 8)
     .bezierCurveTo(x + 55, y - 6, x + 62, y - 2, x + 68, y + 10)
     .bezierCurveTo(x + 75, y + 18, x + 82, y - 4, x + 92, y + 2)
     .bezierCurveTo(x + 100, y + 8, x + 108, y + 4, x + 115, y - 1);
  
  // Dynamic flourish underline
  doc.lineWidth(1.2)
     .moveTo(x + 8, y + 18)
     .bezierCurveTo(x + 45, y + 26, x + 85, y + 12, x + 125, y + 16);
  
  doc.restore();
}

function drawExamControllerSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0b1d3a').lineWidth(1.5).lineCap('round').lineJoin('round');
  
  // Big initial loop S
  doc.moveTo(x + 10, y + 18)
     .bezierCurveTo(x + 2, y + 4, x + 12, y - 18, x + 24, y - 16)
     .bezierCurveTo(x + 36, y - 14, x + 14, y - 2, x + 22, y + 10)
     .bezierCurveTo(x + 28, y + 20, x + 40, y + 24, x + 48, y + 16);
  
  // R and Murthy sharp strokes
  doc.moveTo(x + 42, y + 12)
     .bezierCurveTo(x + 48, y - 8, x + 56, y - 10, x + 62, y + 2)
     .bezierCurveTo(x + 68, y + 14, x + 72, y - 4, x + 80, y + 8)
     .bezierCurveTo(x + 86, y + 18, x + 94, y - 8, x + 102, y + 4)
     .bezierCurveTo(x + 110, y + 16, x + 118, y + 12, x + 126, y - 4);
  
  // Under-swoop flourish
  doc.lineWidth(1.1)
     .moveTo(x + 15, y + 25)
     .bezierCurveTo(x + 60, y + 20, x + 95, y + 28, x + 130, y + 14);

  doc.restore();
}

function drawDeanSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0a1931').lineWidth(1.4).lineCap('round').lineJoin('round');
  
  // Capital P loop
  doc.moveTo(x + 8, y + 20)
     .bezierCurveTo(x + 10, y - 12, x + 18, y - 20, x + 30, y - 18)
     .bezierCurveTo(x + 42, y - 16, x + 38, y - 2, x + 24, y + 4)
     .bezierCurveTo(x + 12, y + 8, x + 8, y + 22, x + 10, y + 24);
  
  // Chandra flowing curves
  doc.moveTo(x + 28, y + 2)
     .bezierCurveTo(x + 38, y - 10, x + 46, y + 14, x + 54, y - 4)
     .bezierCurveTo(x + 62, y - 18, x + 70, y + 12, x + 78, y + 4)
     .bezierCurveTo(x + 86, y - 8, x + 94, y + 10, x + 104, y - 2)
     .bezierCurveTo(x + 112, y - 12, x + 120, y + 8, x + 128, y + 6);
  
  // Underline flourish + dots
  doc.lineWidth(1.3)
     .moveTo(x + 5, y + 22)
     .bezierCurveTo(x + 40, y + 28, x + 90, y + 14, x + 135, y + 20);
  
  doc.circle(x + 122, y + 26, 1.2).fillAndStroke('#0a1931');
  doc.circle(x + 128, y + 26, 1.2).fillAndStroke('#0a1931');
  
  doc.restore();
}

/**
 * Generate an official Academic Certificate PDF as a Buffer.
 * @param {Object} certData
 * @returns {Promise<Buffer>}
 */
async function generateCertificatePDF(certData) {
  const baseUrl = getPortalBaseUrl();
  const verifyUrl = `${baseUrl}/verify.html?certId=${encodeURIComponent(certData.certId)}`;
  
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      width: 140,
      color: {
        dark: '#1e3a8a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate QR buffer:', err);
  }

  return new Promise((resolve, reject) => {
    try {
      const fixedDate = certData.createdAt 
        ? new Date(certData.createdAt) 
        : (certData.issueDate ? new Date(certData.issueDate) : new Date('2024-01-01T00:00:00.000Z'));

      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        info: {
          Title: `Academic Certificate - ${certData.certId}`,
          Author: 'National Institute of Technology Warangal',
          Subject: certData.certType || 'Degree Completion',
          CreationDate: fixedDate,
          ModDate: fixedDate
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const width = doc.page.width;
      const height = doc.page.height;
      const contentWidth = width - 80;

      // Outer Decorative Border
      doc.rect(20, 20, width - 40, height - 40)
         .lineWidth(3)
         .strokeColor('#1e3a8a')
         .stroke();

      // Inner Decorative Border
      doc.rect(26, 26, width - 52, height - 52)
         .lineWidth(1)
         .strokeColor('#93c5fd')
         .stroke();

      // ==========================================
      // 1. Institution Header & Title Section
      // ==========================================
      let currY = 40;

      doc.font('Helvetica-Bold')
         .fontSize(23)
         .fillColor('#1e3a8a')
         .text('NATIONAL INSTITUTE OF TECHNOLOGY WARANGAL', 40, currY, { width: contentWidth, align: 'center' });

      currY += 26;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('An Institute of National Importance • Ministry of Education, Government of India', 40, currY, { width: contentWidth, align: 'center' });

      currY += 16;
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Office of the Controller of Examinations & Central Academic Registry', 40, currY, { width: contentWidth, align: 'center' });

      currY += 20;
      doc.fontSize(17)
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text('CERTIFICATE OF DEGREE COMPLETION', 40, currY, { width: contentWidth, align: 'center', characterSpacing: 1 });

      currY += 18;
      doc.fontSize(9.5)
         .font('Helvetica-Oblique')
         .fillColor('#475569')
         .text('This tamper-evident credential is authenticated and anchored on Hyperledger Fabric 2.5.', 40, currY, { width: contentWidth, align: 'center' });

      // ==========================================
      // 2. Candidate & Degree Body
      // ==========================================
      currY += 26;
      doc.fontSize(12.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text('This is to certify that', 40, currY, { width: contentWidth, align: 'center' });

      currY += 18;
      doc.fontSize(22)
         .font('Helvetica-Bold')
         .fillColor('#1e3a8a')
         .text(certData.studentName || 'Student Name', 40, currY, { width: contentWidth, align: 'center' });

      currY += 24;
      doc.fontSize(11.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text(`bearing Registration ID: ${certData.studentId || 'N/A'}`, 40, currY, { width: contentWidth, align: 'center' });

      currY += 16;
      doc.fontSize(11.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text(`has successfully satisfied all requirements of the Department of ${certData.department || 'Computer Science & Engineering'}`, 40, currY, { width: contentWidth, align: 'center' });

      currY += 16;
      doc.fontSize(11.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text('and has been officially conferred the award of', 40, currY, { width: contentWidth, align: 'center' });

      currY += 20;
      doc.fontSize(16.5)
         .font('Helvetica-Bold')
         .fillColor('#0284c7')
         .text(certData.certType || 'Bachelor of Technology in Computer Science & Engineering', 40, currY, { width: contentWidth, align: 'center' });

      // ==========================================
      // 3. Embedded Verification QR Code (Top-Right Overlay)
      // ==========================================
      if (qrBuffer) {
        const qrX = width - 115;
        const qrY = 36;
        doc.image(qrBuffer, qrX, qrY, { width: 66, height: 66 });
        doc.fontSize(7)
           .font('Helvetica-Bold')
           .fillColor('#1e3a8a')
           .text('SCAN TO VERIFY', qrX - 10, qrY + 68, { width: 86, align: 'center' });
      }

      // ==========================================
      // 4. Simulated Aesthetic Handwritten Signatures
      // ==========================================
      const sigY = height - 110;

      // Org 1: HOD CSE Signature
      drawHODSignature(doc, 60, sigY - 20);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. K. V. Rao', 60, sigY);
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Head of Department (CSE)', 60, sigY + 13);
      doc.fontSize(7.5).fillColor('#64748b').text('Org 1: Academic Authority', 60, sigY + 25);

      // Org 2: Exam Controller Signature
      drawExamControllerSignature(doc, width / 2 - 65, sigY - 20);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. S. R. Murthy', width / 2 - 65, sigY);
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Controller of Examinations', width / 2 - 65, sigY + 13);
      doc.fontSize(7.5).fillColor('#64748b').text('Org 2: Evaluation Authority', width / 2 - 65, sigY + 25);

      // Org 3: Dean / Registrar Signature
      drawDeanSignature(doc, width - 200, sigY - 20);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. P. Chandrasekhar', width - 200, sigY);
      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text('Dean (Academic Affairs) & Registrar', width - 200, sigY + 13);
      doc.fontSize(7.5).fillColor('#64748b').text('Org 3: Central Governance', width - 200, sigY + 25);

      // ==========================================
      // 5. Verification Footnote & Ledger Metadata
      // ==========================================
      const footerY = height - 48;
      doc.fontSize(7.5)
         .font('Helvetica')
         .fillColor('#475569')
         .text(`Certificate ID: ${certData.certId}  |  Issue Date: ${certData.issueDate || new Date().toISOString().substring(0, 10)}  |  Request ID: ${certData.requestId || 'N/A'}`, 40, footerY, { width: contentWidth, align: 'center' });

      doc.fontSize(7)
         .fillColor('#94a3b8')
         .text('NIT Warangal Hyperledger Fabric Consortium • Verified by Org1, Org2, Org3 Endorsement', 40, footerY + 10, { width: contentWidth, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificatePDF, getPortalBaseUrl };
