'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { generateCertificatePDF } = require('./pdf');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calculateSHA256, uploadToIPFS, fetchFromIPFS, checkIPFSHealth } = require('./ipfs');
const { invokeChaincode, queryChaincode, checkNetworkHealth } = require('./fabric');
const orchestrator = require('./agents/orchestrator');
const { runOrg1DepartmentPipeline } = require('./agents/orgAgents');
const fraudAgent = require('./agents/fraudAgent');
const chatAgent = require('./agents/chatAgent');
const hfClient = require('./agents/hfAgentClient');
const { evaluatePrerequisites, getDegreeRequirements, calculateAcademicStanding, verifyStudentRequestSignature } = require('./rules/prerequisites');
const { validateStudentInput, validateRequestInput } = require('./validators/schemaValidator');

const app = express();
const PORT = process.env.PORT || 4000;

const STORAGE_DIR = path.join(__dirname, '../storage/certificates');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 1. Health & Status
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    const network = await checkNetworkHealth();
    const ipfs = await checkIPFSHealth();
    res.json({
      status: network.allHealthy ? 'UP' : 'PARTIAL',
      network,
      ipfs,
      organizations: [
        { name: 'Org1 - University / Academic', msp: 'Org1MSP', peer: 'peer0.org1.academic.edu:7051' },
        { name: 'Org2 - Examination Board', msp: 'Org2MSP', peer: 'peer0.org2.academic.edu:8051' },
        { name: 'Org3 - Administration & Verifier', msp: 'Org3MSP', peer: 'peer0.org3.academic.edu:9051' }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Module 1: Student Registration & Profile Management
// Contributor 1.1: Academic Chaincode Lead
// ==========================================
app.post('/api/students', async (req, res) => {
  try {
    const { studentId, name, email, department, enrollmentYear } = req.body;

    // Rich Schema Validation
    const validation = validateStudentInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Student schema validation failed',
        details: validation.errors
      });
    }

    // Construct enriched academic profile for on-chain identity lifecycle
    const academicProfile = {
      cgpa: req.body.cgpa !== undefined ? Number(req.body.cgpa) : (req.body.academicRecord?.cgpa ?? 8.5),
      totalCredits: req.body.totalCredits !== undefined ? Number(req.body.totalCredits) : (req.body.academicRecord?.totalCredits ?? 160),
      requiredCredits: req.body.requiredCredits !== undefined ? Number(req.body.requiredCredits) : (req.body.academicRecord?.requiredCredits ?? 160),
      attendance: req.body.attendance !== undefined ? Number(req.body.attendance) : (req.body.academicRecord?.attendance ?? 88.0),
      backlogs: req.body.backlogs !== undefined ? Number(req.body.backlogs) : (req.body.academicRecord?.backlogs ?? 0),
      completedCourses: req.body.completedCourses || req.body.academicRecord?.completedCourses || ['CS101', 'CS102', 'CS201', 'CS202'],
      prerequisitesMet: req.body.prerequisitesMet !== undefined ? Boolean(req.body.prerequisitesMet) : true
    };

    if (req.body.publicKeyPem || req.body.publicKey) {
      academicProfile.publicKeyPem = req.body.publicKeyPem || req.body.publicKey;
    }

    const result = await invokeChaincode('RegisterStudent', [
      studentId.trim(),
      name.trim(),
      email.trim(),
      department || 'Computer Science & Engineering',
      enrollmentYear || '2024',
      JSON.stringify(academicProfile)
    ], 1); // Org 1: Academic Department

    res.status(201).json({ success: true, studentId: studentId.trim(), result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id/academic-record', async (req, res) => {
  try {
    const studentId = req.params.id;
    const result = await invokeChaincode('UpdateStudentAcademicRecord', [
      studentId,
      JSON.stringify(req.body)
    ], 1); // Org 1
    res.json({ success: true, studentId, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/students/:id/status', async (req, res) => {
  try {
    const studentId = req.params.id;
    const { status, reason } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required (ACTIVE, SUSPENDED, GRADUATED, WITHDRAWN)' });
    }
    const result = await invokeChaincode('UpdateStudentStatus', [
      studentId,
      status,
      reason || 'Status updated by academic administrator'
    ], 1); // Org 1
    res.json({ success: true, studentId, status, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id/eligibility', async (req, res) => {
  try {
    const studentBytes = await queryChaincode('GetStudent', [req.params.id]);
    if (!studentBytes) {
      return res.status(404).json({ error: `Student ${req.params.id} not found` });
    }
    const studentObj = typeof studentBytes === 'string' ? JSON.parse(studentBytes) : studentBytes;
    const certType = req.query.certType || 'Bachelor of Technology in CSE';
    const evaluation = evaluatePrerequisites(studentObj, certType, req.query);
    res.json({ studentId: req.params.id, certType, ...evaluation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const student = await queryChaincode('GetStudent', [req.params.id]);
    res.json(student);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await queryChaincode('GetAllStudents', []);
    res.json(students || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Contributor 1.1: Student Cryptographic Keypair & Digital Signature Services
// ==========================================
app.post('/api/students/generate-keypair', (req, res) => {
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const pubKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    const pubKeyHex = pubKeyDer.toString('hex');
    const sha256Fingerprint = crypto.createHash('sha256').update(pubKeyDer).digest('hex');

    res.json({
      curve: 'ECDSA prime256v1 (NIST P-256)',
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      publicKeyHex: pubKeyHex,
      sha256Fingerprint
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students/sign-payload', (req, res) => {
  try {
    const { privateKeyPem, studentId, requestId, certType, timestamp } = req.body;
    if (!privateKeyPem || !studentId || !requestId || !certType) {
      return res.status(400).json({ error: 'privateKeyPem, studentId, requestId, and certType are required' });
    }

    const canonicalPayload = `${String(studentId).trim()}:${String(requestId).trim()}:${String(certType).trim()}:${timestamp || ''}`;
    const signer = crypto.createSign('SHA256');
    signer.update(canonicalPayload);
    signer.end();
    const signatureBase64 = signer.sign(privateKeyPem, 'base64');

    res.json({
      canonicalPayload,
      signatureBase64,
      algorithm: 'SHA256withECDSA',
      timestamp: timestamp || new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: `Signing failed: ${err.message}` });
  }
});

// Cryptographic Consortium & MSP Key Inventory
app.get('/api/keys/summary', (req, res) => {
  try {
    const summaryPaths = [
      path.join(__dirname, '../storage/keys/keys_summary.json'),
      path.join(__dirname, '../../keys/keys_summary.json')
    ];
    let foundPath = summaryPaths.find(p => fs.existsSync(p));
    if (foundPath) {
      const summary = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
      return res.json(summary);
    }

    res.status(404).json({ error: 'Key summary not found. Run scripts/export_and_generate_keys.js' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/keys/file/:folder/:filename', (req, res) => {
  try {
    const { folder, filename } = req.params;
    // Security sanitization
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');

    const candidates = [
      path.join(__dirname, '../storage/keys', safeFolder, safeFilename),
      path.join(__dirname, '../../keys', safeFolder, safeFilename)
    ];

    const match = candidates.find(p => fs.existsSync(p));
    if (!match) {
      return res.status(404).json({ error: `Key file not found: ${safeFolder}/${safeFilename}` });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.send(fs.readFileSync(match, 'utf8'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contributor 1.2 & 1.3: Group 1 Department Autonomous Pipeline (Stages 1-3)
app.post('/api/agents/org1-department-audit', async (req, res) => {
  try {
    const { requestId, details } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }
    const result = await runOrg1DepartmentPipeline(requestId, details || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Module 2: Certificate Request & Approval Workflow
// Contributor 1.1: Academic Chaincode Lead (Prerequisite Validation & Request Submission)
// ==========================================

// Pre-flight prerequisite verification endpoint
app.post('/api/requests/validate-prerequisites', async (req, res) => {
  try {
    const { studentId, certType, details } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    let studentObj = {};
    try {
      const studentBytes = await queryChaincode('GetStudent', [studentId]);
      if (studentBytes) {
        studentObj = typeof studentBytes === 'string' ? JSON.parse(studentBytes) : studentBytes;
      }
    } catch (e) {
      // If student not yet registered, evaluate with submitted metrics
    }

    const evaluation = evaluatePrerequisites(studentObj, certType || 'Degree Certificate', details || {});
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const { requestId, studentId, certType, details, bypassPrerequisites } = req.body;

    // 1. Rich Schema Validation
    const validation = validateRequestInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Request schema validation failed',
        details: validation.errors
      });
    }

    let requestDetails = details || {};
    if (typeof requestDetails === 'string') {
      try {
        requestDetails = JSON.parse(requestDetails);
      } catch (e) {
        requestDetails = { raw: requestDetails };
      }
    }

    // 2. Fetch on-chain student identity & verify active lifecycle status
    let studentObj = null;
    try {
      const studentBytes = await queryChaincode('GetStudent', [studentId]);
      if (studentBytes) {
        studentObj = typeof studentBytes === 'string' ? JSON.parse(studentBytes) : studentBytes;
      }
    } catch (e) {
      console.warn(`[Request Creation] Student lookup note: ${e.message}`);
    }

    if (studentObj) {
      // Verify student lifecycle status
      if (studentObj.status && studentObj.status !== 'ACTIVE') {
        return res.status(400).json({
          error: `Cannot request certificate: Student '${studentId}' status is '${studentObj.status}'. Only ACTIVE students may apply.`
        });
      }

      // Auto-enrich details with registered student metadata if missing
      requestDetails.name = requestDetails.name || studentObj.name;
      requestDetails.department = requestDetails.department || studentObj.department;
      requestDetails.email = requestDetails.email || studentObj.email;
    }

    // 3. Departmental Prerequisite Rules Verification
    const targetCertType = certType || 'Master of Computer Applications (MCA)';
    const evaluation = evaluatePrerequisites(studentObj || {}, targetCertType, requestDetails);

    // If prerequisites fail and no bypass was requested, reject with HTTP 422 Unprocessable Entity
    if (!evaluation.eligible && !bypassPrerequisites) {
      return res.status(422).json({
        error: 'Departmental prerequisite validation failed',
        violations: evaluation.violations,
        criteria: evaluation.evaluatedCriteria,
        requirements: evaluation.requirements
      });
    }

    // Embed evaluated prerequisite compliance audit into details for downstream autonomous agents
    requestDetails.prerequisiteCheck = {
      verified: evaluation.eligible,
      criteria: evaluation.evaluatedCriteria,
      evaluatedAt: evaluation.evaluatedAt
    };

    if (req.body.studentSignature) {
      requestDetails.studentSignature = req.body.studentSignature;
    }
    if (req.body.signatureTimestamp) {
      requestDetails.signatureTimestamp = req.body.signatureTimestamp;
    }
    if (req.body.requireSignature) {
      requestDetails.requireSignature = req.body.requireSignature;
    }

    const result = await invokeChaincode('RequestCertificate', [
      requestId.trim(),
      studentId.trim(),
      targetCertType,
      JSON.stringify(requestDetails)
    ], 1); // Org 1: Academic Department

    res.status(201).json({
      success: true,
      requestId: requestId.trim(),
      studentId: studentId.trim(),
      prerequisitesVerified: evaluation.eligible,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const request = await queryChaincode('GetCertificateRequest', [req.params.id]);
    res.json(request);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/requests', async (req, res) => {
  try {
    const requests = await queryChaincode('GetAllRequests', []);
    res.json(requests || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7-Stage Workflow Step Transitions
app.post('/api/workflow/faculty-approve', async (req, res) => {
  try {
    const { requestId, facultyId, comments } = req.body;
    const result = await invokeChaincode('ApproveFaculty', [requestId, facultyId || 'Faculty-01', comments || 'Faculty approval granted'], 1);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/hod-approve', async (req, res) => {
  try {
    const { requestId, hodId, comments } = req.body;
    const result = await invokeChaincode('ApproveHOD', [requestId, hodId || 'HOD-CSE', comments || 'HOD verified and approved'], 1);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/dac-approve', async (req, res) => {
  try {
    const { requestId, dacMemberId, comments } = req.body;
    const result = await invokeChaincode('ApproveDAC', [requestId, dacMemberId || 'DAC-Chair', comments || 'DAC curriculum compliance confirmed'], 1);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/exam-lock', async (req, res) => {
  try {
    const { requestId, examOfficerId, gradesHash, comments } = req.body;
    const result = await invokeChaincode('LockExamGrades', [
      requestId,
      examOfficerId || 'ExamController-01',
      gradesHash || 'GRADES_SHA256_' + Date.now(),
      comments || 'Grades verified against registry and locked'
    ], 2); // Executed by Org 2 (Exam Authority)
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/dean-approve', async (req, res) => {
  try {
    const { requestId, deanId, comments } = req.body;
    const result = await invokeChaincode('ApproveDean', [requestId, deanId || 'Dean-Academics', comments || 'Dean academic clearance sanctioned'], 3); // Org 3
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/admin-finalize', async (req, res) => {
  try {
    const { requestId, adminId, comments } = req.body;
    const result = await invokeChaincode('FinalizeAdmin', [requestId, adminId || 'Admin-Registrar', comments || 'Final administrative clearance verified'], 3); // Org 3
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. Module 3 & 4: PDF Generation, IPFS Pinning & Fabric Anchoring
// ==========================================
app.post('/api/certificates/issue', async (req, res) => {
  try {
    const { certId, requestId, studentId, certType, studentName, department } = req.body;
    if (!certId || !studentId) {
      return res.status(400).json({ error: 'certId and studentId are required' });
    }

    let resolvedStudentName = (studentName && studentName !== 'Academic Student' && studentName !== 'Student Name') ? studentName : null;
    let resolvedDepartment = (department && department !== 'General') ? department : null;
    let resolvedCertType = certType;

    // 1. Automatically resolve student name and department from ledger registration
    try {
      const studentBytes = await queryChaincode('GetStudent', [studentId]);
      if (studentBytes) {
        const studentObj = typeof studentBytes === 'string' ? JSON.parse(studentBytes) : studentBytes;
        if (studentObj && studentObj.name) {
          resolvedStudentName = studentObj.name;
          if (studentObj.department) {
            resolvedDepartment = studentObj.department;
          }
        }
      }
    } catch (e) {
      console.warn(`[Student Lookup] Could not fetch student ${studentId}: ${e.message}`);
    }

    // 2. If still missing, check request details on ledger
    if ((!resolvedStudentName || !resolvedCertType) && requestId) {
      try {
        const reqBytes = await queryChaincode('GetCertificateRequest', [requestId]);
        if (reqBytes) {
          const reqObj = typeof reqBytes === 'string' ? JSON.parse(reqBytes) : reqBytes;
          if (!resolvedStudentName && reqObj?.details?.name) {
            resolvedStudentName = reqObj.details.name;
          }
          if (!resolvedDepartment && reqObj?.details?.department) {
            resolvedDepartment = reqObj.details.department;
          }
          if (!resolvedCertType && reqObj?.certType) {
            resolvedCertType = reqObj.certType;
          }
        }
      } catch (e) {
        console.warn(`[Request Lookup] Could not fetch request ${requestId}: ${e.message}`);
      }
    }

    if (!resolvedStudentName) {
      resolvedStudentName = 'Student Name';
    }

    const issueDate = new Date().toISOString().substring(0, 10);
    const createdAt = new Date().toISOString();

    // 1. Generate PDF Document with NIT Warangal branding & student details
    const pdfBuffer = await generateCertificatePDF({
      certId,
      requestId,
      studentId,
      studentName: resolvedStudentName,
      department: resolvedDepartment || 'Computer Science & Engineering',
      certType: resolvedCertType || 'Master of Computer Applications (MCA)',
      issueDate,
      createdAt
    });

    // Save exact issued PDF to local certificate storage
    fs.writeFileSync(path.join(STORAGE_DIR, `${certId}.pdf`), pdfBuffer);

    // 2. Upload to IPFS & calculate SHA-256
    const ipfsResult = await uploadToIPFS(pdfBuffer, `${certId}.pdf`);

    // 3. Anchor on Hyperledger Fabric Ledger
    const chaincodeResult = await invokeChaincode('IssueCertificate', [
      certId,
      requestId || '',
      studentId,
      certType || 'Degree Certificate',
      ipfsResult.cid,
      ipfsResult.sha256,
      issueDate
    ], 3); // Anchored by Org 3

    res.status(201).json({
      success: true,
      certId,
      ipfsCid: ipfsResult.cid,
      sha256Hash: ipfsResult.sha256,
      gatewayUrl: ipfsResult.gatewayUrl,
      chaincodeResult
    });
  } catch (err) {
    console.error('Error issuing certificate:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download Generated PDF (exact original bytes)
app.get('/api/certificates/:id/pdf', async (req, res) => {
  try {
    const localFilePath = path.join(STORAGE_DIR, `${req.params.id}.pdf`);
    if (fs.existsSync(localFilePath)) {
      const pdfBuffer = fs.readFileSync(localFilePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${req.params.id}.pdf"`);
      return res.send(pdfBuffer);
    }

    const cert = await queryChaincode('VerifyCertificate', [req.params.id]);
    if (!cert || !cert.certificate) {
      return res.status(404).send('Certificate not found');
    }

    if (cert.certificate.ipfsHash) {
      try {
        const ipfsBuffer = await fetchFromIPFS(cert.certificate.ipfsHash);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${req.params.id}.pdf"`);
        return res.send(ipfsBuffer);
      } catch (e) {
        console.warn(`[IPFS] Could not fetch ${cert.certificate.ipfsHash}: ${e.message}`);
      }
    }

    const pdfBuffer = await generateCertificatePDF(cert.certificate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==========================================
// 5. Verification Portal (By ID, By Hash, By File)
// ==========================================
app.get('/api/verify/id/:certId', async (req, res) => {
  try {
    const result = await queryChaincode('VerifyCertificate', [req.params.certId]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/verify/hash/:hash', async (req, res) => {
  try {
    const result = await queryChaincode('VerifyCertificateByHash', [req.params.hash]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify/file', upload.single('certificate'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No certificate file uploaded' });
    }

    const calculatedHash = calculateSHA256(req.file.buffer);
    const result = await queryChaincode('VerifyCertificateByHash', [calculatedHash]);

    res.json({
      uploadedFile: req.file.originalname,
      calculatedHash,
      verification: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke Certificate
app.post('/api/certificates/revoke', async (req, res) => {
  try {
    const { certId, reason, revokedBy } = req.body;
    if (!certId) {
      return res.status(400).json({ error: 'certId is required' });
    }

    const result = await invokeChaincode('RevokeCertificate', [
      certId,
      reason || 'Administrative revocation',
      revokedBy || 'Dean-Registrar'
    ], 3);

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/certificates', async (req, res) => {
  try {
    const certs = await queryChaincode('GetAllCertificates', []);
    res.json(certs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. Autonomous Agentic AI Workflow & Orchestration
// ==========================================

// Master 1-Click Autonomous Multi-Agent Approval & Issuance Pipeline
app.post('/api/agents/orchestrate', async (req, res) => {
  try {
    const { requestId, autoIssue, certId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required for agentic orchestration' });
    }

    const result = await orchestrator.runAutonomousPipeline(requestId, { autoIssue, certId });
    res.json(result);
  } catch (err) {
    console.error('Error running agentic pipeline:', err);
    res.status(500).json({ error: err.message });
  }
});

// Multi-Agent Pre-Flight Audit & Readiness Check
app.get('/api/agents/audit/:requestId', async (req, res) => {
  try {
    const result = await orchestrator.auditRequest(req.params.requestId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Intelligent Fraud & Anomaly Scoring Scanner
app.post('/api/agents/fraud-scan', async (req, res) => {
  try {
    const result = await fraudAgent.evaluateRisk(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conversational AI Assistant & Ledger Oracle
app.post('/api/agents/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const response = await chatAgent.processMessage(message);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hugging Face AI Model & API Configuration
app.get('/api/agents/config', (req, res) => {
  const currentKey = hfClient.getApiKey();
  res.json({
    configured: Boolean(currentKey && currentKey.length > 5),
    maskedKey: currentKey ? `${currentKey.substring(0, 6)}...${currentKey.slice(-4)}` : 'NOT_CONFIGURED',
    model: hfClient.defaultModel,
    provider: 'Hugging Face Serverless Inference API / Router'
  });
});

app.post('/api/agents/config', (req, res) => {
  const { hfToken, model } = req.body;
  if (hfToken !== undefined) {
    hfClient.setApiKey(hfToken);
  }
  if (model) {
    hfClient.defaultModel = model;
  }
  res.json({
    success: true,
    message: 'Hugging Face AI Agent client configured successfully',
    configured: Boolean(hfClient.getApiKey()),
    model: hfClient.defaultModel
  });
});

// Agent System & Diagnostic Telemetry
app.get('/api/agents/health', async (req, res) => {
  try {
    const network = await checkNetworkHealth();
    const ipfs = await checkIPFSHealth();
    res.json({
      status: 'UP',
      agents: [
        { name: 'FacultyAgent', org: 'Org1MSP', role: 'Coursework & Attendance Verification', status: 'ACTIVE' },
        { name: 'HODAgent', org: 'Org1MSP', role: 'Departmental Credit & Curriculum Audit', status: 'ACTIVE' },
        { name: 'DACAgent', org: 'Org1MSP', role: 'Academic Committee & Capstone Evaluation', status: 'ACTIVE' },
        { name: 'ExamLockAgent', org: 'Org2MSP', role: 'Grade Lockdown & SHA-256 Merkle Digest', status: 'ACTIVE' },
        { name: 'DeanAgent', org: 'Org3MSP', role: 'Institutional Compliance & Executive Sanction', status: 'ACTIVE' },
        { name: 'AdminFinalizeAgent', org: 'Org3MSP', role: 'Clearance Verification & Authorization', status: 'ACTIVE' },
        { name: 'FraudDetectionAgent', org: 'Consortium', role: '0-100 Anomaly & Invariant Risk Scoring', status: 'ACTIVE' },
        { name: 'ChatbotAgent', org: 'Consortium', role: 'Natural Language Ledger Oracle', status: 'ACTIVE' },
        { name: 'MasterOrchestrator', org: 'Consortium', role: 'Cross-Org 1-Click Pipeline Coordinator', status: 'ACTIVE' }
      ],
      network,
      ipfs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🎓 Academic Blockchain REST API running on port ${PORT}`);
  console.log(`Consortium: Org1 (Academic), Org2 (Exam), Org3 (Admin)`);
  console.log(`🤖 Multi-Agent Autonomous AI Engine Loaded & Active`);
  console.log(`=================================================`);
});
