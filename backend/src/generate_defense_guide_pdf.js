'use strict';

const fs = require('fs');
const PDFDocument = require('pdfkit');

function generateDefenseGuidePDF(outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 35, bottom: 35, left: 40, right: 40 },
    autoFirstPage: true,
    bufferPages: true
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Palette
  const cPrimary = '#0f2b5c';      // Deep Academic Navy
  const cAccent = '#0284c7';       // High-Tech Sky Blue
  const cSuccess = '#059669';      // Emerald Green
  const cDark = '#0f172a';         // Slate Black
  const cBody = '#334155';         // Slate Body
  const cMuted = '#64748b';        // Muted Gray
  const cLightBg = '#f8fafc';      // Box Bg
  const cBorder = '#cbd5e1';       // Box Border
  const cCardBg = '#f1f5f9';

  function drawHeaderBanner(title, subtitle) {
    doc.rect(40, 35, 515, 60).fill(cPrimary);
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
       .text(title, 45, 47, { align: 'center', width: 505 });
    doc.fillColor('#38bdf8').fontSize(9.5).font('Helvetica')
       .text(subtitle, 45, 71, { align: 'center', width: 505 });
    doc.fillColor(cDark);
    return 108;
  }

  function drawSectionTitle(title, y, num) {
    doc.rect(40, y, 515, 22).fill(cCardBg);
    doc.rect(40, y, 5, 22).fill(cAccent);
    doc.fillColor(cPrimary).fontSize(10.5).font('Helvetica-Bold')
       .text(`${num}. ${title}`, 52, y + 6);
    doc.fillColor(cDark);
    return y + 28;
  }

  function drawBox(x, y, w, h, bg, border) {
    doc.rect(x, y, w, h).fill(bg);
    if (border) doc.rect(x, y, w, h).lineWidth(0.8).strokeColor(border).stroke();
  }

  // ==========================================
  // PAGE 1: EXECUTIVE OVERVIEW & 3-ORG ARCHITECTURE
  // ==========================================
  let y = drawHeaderBanner(
    'ACADEMIC BLOCKCHAIN PROJECT DEFENSE GUIDE',
    '3-Organization Consortium Architecture • Hyperledger Fabric 2.5 (LTS) • IPFS Storage'
  );

  // Quick Metadata Box
  drawBox(40, y, 515, 34, cLightBg, cBorder);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(cPrimary).text('PROJECT AT A GLANCE:', 48, y + 6);
  doc.font('Helvetica').fontSize(7.5).fillColor(cBody)
     .text('Consortium: Org1 (Academic Faculty), Org2 (Examination Board), Org3 (Administration/Dean)', 48, y + 17)
     .text('Consensus: Raft Crash Fault-Tolerant (CFT) | Smart Contract: Node.js Chaincode | Storage: IPFS Kubo v0.26', 48, y + 26);
  y += 42;

  // Section 1: Executive Summary
  y = drawSectionTitle('EXECUTIVE SUMMARY & PROBLEM STATEMENT', y, '1');
  doc.font('Helvetica').fontSize(8.5).fillColor(cBody).text(
    'Traditional academic credentials rely on centralized university databases or paper certificates. This leads to rampant credential fraud, prolonged verification delays (weeks of manual correspondence), and catastrophic single points of failure. This project implements a decentralized, multi-organization academic credential issuance, verification, and revocation platform built on Hyperledger Fabric 2.5 and IPFS Kubo.',
    42, y, { width: 511, lineGap: 2.5 }
  );
  y += 50;

  // Section 2: 3-Organization Consortium Architecture
  y = drawSectionTitle('THE 3-ORGANIZATION CONSORTIUM ARCHITECTURE', y, '2');
  doc.font('Helvetica').fontSize(8.2).fillColor(cBody).text(
    'Rather than a single organization possessing unilateral control, the network enforces strict separation of academic responsibilities across 3 independent cryptographic organizations in a shared channel ("academicchannel"):',
    42, y, { width: 511, lineGap: 2 }
  );
  y += 24;

  const orgs = [
    {
      name: 'Org 1 — Academic Dept / University Faculty',
      port: 'peer0.org1:7051 | CouchDB: 5984 | MSP: Org1MSP',
      desc: 'Controls initial student onboarding and academic clearances. Enforces 3 distinct internal approval levels: Faculty Advisor verification, Head of Department (HOD) recommendation, and Department Academic Committee (DAC) curriculum compliance.'
    },
    {
      name: 'Org 2 — Autonomous Examination Board',
      port: 'peer0.org2:8051 | CouchDB: 6984 | MSP: Org2MSP',
      desc: 'Completely independent auditing authority. Responsible for verifying semester grade sheets, credit completion, and executing the tamper-evident exam grade freeze (EXAM_LOCKED). Org 1 cannot issue certificates without Org 2 lockdown.'
    },
    {
      name: 'Org 3 — University Administration & Public Verifier',
      port: 'peer0.org3:9051 | CouchDB: 7984 | MSP: Org3MSP',
      desc: 'Office of the Dean of Academics and Registrar. Grants final institutional executive clearance, triggers IPFS cryptographic pinning, anchors the certificate on the Fabric ledger, and holds sole legal authority for certificate revocation.'
    }
  ];

  orgs.forEach((org, i) => {
    drawBox(40, y, 515, 48, cLightBg, cBorder);
    doc.fillColor(cPrimary).fontSize(8.5).font('Helvetica-Bold').text(org.name, 48, y + 6);
    doc.fillColor(cAccent).fontSize(7.5).font('Helvetica-Bold').text(org.port, 48, y + 17);
    doc.fillColor(cBody).fontSize(7.5).font('Helvetica').text(org.desc, 48, y + 27, { width: 498, lineGap: 1.5 });
    y += 54;
  });

  // Section 3: Ordering Service & Storage
  y = drawSectionTitle('CONSENSUS & DECENTRALIZED STORAGE', y, '3');
  drawBox(40, y, 252, 58, cLightBg, cBorder);
  doc.fillColor(cPrimary).fontSize(8).font('Helvetica-Bold').text('Raft Crash Fault-Tolerant Ordering', 46, y + 6);
  doc.fillColor(cBody).fontSize(7.3).font('Helvetica').text(
    'Node: orderer.academic.edu:7050\nAlgorithm: Raft Leader-Follower consensus.\nRole: Orders transactions into immutable blocks without energy-wasteful Proof-of-Work mining. Guarantees deterministic, sub-second transaction finality.',
    46, y + 18, { width: 240, lineGap: 2 }
  );

  drawBox(302, y, 253, 58, cLightBg, cBorder);
  doc.fillColor(cPrimary).fontSize(8).font('Helvetica-Bold').text('IPFS Kubo Off-Chain Storage Node', 308, y + 6);
  doc.fillColor(cBody).fontSize(7.3).font('Helvetica').text(
    'Node: ipfs-node (RPC: 5001 | Gateway: 8080)\nAddressing: Content-addressed storage (CID).\nRole: High-resolution PDF documents are pinned to IPFS. Only the immutable CID and SHA-256 fingerprint are anchored onto the ledger.',
    308, y + 18, { width: 240, lineGap: 2 }
  );
  y += 66;

  // Page 1 Footer
  doc.fontSize(7).font('Helvetica').fillColor(cMuted).text('Page 1 of 3 • Academic Blockchain Architecture Runbook', 40, 785, { align: 'center', width: 515 });

  // ==========================================
  // PAGE 2: 4 MODULES & 7-STAGE WORKFLOW
  // ==========================================
  doc.addPage();
  y = drawHeaderBanner(
    'THE 4 CORE MODULES & 7-STAGE APPROVAL WORKFLOW',
    'Cryptographic State Machine & Separation of Duties Across Organizations'
  );

  y = drawSectionTitle('THE 4 CORE ARCHITECTURAL MODULES', y, '4');
  const modules = [
    { title: 'Module 1: Student Registration & Certificate Requests', desc: 'Registers student profiles (Roll No, Name, Dept, Enrollment Year) onto the ledger. Students initiate official certificate issuance requests with degree specializations.' },
    { title: 'Module 2: 7-Stage Multi-Org State Machine Approval Workflow', desc: 'Enforces an immutable progression where each stage requires explicit cryptographic digital signatures from authorized organization roles (Faculty -> HOD -> DAC -> Exam Board -> Dean -> Admin).' },
    { title: 'Module 3: PDF Document Generation & IPFS Pinning', desc: 'Dynamically synthesizes the official tamper-evident certificate PDF with unique Cert ID, uploads bytes to IPFS Kubo node, receives an immutable CID, and calculates the SHA-256 cryptographic digest.' },
    { title: 'Module 4: Hyperledger Fabric Anchoring, Multi-Modal Verification & Revocation', desc: 'Commits the CID and SHA-256 digest to the Fabric state database (CouchDB). Powers instant public verification (by ID, Hash, or PDF file drag-and-drop) and immutable revocation with audit trails.' }
  ];

  modules.forEach(m => {
    drawBox(40, y, 515, 36, cLightBg, cBorder);
    doc.fillColor(cPrimary).fontSize(8.2).font('Helvetica-Bold').text(m.title, 48, y + 6);
    doc.fillColor(cBody).fontSize(7.3).font('Helvetica').text(m.desc, 48, y + 17, { width: 498, lineGap: 1.5 });
    y += 42;
  });

  y = drawSectionTitle('THE 7-STAGE STATE MACHINE WORKFLOW (IN SMART CONTRACT)', y, '5');
  doc.fontSize(7.8).font('Helvetica').fillColor(cBody).text(
    'The smart contract (chaincode/academic-contract) enforces that state transitions must strictly occur in sequential order. No entity can bypass or fast-track an intermediate stage.',
    42, y, { width: 511, lineGap: 2 }
  );
  y += 20;

  const steps = [
    { step: '1', role: 'Student', org: 'Org 1', state: 'SUBMITTED', desc: 'Student applies for degree certificate with academic credentials.' },
    { step: '2', role: 'Faculty Advisor', org: 'Org 1', state: 'FACULTY_APPROVED', desc: 'Validates coursework completion, laboratory attendance, and minimum credits.' },
    { step: '3', role: 'Head of Dept (HOD)', org: 'Org 1', state: 'HOD_APPROVED', desc: 'Departmental validation and recommendation for degree conferment.' },
    { step: '4', role: 'DAC Committee', org: 'Org 1', state: 'DAC_APPROVED', desc: 'Department Academic Committee curriculum compliance audit.' },
    { step: '5', role: 'Exam Controller', org: 'Org 2', state: 'EXAM_LOCKED', desc: 'Official examination board grade validation and cryptographic grade freeze.' },
    { step: '6', role: 'Dean Academics', org: 'Org 3', state: 'DEAN_APPROVED', desc: 'Executive academic clearance sanctioned by university administration.' },
    { step: '7', role: 'Registrar Admin', org: 'Org 3', state: 'ADMIN_FINALIZED', desc: 'Final administrative sign-off; authorizes PDF synthesis and ledger issuance.' }
  ];

  steps.forEach(s => {
    drawBox(40, y, 515, 27, cLightBg, cBorder);
    doc.fillColor(cAccent).fontSize(8).font('Helvetica-Bold').text(`Stage ${s.step}:`, 46, y + 5);
    doc.fillColor(cPrimary).fontSize(8).font('Helvetica-Bold').text(s.state, 86, y + 5);
    doc.fillColor(cSuccess).fontSize(7.5).font('Helvetica-Bold').text(`[${s.org} - ${s.role}]`, 215, y + 5);
    doc.fillColor(cBody).fontSize(7.2).font('Helvetica').text(s.desc, 46, y + 16, { width: 500 });
    y += 31;
  });

  y = drawSectionTitle('MULTI-MODAL VERIFICATION ARCHITECTURE', y, '6');
  drawBox(40, y, 515, 48, cLightBg, cBorder);
  doc.fillColor(cPrimary).fontSize(8).font('Helvetica-Bold').text('3 Ways Any Employer or Verifier Can Authenticate a Certificate in Sub-Seconds:', 46, y + 6);
  doc.fillColor(cBody).fontSize(7.5).font('Helvetica')
     .text('1. Verification by Certificate ID: Queries peer CouchDB ledger directly and returns issuer, student, and CID metadata.', 46, y + 17)
     .text('2. Verification by SHA-256 Digest: Queries reverse hash index to verify whether a digital signature exists on-chain.', 46, y + 27)
     .text('3. Verification by File Upload: Recomputes SHA-256 from uploaded PDF buffer and checks ledger match (detects any tampering).', 46, y + 37);
  y += 56;

  // Page 2 Footer
  doc.fontSize(7).font('Helvetica').fillColor(cMuted).text('Page 2 of 3 • Academic Blockchain Architecture Runbook', 40, 785, { align: 'center', width: 515 });

  // ==========================================
  // PAGE 3: PROFESSOR DEFENSE Q&A & SYSTEM TOPOLOGY
  // ==========================================
  doc.addPage();
  y = drawHeaderBanner(
    'PROFESSOR DEFENSE Q&A & SYSTEM TOPOLOGY',
    'Technical Explanations, Trade-Off Analyses & Defense Answers'
  );

  y = drawSectionTitle('TOP 8 PROFESSOR DEFENSE QUESTIONS & ANSWERS', y, '7');

  const qas = [
    {
      q: 'Q1: Why Hyperledger Fabric instead of a public blockchain like Ethereum or Bitcoin?',
      a: 'Academic records require strict student privacy (FERPA/GDPR compliance) and high throughput with zero gas transaction fees. Fabric provides a permissioned, consortium architecture where only authorized universities and exam boards validate transactions, offering deterministic sub-second finality via Raft consensus.'
    },
    {
      q: 'Q2: Why not store the entire PDF certificate directly inside the blockchain ledger?',
      a: 'Storing large binary files directly on-chain causes severe "ledger bloat" and degrades peer replication speed. Best practice uses decentralized off-chain storage: the PDF is stored in IPFS Kubo, while only the 46-character IPFS CID and 64-character SHA-256 hash are anchored immutably on the Fabric ledger.'
    },
    {
      q: 'Q3: How does the system detect if a student alters their grade or name on the PDF certificate?',
      a: 'The verification portal computes the SHA-256 cryptographic checksum of the uploaded file. Because cryptographic hash functions have the avalanche effect, modifying even a single character or pixel changes the entire 256-bit digest, resulting in an immediate "INVALID / TAMPERED" status against the ledger record.'
    },
    {
      q: 'Q4: If the blockchain is immutable, how can a certificate be revoked?',
      a: 'Hyperledger Fabric maintains a complete immutable history of state changes. When RevokeCertificate is invoked, the state database marks the record status as "REVOKED" along with the revocation timestamp, officer identity, and cancellation reason. The past issuance is never erased, providing an unalterable audit trail.'
    },
    {
      q: 'Q5: How does the smart contract enforce separation of duties between Org 1 and Org 2?',
      a: 'Fabric uses Membership Service Providers (MSPs). In the chaincode, each method inspects the invoker\'s client identity (ctx.clientIdentity.getMSPID()). For example, LockExamGrades strictly asserts that the caller belongs to Org2MSP. If Org1 or Org3 attempts this call, the smart contract throws an unauthorized error.'
    },
    {
      q: 'Q6: What is CouchDB\'s role versus the raw blockchain block store?',
      a: 'Fabric peers maintain two data stores: (1) The Block Log (append-only ledger of all transaction blocks) and (2) The World State (current state of all assets). CouchDB acts as the state database, allowing rich JSON queries (e.g. querying by studentId or docHash) in addition to primary key lookups.'
    },
    {
      q: 'Q7: How does Raft consensus work in this network?',
      a: 'Raft is a Crash Fault-Tolerant (CFT) ordering service using leader election and log replication. The leader receives transactions endorsed by peers, orders them chronologically into blocks, and broadcasts them to all peers. It tolerates node crashes without the overhead and vulnerability of PoW mining.'
    },
    {
      q: 'Q8: What is an IPFS CID and why is it superior to traditional HTTP URLs?',
      a: 'A CID (Content Identifier) is a cryptographic hash of the file content itself (content-addressed), rather than a location address (location-addressed). If someone alters the file on IPFS, its CID changes completely. Referencing a CID guarantees that the file retrieved is mathematically identical to the file originally issued.'
    }
  ];

  qas.forEach((qa, idx) => {
    drawBox(40, y, 515, 41, cLightBg, cBorder);
    doc.fillColor(cPrimary).fontSize(7.5).font('Helvetica-Bold').text(qa.q, 46, y + 4, { width: 503 });
    doc.fillColor(cBody).fontSize(6.8).font('Helvetica').text(qa.a, 46, y + 15, { width: 503, lineGap: 1.2 });
    y += 44;
  });

  y = drawSectionTitle('RUNTIME INFRASTRUCTURE & PORT TOPOLOGY', y, '8');
  drawBox(40, y, 515, 36, cLightBg, cBorder);
  doc.fontSize(7).font('Helvetica').fillColor(cBody)
     .text('• Web Verification Portal:  http://localhost:3000 (React 18 + Vite SPA with internal reverse proxy)', 46, y + 5)
     .text('• Backend REST API:         http://localhost:4000/api (Node.js Express + Fabric Gateway SDK + IPFS Client)', 46, y + 14)
     .text('• IPFS Smart Gateway:       http://localhost:8080 (Interactive Dashboard & /ipfs/<CID> Direct Content Resolver)', 46, y + 23);
  y += 42;

  // Page 3 Footer
  doc.fontSize(7).font('Helvetica').fillColor(cMuted).text('Page 3 of 3 • Academic Blockchain Architecture Runbook', 40, 785, { align: 'center', width: 515 });

  doc.end();
}

const targetPath = process.argv[2] || '/tmp/Academic_Blockchain_Professor_Defense_Guide.pdf';
console.log(`Generating Defense Guide PDF at: ${targetPath}`);
generateDefenseGuidePDF(targetPath);
console.log('PDF generation initiated successfully.');
