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
/**
 * Draw realistic simulated handwritten signatures using vector curves.
 * Explicitly stroked in navy/indigo ink and positioned strictly above the signature line.
 */
function drawHODSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0f2b5c').lineWidth(1.3).lineCap('round').lineJoin('round');
  
  // Initial cursive 'K'
  doc.moveTo(x + 5, y - 5)
     .bezierCurveTo(x + 10, y - 32, x + 18, y - 35, x + 20, y - 22)
     .bezierCurveTo(x + 22, y - 10, x + 16, y - 4, x + 14, y - 2)
     .stroke();

  doc.moveTo(x + 12, y - 20)
     .bezierCurveTo(x + 24, y - 24, x + 28, y - 12, x + 30, y - 3)
     .stroke();

  // Cursive 'V' loop
  doc.moveTo(x + 28, y - 16)
     .bezierCurveTo(x + 34, y - 28, x + 40, y - 8, x + 46, y - 20)
     .bezierCurveTo(x + 50, y - 30, x + 54, y - 6, x + 58, y - 14)
     .stroke();

  // Flowing 'Rao'
  doc.moveTo(x + 56, y - 14)
     .bezierCurveTo(x + 64, y - 28, x + 72, y - 22, x + 76, y - 10)
     .bezierCurveTo(x + 82, y - 2, x + 88, y - 24, x + 98, y - 8)
     .bezierCurveTo(x + 106, y + 2, x + 114, y - 16, x + 124, y - 10)
     .stroke();

  // Dynamic flourish underline
  doc.lineWidth(1.1)
     .moveTo(x + 8, y - 2)
     .bezierCurveTo(x + 45, y + 4, x + 85, y - 8, x + 130, y - 4)
     .stroke();

  doc.restore();
}

function drawExamControllerSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0b1d3a').lineWidth(1.3).lineCap('round').lineJoin('round');

  // Large sweeping initial 'S'
  doc.moveTo(x + 12, y - 6)
     .bezierCurveTo(x + 4, y - 18, x + 14, y - 36, x + 26, y - 34)
     .bezierCurveTo(x + 38, y - 32, x + 16, y - 20, x + 24, y - 8)
     .bezierCurveTo(x + 30, y + 2, x + 42, y + 3, x + 48, y - 8)
     .stroke();

  // 'R' loop & Murthy cursive waves
  doc.moveTo(x + 44, y - 12)
     .bezierCurveTo(x + 50, y - 30, x + 58, y - 32, x + 64, y - 18)
     .bezierCurveTo(x + 70, y - 4, x + 76, y - 24, x + 84, y - 10)
     .bezierCurveTo(x + 90, y + 1, x + 98, y - 26, x + 106, y - 12)
     .bezierCurveTo(x + 114, y - 2, x + 122, y - 20, x + 132, y - 8)
     .stroke();

  // Under-swoop flourish with sharp tail
  doc.lineWidth(1.1)
     .moveTo(x + 16, y + 2)
     .bezierCurveTo(x + 58, y - 3, x + 95, y + 5, x + 136, y - 6)
     .stroke();

  doc.restore();
}

function drawDeanSignature(doc, x, y) {
  doc.save();
  doc.strokeColor('#0a1931').lineWidth(1.3).lineCap('round').lineJoin('round');

  // Stately 'P' loop
  doc.moveTo(x + 8, y - 4)
     .bezierCurveTo(x + 10, y - 34, x + 18, y - 38, x + 30, y - 36)
     .bezierCurveTo(x + 42, y - 34, x + 38, y - 20, x + 24, y - 14)
     .bezierCurveTo(x + 12, y - 10, x + 8, y + 2, x + 10, y + 4)
     .stroke();

  // Flowing 'Chandra' script
  doc.moveTo(x + 28, y - 18)
     .bezierCurveTo(x + 38, y - 30, x + 46, y - 6, x + 54, y - 24)
     .bezierCurveTo(x + 62, y - 36, x + 70, y - 8, x + 78, y - 16)
     .bezierCurveTo(x + 86, y - 28, x + 94, y - 8, x + 104, y - 22)
     .bezierCurveTo(x + 112, y - 32, x + 120, y - 10, x + 130, y - 12)
     .stroke();

  // Underline flourish + seal dots
  doc.lineWidth(1.1)
     .moveTo(x + 6, y + 2)
     .bezierCurveTo(x + 42, y + 7, x + 90, y - 5, x + 138, y + 1)
     .stroke();

  doc.circle(x + 126, y + 5, 1.2).fillAndStroke('#0a1931');
  doc.circle(x + 132, y + 5, 1.2).fillAndStroke('#0a1931');

  doc.restore();
}

/**
 * Draw an official Senate Seal emblem.
 */
function drawInstitutionalSeal(doc, centerX, centerY, radius) {
  doc.save();
  
  // Outer decorative circle
  doc.circle(centerX, centerY, radius)
     .lineWidth(1.5)
     .strokeColor('#b45309') // Gold accent
     .stroke();

  // Inner dashed / beaded circle
  doc.circle(centerX, centerY, radius - 4)
     .lineWidth(0.8)
     .dash(3, { space: 2 })
     .strokeColor('#1e3a8a')
     .stroke();
  doc.undash();

  // Innermost ring
  doc.circle(centerX, centerY, radius - 10)
     .lineWidth(1)
     .strokeColor('#b45309')
     .stroke();

  // Seal center text
  doc.font('Helvetica-Bold')
     .fontSize(6)
     .fillColor('#1e3a8a')
     .text('NIT WARANGAL', centerX - radius + 6, centerY - 12, { width: (radius - 6) * 2, align: 'center' });

  doc.font('Helvetica-Bold')
     .fontSize(5)
     .fillColor('#b45309')
     .text('★  ★  ★', centerX - radius + 6, centerY - 4, { width: (radius - 6) * 2, align: 'center' });

  doc.font('Helvetica')
     .fontSize(5.5)
     .fillColor('#334155')
     .text('OFFICIAL SEAL', centerX - radius + 6, centerY + 3, { width: (radius - 6) * 2, align: 'center' });

  doc.font('Helvetica-Bold')
     .fontSize(5)
     .fillColor('#64748b')
     .text('1959', centerX - radius + 6, centerY + 11, { width: (radius - 6) * 2, align: 'center' });

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
        margins: { top: 25, bottom: 25, left: 25, right: 25 },
        info: {
          Title: `Academic Certificate - ${certData.certId}`,
          Author: 'National Institute of Technology Warangal',
          Subject: certData.certType || 'Degree Conferment',
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

      // ==========================================
      // Decorative Multi-Tiered Border
      // ==========================================
      // Outer primary navy border
      doc.rect(18, 18, width - 36, height - 36)
         .lineWidth(2.5)
         .strokeColor('#1e3a8a')
         .stroke();

      // Middle gold accent border
      doc.rect(23, 23, width - 46, height - 46)
         .lineWidth(1)
         .strokeColor('#d97706')
         .stroke();

      // Inner thin navy framing
      doc.rect(26, 26, width - 52, height - 52)
         .lineWidth(0.6)
         .strokeColor('#93c5fd')
         .stroke();

      // Four corner ornamental accents
      const corners = [
        { x: 26, y: 26 },
        { x: width - 26, y: 26 },
        { x: 26, y: height - 26 },
        { x: width - 26, y: height - 26 }
      ];
      doc.save();
      doc.fillColor('#d97706');
      corners.forEach(c => {
        doc.circle(c.x, c.y, 3).fill();
      });
      doc.restore();

      // ==========================================
      // 1. Institution Header & Subtitles
      // ==========================================
      let currY = 38;

      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor('#1e3a8a')
         .text('NATIONAL INSTITUTE OF TECHNOLOGY WARANGAL', 40, currY, { width: contentWidth, align: 'center', characterSpacing: 0.5 });

      currY += 24;
      doc.fontSize(9.5)
         .font('Helvetica-Bold')
         .fillColor('#b45309')
         .text('An Institute of National Importance • Established by MHRD, Govt. of India (1959)', 40, currY, { width: contentWidth, align: 'center' });

      currY += 15;
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Office of the Controller of Examinations & Central Academic Registry', 40, currY, { width: contentWidth, align: 'center' });

      currY += 18;
      // Ornamental dividing line with center diamond
      doc.save();
      doc.moveTo(width / 2 - 180, currY).lineTo(width / 2 + 180, currY).lineWidth(0.8).strokeColor('#d97706').stroke();
      doc.rect(width / 2 - 3, currY - 3, 6, 6).fillColor('#1e3a8a').fill();
      doc.restore();

      currY += 14;
      doc.fontSize(16.5)
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text('CERTIFICATE OF DEGREE CONFERMENT', 40, currY, { width: contentWidth, align: 'center', characterSpacing: 1.2 });

      currY += 16;
      doc.fontSize(8.5)
         .font('Helvetica-Oblique')
         .fillColor('#64748b')
         .text('This credential is tamper-evidently anchored on the Hyperledger Fabric Consortium Blockchain.', 40, currY, { width: contentWidth, align: 'center' });

      // ==========================================
      // 2. Candidate & Degree Body
      // ==========================================
      currY += 22;
      doc.fontSize(11.5)
         .font('Helvetica')
         .fillColor('#334155')
         .text('The Senate of the National Institute of Technology Warangal hereby certifies that', 40, currY, { width: contentWidth, align: 'center' });

      currY += 17;
      // Student Name with prominent styling
      doc.fontSize(21)
         .font('Helvetica-Bold')
         .fillColor('#1e3a8a')
         .text(certData.studentName || 'Student Name', 40, currY, { width: contentWidth, align: 'center' });

      currY += 23;
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#334155')
         .text(`bearing Registration / Roll Number: `, 40, currY, { width: contentWidth, align: 'center', continued: true })
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text(`${certData.studentId || 'N/A'}`);

      currY += 16;
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#334155')
         .text(`having fulfilled all prescribed academic regulations and credit requirements in the`, 40, currY, { width: contentWidth, align: 'center' });

      currY += 15;
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#1e3a8a')
         .text(`Department of ${certData.department || 'Computer Science & Engineering'}`, 40, currY, { width: contentWidth, align: 'center' });

      currY += 15;
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#334155')
         .text('has been officially admitted to the award of the degree of', 40, currY, { width: contentWidth, align: 'center' });

      currY += 18;
      // Degree Title in prominent highlight box or font
      doc.fontSize(16.5)
         .font('Helvetica-Bold')
         .fillColor('#0284c7')
         .text(certData.certType || 'Master of Computer Applications (MCA)', 40, currY, { width: contentWidth, align: 'center' });

      currY += 17;
      doc.fontSize(10)
         .font('Helvetica-Oblique')
         .fillColor('#475569')
         .text('with all the honors, privileges, and rights pertaining thereto.', 40, currY, { width: contentWidth, align: 'center' });

      // ==========================================
      // 3. Embedded Verification QR Code (Top-Right)
      // ==========================================
      if (qrBuffer) {
        const qrX = width - 118;
        const qrY = 36;
        
        // Soft border frame around QR
        doc.save();
        doc.rect(qrX - 4, qrY - 4, 76, 76).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
        doc.image(qrBuffer, qrX, qrY, { width: 68, height: 68 });
        doc.restore();

        doc.fontSize(6.5)
           .font('Helvetica-Bold')
           .fillColor('#1e3a8a')
           .text('SCAN TO VERIFY', qrX - 10, qrY + 74, { width: 88, align: 'center' });
      }

      // ==========================================
      // 4. Institutional Senate Seal (Center-Bottom)
      // ==========================================
      const sigLineY = height - 90;
      drawInstitutionalSeal(doc, width / 2, sigLineY - 14, 28);

      // ==========================================
      // 5. Signatures with Clean Lines & Labels
      // ==========================================
      const sig1X = 65;
      const sig2X = width / 2 - 70; // used for seal or center
      const sig3X = width - 215;

      // Org 1: HOD CSE Signature (Left)
      drawHODSignature(doc, sig1X, sigLineY - 10);
      doc.moveTo(sig1X, sigLineY).lineTo(sig1X + 150, sigLineY).lineWidth(0.8).strokeColor('#94a3b8').stroke();
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. K. V. Rao', sig1X, sigLineY + 6, { width: 150, align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text('Head of Department (CSE)', sig1X, sigLineY + 18, { width: 150, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').text('Org 1: Academic Authority', sig1X, sigLineY + 28, { width: 150, align: 'center' });

      // Org 2: Exam Controller Signature (Center-Left / Below Seal or Center)
      // We place Org 2 and Org 3 symmetrically
      const examX = width / 2 - 75;
      // Draw signature slightly above line
      drawExamControllerSignature(doc, examX, sigLineY - 10);
      doc.moveTo(examX, sigLineY).lineTo(examX + 150, sigLineY).lineWidth(0.8).strokeColor('#94a3b8').stroke();
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. S. R. Murthy', examX, sigLineY + 6, { width: 150, align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text('Controller of Examinations', examX, sigLineY + 18, { width: 150, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').text('Org 2: Evaluation Authority', examX, sigLineY + 28, { width: 150, align: 'center' });

      // Org 3: Dean / Registrar Signature (Right)
      drawDeanSignature(doc, sig3X, sigLineY - 10);
      doc.moveTo(sig3X, sigLineY).lineTo(sig3X + 150, sigLineY).lineWidth(0.8).strokeColor('#94a3b8').stroke();
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Prof. P. Chandrasekhar', sig3X, sigLineY + 6, { width: 150, align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text('Dean (Academic) & Registrar', sig3X, sigLineY + 18, { width: 150, align: 'center' });
      doc.fontSize(7).fillColor('#64748b').text('Org 3: Central Governance', sig3X, sigLineY + 28, { width: 150, align: 'center' });

      // ==========================================
      // 6. Verification Footnote & Ledger Metadata
      // ==========================================
      const footerY = height - 42;
      doc.fontSize(7.5)
         .font('Helvetica')
         .fillColor('#475569')
         .text(`Certificate ID: ${certData.certId}  •  Issue Date: ${certData.issueDate || new Date().toISOString().substring(0, 10)}  •  Request Ref: ${certData.requestId || 'N/A'}`, 40, footerY, { width: contentWidth, align: 'center' });

      doc.fontSize(7)
         .fillColor('#94a3b8')
         .text('NIT Warangal Consortium Hyperledger Fabric 2.5 • Multi-Organization Multi-Signature Endorsement (Org1, Org2, Org3)', 40, footerY + 10, { width: contentWidth, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificatePDF, getPortalBaseUrl };
