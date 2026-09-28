'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { generateCertificatePDF } = require('./pdf');
const fs = require('fs');
const path = require('path');
const { calculateSHA256, uploadToIPFS, fetchFromIPFS, checkIPFSHealth } = require('./ipfs');
const { invokeChaincode, queryChaincode, checkNetworkHealth } = require('./fabric');

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`🎓 Academic Blockchain REST API running on port ${PORT}`);
  console.log(`Consortium: Org1 (Academic), Org2 (Exam), Org3 (Admin)`);
  console.log(`=================================================`);
});
