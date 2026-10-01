'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { generateCertificatePDF } = require('./pdf');
const fs = require('fs');
const path = require('path');
const { calculateSHA256, uploadToIPFS, fetchFromIPFS, checkIPFSHealth } = require('./ipfs');
const { invokeChaincode, queryChaincode, checkNetworkHealth, invokeOrg1Transaction, queryOrg1Ledger } = require('./fabric');
const orchestrator = require('./agents/orchestrator');
const fraudAgent = require('./agents/fraudAgent');
const chatAgent = require('./agents/chatAgent');
const hfClient = require('./agents/hfAgentClient');
const { Org1AcademicAgent } = require('./agents/orgAgents');

const org1AcademicAgent = new Org1AcademicAgent();


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
// 2. Module 1: Student Registration
// ==========================================
app.post('/api/students', async (req, res) => {
  try {
    const { studentId, name, email, department, enrollmentYear } = req.body;
    if (!studentId || !name || !email) {
      return res.status(400).json({ error: 'studentId, name, and email are required' });
    }

    const result = await invokeChaincode('RegisterStudent', [studentId, name, email, department || 'Computer Science', enrollmentYear || '2024'], 1);
    res.status(201).json({ success: true, result });
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
// 3. Module 2: Certificate Request & Approval Workflow
// ==========================================
app.post('/api/requests', async (req, res) => {
  try {
    const { requestId, studentId, certType, details } = req.body;
    if (!requestId || !studentId) {
      return res.status(400).json({ error: 'requestId and studentId are required' });
    }

    let requestDetails = details || {};
    if (typeof requestDetails === 'string') {
      try {
        requestDetails = JSON.parse(requestDetails);
      } catch (e) {
        requestDetails = { raw: requestDetails };
      }
    }

    // Auto-enrich details with registered student data if missing
    try {
      const studentBytes = await queryChaincode('GetStudent', [studentId]);
      if (studentBytes) {
        const studentObj = typeof studentBytes === 'string' ? JSON.parse(studentBytes) : studentBytes;
        if (studentObj) {
          requestDetails.name = requestDetails.name || studentObj.name;
          requestDetails.department = requestDetails.department || studentObj.department;
          requestDetails.email = requestDetails.email || studentObj.email;
        }
      }
    } catch (e) {
      console.warn(`[Request Creation] Student lookup note: ${e.message}`);
    }

    const result = await invokeChaincode('RequestCertificate', [
      requestId,
      studentId,
      certType || 'Master of Computer Applications (MCA)',
      JSON.stringify(requestDetails)
    ], 1);

    res.status(201).json({ success: true, result });
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

// ==========================================
// 6.1 Org 1 Autonomous Academic Department Agent Routes
// Contributor 1.3: Org 1 Academic Agent Lead
// ==========================================

// POST /api/agents/org1/audit/:requestId
// Evaluates attendance (>=75%), CIE marks (>=20/50), prerequisites, credits, and DAC capstone rubric
app.post('/api/agents/org1/audit/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const auditReport = await org1AcademicAgent.auditRequest(requestId, req.body || {});
    res.json(auditReport);
  } catch (err) {
    console.error(`[Org1 Agent] Error auditing request ${req.params.requestId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/org1/audit/:requestId (Convenience alias)
app.get('/api/agents/org1/audit/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const auditReport = await org1AcademicAgent.auditRequest(requestId, {});
    res.json(auditReport);
  } catch (err) {
    console.error(`[Org1 Agent] Error auditing request ${req.params.requestId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/org1/auto-approve/:requestId
// Runs the autonomous audit and, if passed, sequentially submits on-chain approvals for Faculty, HOD, and DAC via Org1MSP
app.post('/api/agents/org1/auto-approve/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await org1AcademicAgent.autoApprove(requestId, req.body || {});
    if (!result.success) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error(`[Org1 Agent] Error in auto-approval for ${req.params.requestId}:`, err);
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
        { name: 'Org1AcademicAgent', org: 'Org1MSP', role: 'Autonomous Academic Department Lead & Stages 1-3 Coordinator', status: 'ACTIVE' },
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
