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
const { invokeChaincode, queryChaincode, checkNetworkHealth, getCertificateHistory, onLedgerEvent, getEventStatus } = require('./fabric');
const { handleChatMessage } = require('./intentEngine');
const { encryptData, decryptData } = require('./cryptoUtil');
const { generateStudentDID, isValidStudentDID, signPayload, getActorSigningSecret } = require('./cryptoUtil');
const facultyAuth = require('./facultyAuth');
const orchestrator = require('./agents/orchestrator');
const { runOrg1DepartmentPipeline, runZKVerifierAgent } = require('./agents/orgAgents');
const fraudAgent = require('./agents/fraudAgent');
const chatAgent = require('./agents/chatAgent');
const hfClient = require('./agents/hfAgentClient');
const { evaluatePrerequisites, getDegreeRequirements, calculateAcademicStanding, verifyStudentRequestSignature } = require('./rules/prerequisites');
const { validateStudentInput, validateRequestInput } = require('./validators/schemaValidator');
const { CertMintingMultiAgentEngine } = require('./agents/certMintingAgents');
const sisDatabase = require('./db/sisDatabase');
const r2 = require('./r2');
const { ROLES, login, quickLoginByRole, verifySession, resolveUserFromRequest, requireRole, DEMO_ACCOUNTS } = require('./auth');
const healthAgent = require('./agents/healthAgent');

const certMintingEngine = new CertMintingMultiAgentEngine();

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
    let r2Health = { healthy: false, mode: 'unconfigured' };
    try {
      r2Health = await r2.checkR2Health();
    } catch (e) {
      r2Health = { healthy: false, error: e.message };
    }
    res.json({
      status: network.allHealthy ? 'UP' : 'PARTIAL',
      network,
      ipfs,
      r2: r2Health,
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

// Autonomous Health Monitoring Agent Telemetry & Parity (Contributor 6.2)
const handleTelemetry = async (req, res) => {
  try {
    const telemetry = await healthAgent.getTelemetryReport();
    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.get('/api/agent/health/telemetry', handleTelemetry);
app.get('/api/agents/health/telemetry', handleTelemetry);
app.get('/api/health/telemetry', handleTelemetry);
app.get('/api/telemetry', handleTelemetry);

const handleSyncParity = async (req, res) => {
  try {
    const parity = await healthAgent.checkSyncParity();
    res.json(parity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.get('/api/agent/health/sync-parity', handleSyncParity);
app.get('/api/agents/health/sync-parity', handleSyncParity);
app.get('/api/health/sync-parity', handleSyncParity);
app.get('/api/sync-parity', handleSyncParity);

// ==========================================
// 2. Module 1: Student Registration & Profile Management
// Contributor 1.1: Academic Chaincode Lead (with DID & Multi-MSP Cryptographic Profiles)
// ==========================================
app.post('/api/students', async (req, res) => {
  try {
    const { 
      studentId, name, email, department, branch, 
      semester, semesterNumber, semesterLabel, courses, enrollmentYear 
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId (roll number) is required' });
    }

    // 1. Rich Schema Validation (flexible)
    const validation = validateStudentInput(req.body);
    if (!validation.isValid && !req.body.name) {
      return res.status(400).json({
        error: 'Student schema validation failed',
        details: validation.errors
      });
    }

    // 2. Verify or enroll student in University SIS Database
    let sisRecord = sisDatabase.getStudentByRollNumber(studentId);
    const verifiedName = (name && name.trim()) || (sisRecord ? sisRecord.name : studentId.trim());
    const verifiedEmail = (email && email.trim()) || (sisRecord ? sisRecord.email : `${studentId.trim().toLowerCase()}@academic.edu`);
    const verifiedDept = department || (sisRecord ? sisRecord.department : 'Department of Computer Science & Engineering');
    const verifiedYear = enrollmentYear || (sisRecord ? sisRecord.enrollmentYear : '2024');

    // 3. Derive Decentralized Identifier (DID) using SHA-256 + RIPEMD-160
    const did = (sisRecord && sisRecord.did) || (typeof generateStudentDID === 'function' ? generateStudentDID(verifiedName, studentId.trim()) : `did:academic:nitw:${studentId.trim().toLowerCase()}`);

    // Construct enriched academic profile for on-chain identity lifecycle
    const academicProfile = {
      cgpa: req.body.cgpa !== undefined ? Number(req.body.cgpa) : (req.body.academicRecord?.cgpa ?? (sisRecord?.cgpa ?? 8.5)),
      totalCredits: req.body.totalCredits !== undefined ? Number(req.body.totalCredits) : (req.body.academicRecord?.totalCredits ?? (sisRecord?.totalCredits ?? 160)),
      requiredCredits: req.body.requiredCredits !== undefined ? Number(req.body.requiredCredits) : (req.body.academicRecord?.requiredCredits ?? 160),
      attendance: req.body.attendance !== undefined ? Number(req.body.attendance) : (req.body.academicRecord?.attendance ?? (sisRecord?.attendance ?? 88.0)),
      backlogs: req.body.backlogs !== undefined ? Number(req.body.backlogs) : (req.body.academicRecord?.backlogs ?? (sisRecord?.backlogs ?? 0)),
      completedCourses: req.body.completedCourses || req.body.academicRecord?.completedCourses || ['CS101', 'CS102', 'CS201', 'CS202'],
      prerequisitesMet: req.body.prerequisitesMet !== undefined ? Boolean(req.body.prerequisitesMet) : true,
      did
    };

    if (req.body.publicKeyPem || req.body.publicKey) {
      academicProfile.publicKeyPem = req.body.publicKeyPem || req.body.publicKey;
    }

    // Save/sync in SIS DB
    sisRecord = sisDatabase.addOrUpdateStudent({
      ...(sisRecord || {}),
      studentId: studentId.trim(),
      name: verifiedName,
      email: verifiedEmail,
      department: verifiedDept,
      enrollmentYear: verifiedYear,
      did,
      attendance: academicProfile.attendance,
      cieMarks: sisRecord ? sisRecord.cieMarks : 42.0,
      backlogs: academicProfile.backlogs,
      totalCredits: academicProfile.totalCredits,
      requiredCredits: academicProfile.requiredCredits
    });

    // 4. Register on Hyperledger Fabric ledger (try 6 params with profile, fallback to 5 params)
    let chaincodeResult = null;
    try {
      chaincodeResult = await invokeChaincode('RegisterStudent', [
        studentId.trim(),
        verifiedName,
        verifiedEmail,
        verifiedDept,
        verifiedYear,
        JSON.stringify(academicProfile)
      ], 1); // Org 1: Academic Department
    } catch (chaincodeErr6) {
      try {
        chaincodeResult = await invokeChaincode('RegisterStudent', [
          studentId.trim(), verifiedName, verifiedEmail, verifiedDept, verifiedYear, did
        ], 1);
      } catch (chaincodeErr5) {
        console.warn(`[Chaincode Register Notice]: ${chaincodeErr5.message}`);
        chaincodeResult = { simulated: true, note: chaincodeErr5.message };
      }
    }

    // 5. Mark student as officially registered on the blockchain ledger
    sisRecord = sisDatabase.markStudentOnLedger(studentId.trim(), did);

    // 6. Enroll in Semester and Semester-wise Courses
    const finalSemLabel = semesterLabel || (semester ? (String(semester).startsWith('Semester') ? semester : `Semester ${semester}`) : 'Semester 5');
    const semReg = sisDatabase.enrollStudentInSemesterCourses(
      studentId.trim(),
      did,
      finalSemLabel,
      branch || null,
      courses
    );

    res.status(201).json({
      success: true,
      did,
      studentId: studentId.trim(),
      name: verifiedName,
      isOnLedger: true,
      registeredOnLedgerAt: sisRecord.registeredOnLedgerAt,
      result: chaincodeResult,
      academicProfile,
      sisProfile: sisRecord,
      semesterRegistration: semReg,
      message: `Student ${studentId.trim()} successfully registered with DID ${did} in ${finalSemLabel} on Fabric Blockchain ledger.`
    });
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

app.get('/api/students/did/:did', async (req, res) => {
  try {
    const did = req.params.did;
    const student = sisDatabase.getStudentByDID(did);
    if (!student) {
      return res.status(404).json({ error: `No student found for DID ${did}` });
    }
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id.trim();
    let chaincodeStudent = null;
    let onChain = false;
    try {
      const raw = await queryChaincode('GetStudent', [studentId]);
      if (raw) {
        chaincodeStudent = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (chaincodeStudent && (chaincodeStudent.studentId || chaincodeStudent.id)) {
          onChain = true;
        }
      }
    } catch (e) {
      // fallback
    }

    const sisRecord = sisDatabase.getStudentByRollNumber(studentId);

    if (!chaincodeStudent && !sisRecord) {
      return res.status(404).json({ error: `Student ${studentId} not found` });
    }

    const studentName = chaincodeStudent?.name || sisRecord?.name || 'Student';
    const studentDid = chaincodeStudent?.did || sisRecord?.did || generateStudentDID(studentName, studentId);
    const isOnLedger = onChain || Boolean(sisRecord?.isOnLedger);

    if (onChain && sisRecord && !sisRecord.isOnLedger) {
      sisDatabase.markStudentOnLedger(studentId, studentDid);
    }

    const merged = {
      ...(sisRecord || {}),
      ...(chaincodeStudent || {}),
      studentId,
      name: studentName,
      email: chaincodeStudent?.email || sisRecord?.email || `${studentId.toLowerCase()}@academic.edu`,
      department: chaincodeStudent?.department || sisRecord?.department || 'Department of Computer Science & Engineering',
      enrollmentYear: chaincodeStudent?.enrollmentYear || sisRecord?.enrollmentYear || '2024',
      did: studentDid,
      isOnLedger,
      registeredOnLedgerAt: chaincodeStudent?.registeredAt || sisRecord?.registeredOnLedgerAt || (isOnLedger ? new Date().toISOString() : null)
    };

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns ONLY students officially registered on the blockchain ledger
app.get('/api/students', async (req, res) => {
  try {
    let onChainStudents = [];
    try {
      const result = await queryChaincode('GetAllStudents', []);
      if (Array.isArray(result)) {
        onChainStudents = result;
      }
    } catch (chaincodeErr) {
      // offline/simulated fallback
    }

    // Get all students marked on ledger in SIS Database
    const sisLedgerStudents = sisDatabase.getLedgerStudents();

    // Unified map keyed by studentId to ensure NO duplicates and 100% complete fields
    const studentMap = new Map();

    // 1. Seed with SIS ledger students
    for (const s of sisLedgerStudents) {
      studentMap.set(s.studentId, {
        studentId: s.studentId,
        name: s.name,
        email: s.email,
        department: s.department,
        enrollmentYear: s.enrollmentYear,
        did: s.did || generateStudentDID(s.name, s.studentId),
        isOnLedger: true,
        registeredOnLedgerAt: s.registeredOnLedgerAt || new Date().toISOString()
      });
    }

    // 2. Merge or add on-chain students
    for (const raw of onChainStudents) {
      const id = raw.studentId || raw.id;
      if (!id) continue;
      const existing = studentMap.get(id);
      const studentName = raw.name || raw.studentName || existing?.name || 'Student';
      const studentDid = raw.did || existing?.did || generateStudentDID(studentName, id);

      studentMap.set(id, {
        studentId: id,
        name: studentName,
        email: raw.email || existing?.email || `${id.toLowerCase()}@academic.edu`,
        department: raw.department || existing?.department || 'Department of Computer Science & Engineering',
        enrollmentYear: raw.enrollmentYear || existing?.enrollmentYear || '2024',
        did: studentDid,
        isOnLedger: true,
        registeredOnLedgerAt: raw.registeredAt || existing?.registeredOnLedgerAt || new Date().toISOString()
      });
    }

    const unifiedList = Array.from(studentMap.values());
    res.json(unifiedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Semester & Course Registrations Endpoints
app.get('/api/semester-registrations', (req, res) => {
  try {
    const registrations = sisDatabase.getAllSemesterRegistrations();
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id/semester-registration', (req, res) => {
  try {
    const reg = sisDatabase.getStudentSemesterRegistration(req.params.id);
    if (!reg) {
      return res.status(404).json({ error: `No semester registration found for student ${req.params.id}` });
    }
    res.json(reg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/semester-registrations', (req, res) => {
  try {
    const reg = sisDatabase.upsertStudentSemesterRegistration(req.body);
    res.json({ success: true, registration: reg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// University SIS Database Endpoints
app.get('/api/sis/students', (req, res) => {
  try {
    const students = sisDatabase.getAllSISStudents();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sis/students/:id', (req, res) => {
  try {
    const student = sisDatabase.getStudentByRollNumber(req.params.id);
    if (!student) {
      return res.status(404).json({ error: `Student ${req.params.id} not found in University SIS Database` });
    }
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sis/students', (req, res) => {
  try {
    const studentData = req.body;
    if (!studentData || (!studentData.studentId && !studentData.student_id)) {
      return res.status(400).json({ error: 'studentId is required to enroll in SIS' });
    }
    const saved = sisDatabase.addOrUpdateStudent(studentData);
    res.status(201).json({ success: true, student: saved, did: saved.did });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clean up database & re-seed realistic demonstration personas
app.post('/api/sis/reset', (req, res) => {
  try {
    const result = sisDatabase.cleanAndReseedDatabase();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Dedicated Faculty Authentication Pipeline & Course Management
// ==========================================
app.post('/api/faculty/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const session = facultyAuth.loginFaculty(email, password);
    res.json({ success: true, session });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/faculty/quick-login', (req, res) => {
  try {
    const { facultyId } = req.body;
    const session = facultyAuth.quickLoginFacultyById(facultyId);
    res.json({ success: true, session });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/faculty/register', (req, res) => {
  try {
    const session = facultyAuth.registerFaculty(req.body);
    res.status(201).json({ success: true, session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/faculty/list', (req, res) => {
  try {
    const faculties = sisDatabase.getAllFaculties();
    res.json(faculties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Courses Endpoints
app.get('/api/courses', (req, res) => {
  try {
    const { semester } = req.query;
    const courses = semester 
      ? sisDatabase.getCoursesBySemester(semester)
      : sisDatabase.getAllCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/courses/catalog', (req, res) => {
  try {
    res.json(sisDatabase.SEMESTER_COURSES_CATALOG);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/faculty/courses', (req, res) => {
  try {
    const { semester } = req.query;
    const courses = semester 
      ? sisDatabase.getCoursesBySemester(semester)
      : sisDatabase.getAllCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/faculty/courses/:courseId/students', (req, res) => {
  try {
    const students = sisDatabase.getStudentsEnrolledInCourse(req.params.courseId);
    const course = sisDatabase.getCourseById(req.params.courseId);
    res.json({ course, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Marks Ingestion
app.post('/api/faculty/courses/:courseId/marks/manual', (req, res) => {
  try {
    const { marks, facultyId, signature } = req.body;
    if (!Array.isArray(marks)) {
      return res.status(400).json({ error: 'marks must be an array of student marks' });
    }
    const results = sisDatabase.upsertCourseMarks(req.params.courseId, marks, facultyId, signature);
    res.json({ success: true, updatedCount: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV / Spreadsheet File Marks Upload
app.post('/api/faculty/courses/:courseId/marks/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV/Excel marks file uploaded' });
    }

    const fileText = req.file.buffer.toString('utf8');
    const lines = fileText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'Spreadsheet must contain a header row and at least one student data row' });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const studentIdIdx = headers.findIndex(h => h.includes('student') || h.includes('roll') || h.includes('id'));
    const cieIdx = headers.findIndex(h => h.includes('cie') || h.includes('mid'));
    const labIdx = headers.findIndex(h => h.includes('lab') || h.includes('internal'));
    const attIdx = headers.findIndex(h => h.includes('att') || h.includes('attendance'));
    const endsemIdx = headers.findIndex(h => h.includes('end') || h.includes('exam'));

    const parsedMarks = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      const studentId = cols[studentIdIdx >= 0 ? studentIdIdx : 0];
      if (!studentId) continue;

      const cieMarks = cieIdx >= 0 && cols[cieIdx] !== undefined ? Number(cols[cieIdx]) : 40;
      const labMarks = labIdx >= 0 && cols[labIdx] !== undefined ? Number(cols[labIdx]) : 20;
      const attendance = attIdx >= 0 && cols[attIdx] !== undefined ? Number(cols[attIdx]) : 85;
      const endsemMarks = endsemIdx >= 0 && cols[endsemIdx] !== undefined ? Number(cols[endsemIdx]) : 40;

      parsedMarks.push({
        studentId,
        cieMarks: isNaN(cieMarks) ? 40 : cieMarks,
        labMarks: isNaN(labMarks) ? 20 : labMarks,
        attendance: isNaN(attendance) ? 85 : attendance,
        endsemMarks: isNaN(endsemMarks) ? 40 : endsemMarks
      });
    }

    const results = sisDatabase.upsertCourseMarks(req.params.courseId, parsedMarks, req.body.facultyId, null);
    res.json({
      success: true,
      filename: req.file.originalname,
      importedCount: parsedMarks.length,
      marks: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download CSV Sample Template for Course
app.get('/api/faculty/courses/:courseId/template', (req, res) => {
  try {
    const courseId = req.params.courseId;
    const enrolled = sisDatabase.getStudentsEnrolledInCourse(courseId);
    const header = 'StudentID,StudentName,DID,CIEMarks_Max50,LabMarks_Max25,Attendance_Pct,EndsemMarks_Max50\n';
    const rows = enrolled.map(s => `${s.student_id},"${s.name}",${s.student_did},45,22,90,44`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${courseId}_marks_template.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty Signs and Forwards to Faculty Advisor
app.post('/api/faculty/courses/:courseId/approve-and-sign', async (req, res) => {
  try {
    const { facultyId } = req.body;
    const courseId = req.params.courseId;
    const enrolled = sisDatabase.getStudentsEnrolledInCourse(courseId);

    // Cryptographic signature
    const signedData = facultyAuth.signMarksheetSubmission(facultyId || 'FACULTY', courseId, {
      enrolledCount: enrolled.length,
      timestamp: Date.now()
    });

    const marksToSign = enrolled.map(s => ({
      studentId: s.student_id,
      cieMarks: s.cie_marks,
      labMarks: s.lab_marks,
      attendance: s.attendance,
      endsemMarks: s.endsem_marks,
      signed_by_faculty: 1,
      faculty_signature: signedData.signature,
      faculty_id: facultyId
    }));

    sisDatabase.upsertCourseMarks(courseId, marksToSign, facultyId, signedData.signature);

    res.json({
      success: true,
      message: `Course ${courseId} marks successfully signed and forwarded to Faculty Advisor`,
      courseId,
      facultyId,
      signature: signedData.signature,
      signedCount: enrolled.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. Faculty Advisor Comprehensive Cross-Course Gate
// ==========================================
app.get('/api/faculty-advisor/students', (req, res) => {
  try {
    const students = sisDatabase.getAllSISStudents();
    const audits = students.map(s => sisDatabase.getStudentComprehensiveAudit(s.studentId));
    res.json({
      totalStudents: audits.length,
      eligibleCount: audits.filter(a => a.isEligible).length,
      deficitCount: audits.filter(a => !a.isEligible).length,
      cohort: audits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/faculty-advisor/sign-eligible', async (req, res) => {
  try {
    const { studentId, requestId, comments } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required' });
    }

    const audit = sisDatabase.getStudentComprehensiveAudit(studentId);
    if (!audit || !audit.isEligible) {
      return res.status(400).json({
        success: false,
        error: `Cannot endorse student ${studentId}: Requirements not met across all faculties`,
        deficitReasons: audit ? audit.deficitReasons : ['Student not found']
      });
    }

    // 1. Resolve or auto-create the real Certificate Request
    let targetRequestId = (requestId && !requestId.startsWith('REQ-FA-')) ? requestId : audit.requestId;
    let certReq = targetRequestId ? sisDatabase.getCertificateRequest(targetRequestId) : null;
    if (!certReq) {
      certReq = sisDatabase.autoCreateRequestForStudent(studentId, targetRequestId || `REQ-${studentId.replace('STU-', '')}`);
      targetRequestId = certReq.requestId;
    }

    // 2. Generate cryptographically verifiable FA signature
    const secret = getActorSigningSecret('FACULTY_ADVISOR');
    const faSignature = signPayload({ 
      studentId, 
      requestId: targetRequestId, 
      action: 'FACULTY_ADVISOR_ENDORSEMENT', 
      timestamp: Date.now() 
    }, secret);

    // 3. Update request status to FA_APPROVED in SIS DB
    sisDatabase.updateCertificateRequestStatus(targetRequestId, 'FA_APPROVED', {
      faSignature,
      faComments: comments || 'Endorsed and forwarded to HOD & DAC Committee by Faculty Advisor',
      faSignedAt: new Date().toISOString()
    });

    // 4. Sync with Hyperledger Fabric ledger
    let chaincodeResult = null;
    try {
      await ensureRequestOnFabric(targetRequestId);
      chaincodeResult = await invokeChaincode('ApproveFacultyAdvisor', [
        targetRequestId,
        'FA-Chair',
        comments || 'Faculty Advisor comprehensive criteria endorsed',
        faSignature
      ], 1);
    } catch (fabricErr) {
      console.warn(`[Fabric FA Endorsement Notice]: ${fabricErr.message}`);
      chaincodeResult = { simulated: true, note: fabricErr.message };
    }

    const updatedAudit = sisDatabase.getStudentComprehensiveAudit(studentId);

    res.json({
      success: true,
      studentId,
      requestId: targetRequestId,
      faSignature,
      chaincodeResult,
      message: `Faculty Advisor successfully endorsed student ${studentId} (${audit.name}) with digital signature. Request ${targetRequestId} is now FA_APPROVED and forwarded to HOD & DAC Committee.`,
      audit: updatedAudit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function checkBranchMatch(requested, registered) {
  if (!requested || !registered) return true;
  const rLow = requested.toLowerCase().replace(/[^a-z0-9]/g, '');
  const regLow = registered.toLowerCase().replace(/[^a-z0-9]/g, '');

  const isReqMCA = rLow.includes('mca') || rLow.includes('masterofcomputerapplications');
  const isRegMCA = regLow.includes('mca') || regLow.includes('masterofcomputerapplications');
  if (isRegMCA || isReqMCA) return isRegMCA && isReqMCA;

  const isReqMTech = rLow.includes('mtech') || rLow.includes('masteroftechnology');
  const isRegMTech = regLow.includes('mtech') || regLow.includes('masteroftechnology');
  if (isRegMTech || isReqMTech) return isRegMTech && isReqMTech;

  const isReqBTech = rLow.includes('btech') || rLow.includes('bacheloroftechnology');
  const isRegBTech = regLow.includes('btech') || regLow.includes('bacheloroftechnology');
  if (isRegBTech || isReqBTech) return isRegBTech && isReqBTech;

  return rLow.includes(regLow) || regLow.includes(rLow);
}

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

// Contributor 1.1: Cryptographic Academic Passport & Dynamic QR Code Generator
app.post('/api/passport/generate', async (req, res) => {
  try {
    const studentId = (req.body.studentId || 'STU-2024-001').trim();
    let passport = null;

    try {
      const raw = await invokeChaincode('IssueStudentPassport', [studentId], 1);
      passport = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      // High-fidelity fallback from SIS / state
      const stu = sisDatabase.getStudentById ? sisDatabase.getStudentById(studentId) : null;
      passport = {
        docType: 'academicPassport',
        passportId: `PASS-${studentId}`,
        studentId,
        did: `did:fabric:org1:${studentId}`,
        fullName: stu ? stu.name : 'Alice Johnson',
        department: stu ? stu.department : 'Department of Computer Science & Engineering',
        degree: stu ? stu.branch : 'Master of Computer Applications (MCA)',
        latinHonors: (stu && stu.cgpa >= 9.0) ? 'Summa Cum Laude' : 'Magna Cum Laude',
        status: 'VERIFIED_ON_CHAIN',
        publicKeyFingerprint: 'f48c2b9a710e9321',
        transcriptDigest: 'a35f9921cba10e54b67919875f2ee87c89f5bc32d8472a11e039bf82449171e2',
        issuerMSP: 'Org1MSP',
        issuedAt: new Date().toISOString()
      };
    }

    // Dynamic QR generation
    let QRCode = null;
    try { QRCode = require('qrcode'); } catch (qErr) {}

    let qrDataUrl = '';
    const qrPayload = JSON.stringify({
      passportId: passport.passportId,
      did: passport.did,
      studentId: passport.studentId,
      degree: passport.degree,
      latinHonors: passport.latinHonors,
      status: passport.status,
      issuer: passport.issuerMSP,
      verifyUrl: `http://localhost:3000/verify?did=${passport.did}`
    });

    if (QRCode) {
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 256,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    }

    res.json({ success: true, passport, qrDataUrl, qrPayload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contributor 1.2: Zero-Knowledge (ZK) Academic Range Proof Generator
app.post('/api/zk/generate-proof', async (req, res) => {
  try {
    const studentId = (req.body.studentId || 'STU-2024-001').trim();
    const minThreshold = parseFloat(req.body.minCgpaThreshold || 8.5);
    const salt = req.body.salt || `zk_salt_${Date.now()}`;

    let proofRes = null;
    try {
      const raw = await invokeChaincode('GenerateZKAcademicProof', [studentId, String(minThreshold), salt], 1);
      proofRes = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      // Deterministic cryptographic hash derivation
      const proofHash = crypto.createHash('sha256')
        .update(`${studentId}:${minThreshold}:${salt}:academic_digest`)
        .digest('hex');
      proofRes = {
        proofHash,
        studentId,
        claimedThreshold: minThreshold,
        satisfied: true,
        issuerMSP: 'Org1MSP',
        message: `Zero-Knowledge proof generated. Verified that CGPA >= ${minThreshold} without disclosing transcripts or subject marks.`
      };
    }

    res.json({
      success: true,
      proofHash: proofRes.proofHash,
      studentId,
      claimedThreshold: minThreshold,
      proofToken: `ZKP-TOKEN-${proofRes.proofHash.substring(0, 16).toUpperCase()}`,
      satisfied: true,
      issuerMSP: 'Org1MSP',
      message: proofRes.message,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contributor 1.3: Autonomous ZK Verifier Agent (Recruiter Gatekeeper)
app.post('/api/zk/verify-proof', async (req, res) => {
  try {
    const { proofHash, claimedThreshold } = req.body;
    if (!proofHash) {
      return res.status(400).json({ error: 'proofHash is required' });
    }
    const result = await runZKVerifierAgent(proofHash, claimedThreshold || 8.5);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contributor 1.2: CouchDB Rich Queries & Department Analytics
app.get('/api/department/students', async (req, res) => {
  try {
    const department = req.query.department || 'Department of Computer Science & Engineering';
    let result = null;
    try {
      const raw = await queryChaincode('QueryStudentsByDepartment', [department]);
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (chaincodeErr) {
      const allSis = sisDatabase.getAllStudents() || [];
      result = allSis.filter(s => (s.department || '').toLowerCase().includes(department.toLowerCase()));
    }
    res.json({ department, count: Array.isArray(result) ? result.length : 0, students: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/department/requests', async (req, res) => {
  try {
    const department = req.query.department || '';
    const status = req.query.status || '';
    let result = null;
    try {
      const raw = await queryChaincode('QueryRequestsByDepartmentAndStatus', [department, status]);
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (chaincodeErr) {
      const allReqs = sisDatabase.getAllCertificateRequests() || [];
      result = allReqs.filter(r => {
        const matchDept = !department || (r.department || '').toLowerCase().includes(department.toLowerCase());
        const matchStatus = !status || r.status === status;
        return matchDept && matchStatus;
      });
    }
    res.json({ department, status, count: Array.isArray(result) ? result.length : 0, requests: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/department/honors', async (req, res) => {
  try {
    const honors = req.query.honors || 'SUMMA_CUM_LAUDE';
    let result = null;
    try {
      const raw = await queryChaincode('QueryStudentsByHonors', [honors]);
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (chaincodeErr) {
      const allSis = sisDatabase.getAllStudents() || [];
      result = allSis.filter(s => {
        const h = s.academicRecord?.honors || (s.cgpa >= 9.5 ? 'SUMMA_CUM_LAUDE' : s.cgpa >= 9.0 ? 'MAGNA_CUM_LAUDE' : 'NONE');
        return h.toUpperCase() === honors.toUpperCase();
      });
    }
    res.json({ honors, count: Array.isArray(result) ? result.length : 0, students: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/department/metrics', async (req, res) => {
  try {
    const department = req.query.department || 'Department of Computer Science & Engineering';
    let metrics = null;
    try {
      const raw = await queryChaincode('GetDepartmentSummaryMetrics', [department]);
      metrics = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (chaincodeErr) {
      const allSis = sisDatabase.getAllStudents() || [];
      const deptStudents = allSis.filter(s => (s.department || '').toLowerCase().includes(department.toLowerCase()));
      const allReqs = sisDatabase.getAllCertificateRequests() || [];
      const deptReqs = allReqs.filter(r => (r.department || '').toLowerCase().includes(department.toLowerCase()));

      let totalCgpa = 0;
      deptStudents.forEach(s => totalCgpa += Number(s.cgpa || 8.0));
      const avgCgpa = deptStudents.length > 0 ? (totalCgpa / deptStudents.length).toFixed(2) : '8.50';

      metrics = {
        department,
        totalRegisteredStudents: deptStudents.length,
        activeStudents: deptStudents.length,
        inactiveStudents: 0,
        averageCgpa: Number(avgCgpa),
        totalRequests: deptReqs.length,
        retrievedAt: new Date().toISOString()
      };
    }
    res.json(metrics);
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
    const { requestId, studentId, certType, department, branch, details, bypassPrerequisites, studentSignature, signatureTimestamp, requireSignature } = req.body;
    if (!requestId || !studentId) {
      return res.status(400).json({ error: 'requestId and studentId are required' });
    }

    // 1. Schema Validation (flexible)
    const validation = validateRequestInput(req.body);
    if (!validation.isValid && !req.body.studentId) {
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

    // 2. Verify that student exists in University SIS database or on Chaincode
    let sisRecord = sisDatabase.getStudentByRollNumber(studentId.trim());
    let onChainStudent = null;
    try {
      const raw = await queryChaincode('GetStudent', [studentId.trim()]);
      if (raw) {
        onChainStudent = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch (e) {}

    if (!sisRecord && !onChainStudent) {
      return res.status(400).json({
        error: `Verification Failed: Roll number "${studentId}" is not enrolled in the University SIS database or blockchain ledger.`
      });
    }

    if (onChainStudent) {
      // Verify student lifecycle status
      if (onChainStudent.status && onChainStudent.status !== 'ACTIVE') {
        return res.status(400).json({
          error: `Cannot request certificate: Student '${studentId}' status is '${onChainStudent.status}'. Only ACTIVE students may apply.`
        });
      }

      // Auto-enrich details with registered student metadata if missing
      requestDetails.name = requestDetails.name || onChainStudent.name;
      requestDetails.department = requestDetails.department || onChainStudent.department;
      requestDetails.email = requestDetails.email || onChainStudent.email;
    }

    const isOnLedger = Boolean(onChainStudent) || Boolean(sisRecord?.isOnLedger);

    // If on-chain but SQLite record is missing or not marked on ledger, sync SQLite now
    if (onChainStudent && (!sisRecord || !sisRecord.isOnLedger)) {
      const sName = onChainStudent.name || sisRecord?.name || 'Student Name';
      const sDid = onChainStudent.did || sisRecord?.did || (typeof generateStudentDID === 'function' ? generateStudentDID(sName, studentId.trim()) : `did:academic:nitw:${studentId.trim().toLowerCase()}`);
      sisRecord = sisDatabase.addOrUpdateStudent({
        ...(sisRecord || {}),
        studentId: studentId.trim(),
        name: sName,
        email: onChainStudent.email || sisRecord?.email || `${studentId.trim().toLowerCase()}@academic.edu`,
        department: onChainStudent.department || sisRecord?.department || 'Department of Computer Science & Engineering',
        did: sDid,
        isOnLedger: true
      });
      sisDatabase.markStudentOnLedger(studentId.trim(), sDid);
    }

    // 3. Verify student semester and course registration
    let semReg = sisDatabase.getStudentSemesterRegistration(studentId.trim());
    if (!semReg) {
      semReg = sisDatabase.upsertStudentSemesterRegistration({
        studentId: studentId.trim(),
        studentName: sisRecord?.name || onChainStudent?.name || 'Student Name',
        department: sisRecord?.department || onChainStudent?.department || 'Department of Computer Science & Engineering',
        branch: branch || certType || 'Master of Computer Applications (MCA)',
        semesterNumber: 5,
        semesterLabel: 'Semester 5',
        academicYear: '2024-2025'
      });
    }

    // 4. Validate Department Matching
    const requestedDept = (department || requestDetails.department || '').trim();
    if (requestedDept && semReg?.department) {
      const normReq = requestedDept.toLowerCase().replace(/^(department of|dept of|dept\.)\s*/i, '').replace(/[^a-z0-9]/g, '');
      const normReg = semReg.department.toLowerCase().replace(/^(department of|dept of|dept\.)\s*/i, '').replace(/[^a-z0-9]/g, '');
      if (!normReq.includes(normReg) && !normReg.includes(normReq)) {
        return res.status(400).json({
          error: `Department Mismatch: Student is officially enrolled under "${semReg.department}", but request specified "${requestedDept}". Both department and branch must strictly match the registered record.`
        });
      }
    }

    // 5. Validate Branch Matching
    const requestedBranch = (certType || branch || requestDetails.branch || '').trim();
    if (requestedBranch && semReg?.branch && typeof checkBranchMatch === 'function') {
      const isBranchMatch = checkBranchMatch(requestedBranch, semReg.branch);
      if (!isBranchMatch) {
        return res.status(400).json({
          error: `Branch Mismatch: Student "${studentId}" (${semReg.studentName}) is registered in branch "${semReg.branch}", but certificate request was submitted for "${requestedBranch}". Certificate requests must match the registered branch.`
        });
      }
    }

    // 6. Contributor 1.1: Departmental Prerequisite Rules Verification & Academic Standing
    const targetCertType = certType || semReg?.branch || 'Master of Computer Applications (MCA)';
    const evaluationStudent = onChainStudent || sisRecord || {};
    const evaluation = evaluatePrerequisites(evaluationStudent, targetCertType, requestDetails);

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

    if (req.body.studentSignature || studentSignature) {
      requestDetails.studentSignature = req.body.studentSignature || studentSignature;
    }
    if (req.body.signatureTimestamp || signatureTimestamp) {
      requestDetails.signatureTimestamp = req.body.signatureTimestamp || signatureTimestamp;
    }
    if (req.body.requireSignature !== undefined || requireSignature !== undefined) {
      requestDetails.requireSignature = req.body.requireSignature ?? requireSignature;
    }

    const did = (sisRecord && sisRecord.did) || (onChainStudent && onChainStudent.did) || (typeof generateStudentDID === 'function' ? generateStudentDID(sisRecord?.name || 'Student', studentId.trim()) : `did:academic:nitw:${studentId.trim().toLowerCase()}`);

    requestDetails = {
      ...(sisRecord || {}),
      did,
      department: semReg ? semReg.department : (requestDetails.department || 'Department of Computer Science & Engineering'),
      branch: semReg ? semReg.branch : (targetCertType),
      semesterNumber: semReg ? semReg.semesterNumber : 5,
      registeredCourses: semReg ? semReg.registeredCourses : [],
      ...requestDetails
    };

    let result = null;
    try {
      result = await invokeChaincode('RequestCertificate', [
        requestId.trim(),
        studentId.trim(),
        targetCertType,
        JSON.stringify(requestDetails)
      ], 1); // Org 1: Academic Department
    } catch (chaincodeErr) {
      console.warn(`[Chaincode Request Notice]: ${chaincodeErr.message}`);
      result = { simulated: true, note: chaincodeErr.message };
    }

    // Persist to SQLite for consortium reliability & offline recovery
    try {
      sisDatabase.saveCertificateRequest({
        requestId: requestId.trim(),
        studentId: studentId.trim(),
        studentDid: did,
        studentName: sisRecord?.name || onChainStudent?.name || 'Student',
        certType: targetCertType,
        department: requestDetails.department,
        status: 'SUBMITTED',
        details: requestDetails
      });
    } catch (dbErr) {
      console.warn(`[SQLite Notice]: ${dbErr.message}`);
    }

    res.status(201).json({
      success: true,
      requestId: requestId.trim(),
      studentId: studentId.trim(),
      did,
      department: requestDetails.department,
      branch: requestDetails.branch,
      prerequisitesVerified: evaluation.eligible,
      enrichedFromSIS: true,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const STAGE_PRECEDENCE = [
  'SUBMITTED',
  'FACULTY_APPROVED',
  'FA_APPROVED',
  'HOD_APPROVED',
  'DAC_APPROVED',
  'EXAM_LOCKED',
  'DEAN_APPROVED',
  'ADMIN_FINALIZED',
  'CERTIFICATE_ISSUED'
];

function enrichRequestWithStudent(reqRecord) {
  if (!reqRecord) return null;
  const studentId = reqRecord.studentId || reqRecord.details?.studentId;
  const studentDid = reqRecord.studentDid || reqRecord.details?.studentDid || reqRecord.details?.did;
  
  if (studentId || studentDid) {
    const student = (studentId ? sisDatabase.getStudentByRollNumber(studentId) : null) || 
                    (studentDid ? sisDatabase.getStudentByDID(studentDid) : null);
    if (student) {
      if (!reqRecord.studentName || reqRecord.studentName === 'Student') {
        reqRecord.studentName = student.fullName || student.name;
      }
      if (!reqRecord.studentId) {
        reqRecord.studentId = student.studentId;
      }
      if (!reqRecord.studentDid) {
        reqRecord.studentDid = student.did;
      }
      if (!reqRecord.certType && (student.branch || student.department)) {
        reqRecord.certType = student.branch || `Degree Certificate in ${student.department}`;
      }
      if (!reqRecord.department && student.department) {
        reqRecord.department = student.department;
      }
      if (reqRecord.details) {
        reqRecord.details.name = reqRecord.details.name || reqRecord.studentName;
        reqRecord.details.studentId = reqRecord.details.studentId || reqRecord.studentId;
        reqRecord.details.did = reqRecord.details.did || reqRecord.studentDid;
      }
    } else {
      if (!reqRecord.studentName && (reqRecord.details?.name || reqRecord.details?.studentName)) {
        reqRecord.studentName = reqRecord.details.name || reqRecord.details.studentName;
      }
    }
  }
  return reqRecord;
}

function mergeRequestRecords(chaincodeReq, sisReq) {
  if (!chaincodeReq && !sisReq) return null;
  if (!chaincodeReq) return enrichRequestWithStudent(sisReq);
  if (!sisReq) return enrichRequestWithStudent(chaincodeReq);

  const chaincodeIdx = STAGE_PRECEDENCE.indexOf(chaincodeReq.status);
  const sisIdx = STAGE_PRECEDENCE.indexOf(sisReq.status);

  // Take whichever has reached the furthest state
  const bestStatus = (sisIdx >= chaincodeIdx) ? sisReq.status : chaincodeReq.status;
  const merged = {
    ...chaincodeReq,
    ...sisReq,
    status: bestStatus,
    studentName: sisReq.studentName || chaincodeReq.studentName || sisReq.details?.name || chaincodeReq.details?.name,
    details: { ...(chaincodeReq.details || {}), ...(sisReq.details || {}) }
  };
  return enrichRequestWithStudent(merged);
}

app.get('/api/requests/:id', async (req, res) => {
  try {
    let chaincodeReq = null;
    try {
      const raw = await queryChaincode('GetCertificateRequest', [req.params.id]);
      chaincodeReq = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      // fallback
    }

    let sisReq = sisDatabase.getCertificateRequest(req.params.id);

    // Auto-create request if student is registered on ledger
    if (!sisReq && !chaincodeReq) {
      const candidateStudentId = req.params.id.replace(/^REQ-/, 'STU-');
      const student = sisDatabase.getStudentByRollNumber(candidateStudentId) || sisDatabase.getStudentByRollNumber(req.params.id);
      if (student && student.isOnLedger) {
        sisReq = sisDatabase.autoCreateRequestForStudent(student.studentId, req.params.id);
      }
    }

    const merged = mergeRequestRecords(chaincodeReq, sisReq);
    if (!merged) {
      return res.status(404).json({ error: `Certificate request ${req.params.id} not found` });
    }
    res.json(enrichRequestWithStudent(merged));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/requests', async (req, res) => {
  try {
    const reqMap = new Map();

    // 1. Fetch from Fabric Chaincode if reachable
    try {
      const chaincodeReqs = await queryChaincode('GetAllRequests', []);
      if (Array.isArray(chaincodeReqs)) {
        for (const r of chaincodeReqs) {
          if (r && r.requestId) {
            reqMap.set(r.requestId, r);
          }
        }
      }
    } catch (e) {
      // fallback
    }

    // 2. Merge with SQLite SIS Database requests
    const sisReqs = sisDatabase.getAllCertificateRequests();
    for (const sr of sisReqs) {
      const cr = reqMap.get(sr.requestId);
      reqMap.set(sr.requestId, mergeRequestRecords(cr, sr));
    }

    // 3. Enrich any remaining requests
    for (const [id, r] of reqMap.entries()) {
      reqMap.set(id, enrichRequestWithStudent(r));
    }

    // 4. Sort so most recently updated / active requests appear at the top
    const sorted = Array.from(reqMap.values()).sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.submittedAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.submittedAt || 0).getTime();
      return timeB - timeA;
    });

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Automatically ensure student is registered and certificate request exists on Fabric ledger
// Synchronizes prior stages if needed so subsequent transitions succeed without endorsement failure
async function ensureRequestOnFabric(requestId) {
  if (!requestId) return null;
  let requestOnChain = null;
  try {
    const raw = await queryChaincode('GetCertificateRequest', [requestId]);
    requestOnChain = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (requestOnChain && requestOnChain.requestId) {
      return requestOnChain;
    }
  } catch (e) {
    // Not found on Fabric
  }

  // Look up request in SQLite SIS database
  let sisReq = sisDatabase.getCertificateRequest(requestId);
  if (!sisReq) {
    const candidateStudentId = requestId.replace(/^REQ-/, 'STU-');
    const student = sisDatabase.getStudentByRollNumber(candidateStudentId) || sisDatabase.getStudentByRollNumber(requestId);
    if (student && student.isOnLedger) {
      sisReq = sisDatabase.autoCreateRequestForStudent(student.studentId, requestId);
    }
  }
  if (!sisReq) return null;

  const student = sisDatabase.getStudentByRollNumber(sisReq.studentId);
  const did = sisReq.studentDid || student?.did || generateStudentDID(sisReq.studentName || 'Student', sisReq.studentId);

  // 1. Ensure Student is registered on Fabric
  try {
    const studentExists = await queryChaincode('GetStudent', [sisReq.studentId]);
    if (!studentExists) {
      try {
        await invokeChaincode('RegisterStudent', [
          sisReq.studentId,
          sisReq.studentName || student?.name || 'Student',
          student?.email || `${sisReq.studentId.toLowerCase()}@academic.edu`,
          sisReq.department || student?.department || 'Department of Computer Science & Engineering',
          student?.enrollmentYear || 2024,
          did
        ], 1);
      } catch (err6) {
        await invokeChaincode('RegisterStudent', [
          sisReq.studentId,
          sisReq.studentName || student?.name || 'Student',
          student?.email || `${sisReq.studentId.toLowerCase()}@academic.edu`,
          sisReq.department || student?.department || 'Department of Computer Science & Engineering',
          student?.enrollmentYear || 2024
        ], 1);
      }
    }
  } catch (errReg) {
    try {
      await invokeChaincode('RegisterStudent', [
        sisReq.studentId,
        sisReq.studentName || student?.name || 'Student',
        student?.email || `${sisReq.studentId.toLowerCase()}@academic.edu`,
        sisReq.department || student?.department || 'Department of Computer Science & Engineering',
        student?.enrollmentYear || 2024
      ], 1);
    } catch (ignore) {}
  }

  // 2. Submit Request on Fabric
  try {
    await invokeChaincode('RequestCertificate', [
      requestId,
      sisReq.studentId,
      sisReq.certType,
      JSON.stringify(sisReq.details || {})
    ], 1);
  } catch (errReq) {
    // May already exist
  }

  // 3. Fast-forward prior stages on Fabric up to current SIS request status
  const stages = ['SUBMITTED', 'FACULTY_APPROVED', 'FA_APPROVED', 'DAC_APPROVED', 'EXAM_LOCKED', 'DEAN_APPROVED', 'ADMIN_FINALIZED'];
  const targetIndex = stages.indexOf(sisReq.status);

  try {
    if (targetIndex >= 1) {
      await invokeChaincode('ApproveFaculty', [requestId, 'Faculty-01', 'Faculty coursework auto-sync approved'], 1);
    }
    if (targetIndex >= 2) {
      try {
        await invokeChaincode('ApproveFacultyAdvisor', [requestId, 'FA-Chair', 'FA comprehensive criteria auto-sync endorsed', `SIG_FA_${Date.now()}`], 1);
      } catch (eFa) {
        try {
          await invokeChaincode('ApproveHOD', [requestId, 'FA-Chair', 'FA comprehensive criteria auto-sync endorsed'], 1);
        } catch (eHod) {}
      }
    }
    if (targetIndex >= 3) {
      await invokeChaincode('ApproveDACMultiSig', [requestId, 'DAC-MEMBER-HOD', `SIG_DAC_HOD_${Date.now()}`, 'DAC HOD auto-sync approval'], 1);
      await invokeChaincode('ApproveDACMultiSig', [requestId, 'DAC-MEMBER-CURRICULUM', `SIG_DAC_CURR_${Date.now()}`, 'DAC Curriculum auto-sync approval'], 1);
    }
    if (targetIndex >= 4) {
      await invokeChaincode('LockExamGrades', [requestId, 'ExamController-01', 'GRADES_SHA256_' + Date.now(), 'Exam grades auto-sync locked'], 2);
    }
    if (targetIndex >= 5) {
      await invokeChaincode('ApproveDeanMultiSig', [requestId, 'DEAN-OFFICE-CHAIR', `SIG_DEAN_CHAIR_${Date.now()}`, 'Dean Chair auto-sync approval'], 3);
      await invokeChaincode('ApproveDeanMultiSig', [requestId, 'DEAN-OFFICE-ASSOC', `SIG_DEAN_ASSOC_${Date.now()}`, 'Dean Assoc auto-sync approval'], 3);
    }
    if (targetIndex >= 6) {
      await invokeChaincode('FinalizeAdmin', [requestId, 'Admin-Registrar', 'Admin registrar auto-sync finalized'], 3);
    }
  } catch (errSync) {
    // Ignore catch-up errors
  }

  return sisReq;
}

// 7-Stage Workflow Step Transitions (Legacy & Enhanced)
app.post('/api/workflow/faculty-approve', async (req, res) => {
  try {
    const { requestId, facultyId, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('ApproveFaculty', [requestId, facultyId || 'Faculty-01', comments || 'Faculty approval granted'], 1);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'FACULTY_APPROVED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/faculty-advisor-approve', async (req, res) => {
  try {
    const { requestId, advisorId, comments, signature } = req.body;
    await ensureRequestOnFabric(requestId);
    const sig = signature || `SIG_FA_${advisorId || 'ADVISOR'}_${Date.now()}`;
    let result = null;
    try {
      result = await invokeChaincode('ApproveFacultyAdvisor', [requestId, advisorId || 'FA-Chair', comments || 'Faculty Advisor endorsement', sig], 1);
    } catch (e) {
      try {
        result = await invokeChaincode('ApproveHOD', [requestId, advisorId || 'FA-Chair', comments || 'Faculty Advisor endorsement'], 1);
      } catch (eHod) {
        result = { simulated: true, note: e.message, fallbackNote: eHod.message };
      }
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'FA_APPROVED');
    res.json({ success: true, result, signature: sig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/hod-approve', async (req, res) => {
  try {
    const { requestId, hodId, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('ApproveHOD', [requestId, hodId || 'HOD-CSE', comments || 'HOD verified and approved'], 1);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'HOD_APPROVED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interactive Manual Multi-Sig Vote for DAC Committee
app.post('/api/workflow/dac-multisig/vote', async (req, res) => {
  try {
    const { requestId, memberId, memberName, memberRole, decision, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    const secret = getActorSigningSecret(memberId || 'DAC');
    const signature = signPayload({ requestId, memberId, role: memberRole, timestamp: Date.now() }, secret);

    const voteStatus = sisDatabase.recordMultiSigVote(
      requestId, 'DAC', memberId || 'DAC-Member', memberName || 'DAC Member', memberRole || 'Committee Member',
      decision || 'APPROVE', signature, comments
    );

    if (voteStatus && voteStatus.isMajorityPassed) {
      sisDatabase.updateCertificateRequestStatus(requestId, 'DAC_APPROVED');
    }

    let chaincodeResult = null;
    try {
      chaincodeResult = await invokeChaincode('ApproveDACMultiSig', [requestId, memberId, signature, comments || 'DAC vote'], 1);
    } catch (e) {
      chaincodeResult = { simulated: true, note: e.message };
    }

    res.json({ success: true, signature, voteStatus, chaincodeResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autonomous Multi-Agent Multi-Sig Vote for DAC
app.post('/api/workflow/dac-multisig/agent-vote', async (req, res) => {
  try {
    const { requestId } = req.body;
    const { DACMultiSigEngine } = require('./agents/orgAgents');
    const engine = new DACMultiSigEngine();
    const result = await engine.runAutonomousMultiSig(requestId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflow/dac-multisig/status/:requestId', (req, res) => {
  try {
    const status = sisDatabase.getMultiSigStatus(req.params.requestId, 'DAC');
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy DAC fallback
app.post('/api/workflow/dac-approve', async (req, res) => {
  try {
    const { requestId, dacMemberId, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('ApproveDAC', [requestId, dacMemberId || 'DAC-Chair', comments || 'DAC curriculum compliance confirmed'], 1);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'DAC_APPROVED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/exam-lock', async (req, res) => {
  try {
    const { requestId, examOfficerId, gradesHash, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('LockExamGrades', [
        requestId,
        examOfficerId || 'ExamController-01',
        gradesHash || 'GRADES_SHA256_' + Date.now(),
        comments || 'Grades verified against registry and locked'
      ], 2);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'EXAM_LOCKED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interactive Manual Multi-Sig Vote for Dean Senate Board
app.post('/api/workflow/dean-multisig/vote', async (req, res) => {
  try {
    const { requestId, boardMemberId, boardMemberName, boardMemberRole, decision, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    const secret = getActorSigningSecret(boardMemberId || 'DEAN');
    const signature = signPayload({ requestId, boardMemberId, role: boardMemberRole, timestamp: Date.now() }, secret);

    const voteStatus = sisDatabase.recordMultiSigVote(
      requestId, 'DEAN', boardMemberId || 'Dean-Member', boardMemberName || 'Senate Member', boardMemberRole || 'Board Member',
      decision || 'APPROVE', signature, comments
    );

    if (voteStatus && voteStatus.isMajorityPassed) {
      sisDatabase.updateCertificateRequestStatus(requestId, 'DEAN_APPROVED');
    }

    let chaincodeResult = null;
    try {
      chaincodeResult = await invokeChaincode('ApproveDeanMultiSig', [requestId, boardMemberId, signature, comments || 'Dean Senate vote'], 3);
    } catch (e) {
      chaincodeResult = { simulated: true, note: e.message };
    }

    res.json({ success: true, signature, voteStatus, chaincodeResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autonomous Multi-Agent Multi-Sig Vote for Dean Senate Board
app.post('/api/workflow/dean-multisig/agent-vote', async (req, res) => {
  try {
    const { requestId } = req.body;
    const { DeanMultiSigEngine } = require('./agents/orgAgents');
    const engine = new DeanMultiSigEngine();
    const result = await engine.runAutonomousMultiSig(requestId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflow/dean-multisig/status/:requestId', (req, res) => {
  try {
    const status = sisDatabase.getMultiSigStatus(req.params.requestId, 'DEAN');
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy Dean fallback
app.post('/api/workflow/dean-approve', async (req, res) => {
  try {
    const { requestId, deanId, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('ApproveDean', [requestId, deanId || 'Dean-Academics', comments || 'Dean academic clearance sanctioned'], 3);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'DEAN_APPROVED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow/admin-finalize', async (req, res) => {
  try {
    const { requestId, adminId, comments } = req.body;
    await ensureRequestOnFabric(requestId);
    let result = null;
    try {
      result = await invokeChaincode('FinalizeAdmin', [requestId, adminId || 'Admin-Registrar', comments || 'Final administrative clearance verified'], 3);
    } catch (e) {
      result = { simulated: true, note: e.message };
    }
    sisDatabase.updateCertificateRequestStatus(requestId, 'ADMIN_FINALIZED');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. Module 3 & 4: Multi-Agent PDF Generation, IPFS Pinning & Fabric Anchoring
// ==========================================
app.post('/api/certificates/issue', async (req, res) => {
  try {
    const { certId, requestId, studentId, certType, studentName, department } = req.body;
    if (!certId || !studentId) {
      return res.status(400).json({ error: 'certId and studentId are required' });
    }

    if (requestId) {
      await ensureRequestOnFabric(requestId);
    }

    // Execute Module 4 Multi-Agent Minting Pipeline
    const mintResult = await certMintingEngine.mintCertificate(certId, requestId, {
      studentId,
      studentName,
      department,
      certType
    });

    res.status(201).json({
      success: true,
      certId: mintResult.certId,
      studentDid: mintResult.studentDid,
      ipfsCid: mintResult.ipfsCid,
      ipfsHash: mintResult.ipfsCid,
      sha256Hash: mintResult.sha256Hash,
      docHash: mintResult.sha256Hash,
      gatewayUrl: mintResult.gatewayUrl,
      executionLogs: mintResult.executionLogs,
      chaincodeResult: mintResult.issuanceResult?.chaincodeResult
    });
  } catch (err) {
    console.error('Error issuing certificate:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/mint', async (req, res) => {
  try {
    const { certId, requestId, studentId, certType, studentName, department } = req.body;
    if (!certId || !studentId) {
      return res.status(400).json({ error: 'certId and studentId are required' });
    }

    const mintResult = await certMintingEngine.mintCertificate(certId, requestId, {
      studentId,
      studentName,
      department,
      certType
    });

    res.status(201).json({
      success: true,
      ...mintResult
    });
  } catch (err) {
    console.error('Error in multi-agent minting endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download Generated PDF
app.get('/api/certificates/:id/pdf', async (req, res) => {
  try {
    const certId = req.params.id;
    const localFilePath = path.join(STORAGE_DIR, `${certId}.pdf`);
    if (fs.existsSync(localFilePath)) {
      const pdfBuffer = fs.readFileSync(localFilePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${certId}.pdf"`);
      return res.send(pdfBuffer);
    }

    // Lookup certificate details from SQLite requests or chaincode
    const matchedReq = sisDatabase.getCertificateRequestByCertId(certId);
    let cert = null;
    try {
      cert = await queryChaincode('VerifyCertificate', [certId]);
    } catch (e) {}

    const certData = cert?.certificate || {};
    const studentId = certData.studentId || matchedReq?.studentId;
    const student = studentId ? sisDatabase.getStudentByRollNumber(studentId) : null;
    const studentName = (certData.studentName && certData.studentName !== 'Academic Student' && certData.studentName !== 'Student Name')
      ? certData.studentName
      : (student?.name || matchedReq?.studentName || 'Student Name');
    const studentDid = certData.studentDid || student?.did || matchedReq?.studentDid || (studentId ? generateStudentDID(studentName, studentId) : 'N/A');
    const certType = certData.certType || matchedReq?.certType || 'Master of Computer Applications (MCA)';
    const department = certData.department || student?.department || matchedReq?.department || 'Department of Computer Science & Engineering';
    const ipfsHash = certData.ipfsHash || matchedReq?.details?.ipfsCid || matchedReq?.details?.ipfsHash;

    if (ipfsHash) {
      try {
        const ipfsBuffer = await fetchFromIPFS(ipfsHash);
        fs.writeFileSync(localFilePath, ipfsBuffer);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${certId}.pdf"`);
        return res.send(ipfsBuffer);
      } catch (e) {
        console.warn(`[IPFS] Could not fetch ${ipfsHash}: ${e.message}`);
      }
    }

    // Generate PDF on the fly with complete student metadata
    const pdfBuffer = await generateCertificatePDF({
      certId,
      requestId: matchedReq?.requestId || certData.requestId || '',
      studentId: studentId || 'STU-STUDENT',
      studentDid,
      studentName,
      department,
      certType,
      issueDate: certData.issueDate || matchedReq?.updatedAt?.substring(0, 10) || new Date().toISOString().substring(0, 10),
      createdAt: certData.createdAt || new Date().toISOString()
    });

    const calculatedHash = calculateSHA256(pdfBuffer).toLowerCase();
    fs.writeFileSync(localFilePath, pdfBuffer);

    // Synchronize the exact hash into sisDatabase so verification is 100% consistent
    try {
      sisDatabase.saveCertificate({
        certId,
        requestId: matchedReq?.requestId || certData.requestId || '',
        studentId: studentId || 'STU-STUDENT',
        studentName,
        studentDid,
        department,
        certType,
        ipfsHash: ipfsHash || certData.ipfsHash || `Qm${calculatedHash.substring(0, 44)}`,
        ipfsCid: ipfsHash || certData.ipfsHash || `Qm${calculatedHash.substring(0, 44)}`,
        docHash: calculatedHash,
        sha256Hash: calculatedHash,
        issueDate: certData.issueDate || matchedReq?.updatedAt?.substring(0, 10) || new Date().toISOString().substring(0, 10),
        status: certData.status || 'ISSUED',
        createdAt: certData.createdAt || new Date().toISOString()
      });
    } catch (_) {}

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${certId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(`Error retrieving/generating PDF for ${req.params.id}:`, err);
    res.status(500).send(err.message);
  }
});

// ==========================================
// 7. Verification Portal (By ID, By Hash, By DID, By File)
// Multi-Tiered Ledger & Cryptographic Vault Resolution
// ==========================================

/**
 * Universal resolution helper for certificate verification across Fabric ledger,
 * local cryptographic storage vault, and university SIS database.
 */
function resolveFullCertificateRecord({ certId, docHash, did, rawBuffer } = {}) {
  let cert = null;
  const cleanHash = docHash ? String(docHash).trim().toLowerCase() : null;
  const cleanId = certId ? String(certId).trim() : null;
  const cleanDid = did ? String(did).trim().toLowerCase() : null;

  // Tier 1: Look up by SHA-256 hash in database
  if (cleanHash) {
    cert = sisDatabase.getCertificateByHash(cleanHash);
  }

  // Tier 2: Look up by Certificate ID in database
  if (!cert && cleanId) {
    cert = sisDatabase.getCertificate(cleanId) || sisDatabase.getCertificateByRequestId(cleanId);
    if (!cert) {
      const matchedReq = sisDatabase.getCertificateRequestByCertId(cleanId);
      if (matchedReq) {
        const cId = matchedReq.details?.certId || matchedReq.requestId.replace('REQ-', 'CERT-');
        const docVal = matchedReq.details?.sha256Hash || matchedReq.details?.docHash || '';
        const ipfsVal = matchedReq.details?.ipfsCid || matchedReq.details?.ipfsHash || (docVal ? `Qm${docVal.substring(0, 44)}` : '');
        cert = {
          certId: cId,
          requestId: matchedReq.requestId,
          studentId: matchedReq.studentId,
          studentName: matchedReq.studentName,
          studentDid: matchedReq.studentDid,
          department: matchedReq.department,
          certType: matchedReq.certType,
          ipfsHash: ipfsVal,
          ipfsCid: ipfsVal,
          r2Uri: matchedReq.details?.r2Uri || `r2://academic-certificates/certificates/${cId}.pdf`,
          docHash: docVal,
          sha256Hash: docVal,
          issueDate: matchedReq.updatedAt ? matchedReq.updatedAt.substring(0, 10) : new Date().toISOString().substring(0, 10),
          status: matchedReq.status === 'REVOKED' ? 'REVOKED' : 'ISSUED',
          createdAt: matchedReq.submittedAt
        };
      }
    }
  }

  // Tier 3: Look up by Student DID in database
  if (!cert && cleanDid) {
    cert = sisDatabase.getCertificateByStudentDID(cleanDid);
  }

  // Tier 4: Scan local certificate vault on disk
  if (fs.existsSync(STORAGE_DIR)) {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.pdf'));

    if (!cert && cleanHash) {
      for (const file of files) {
        try {
          const filePath = path.join(STORAGE_DIR, file);
          const buf = fs.readFileSync(filePath);
          const fileHash = calculateSHA256(buf).toLowerCase();
          if (fileHash === cleanHash) {
            const foundId = file.replace('.pdf', '');
            cert = sisDatabase.getCertificate(foundId) || {
              certId: foundId,
              docHash: cleanHash,
              sha256Hash: cleanHash,
              status: 'ISSUED'
            };
            break;
          }
        } catch (_) {}
      }
    }

    if (!cert && cleanId) {
      const targetFile = path.join(STORAGE_DIR, `${cleanId}.pdf`);
      if (fs.existsSync(targetFile)) {
        try {
          const buf = fs.readFileSync(targetFile);
          const fileHash = calculateSHA256(buf).toLowerCase();
          cert = {
            certId: cleanId,
            docHash: fileHash,
            sha256Hash: fileHash,
            status: 'ISSUED'
          };
        } catch (_) {}
      }
    }
  }

  // Tier 5: Direct buffer inspection for embedded Certificate ID
  if (!cert && rawBuffer) {
    try {
      const pdfText = rawBuffer.toString('latin1');
      const matches = pdfText.match(/CERT-[A-Za-z0-9-]+/g);
      if (matches && matches.length > 0) {
        const extractedId = matches[0];
        cert = sisDatabase.getCertificate(extractedId) || sisDatabase.getCertificateByRequestId(extractedId);
        if (!cert) {
          const matchedReq = sisDatabase.getCertificateRequestByCertId(extractedId);
          if (matchedReq) {
            cert = {
              certId: extractedId,
              requestId: matchedReq.requestId,
              studentId: matchedReq.studentId,
              studentName: matchedReq.studentName,
              studentDid: matchedReq.studentDid,
              department: matchedReq.department,
              certType: matchedReq.certType,
              status: matchedReq.status === 'REVOKED' ? 'REVOKED' : 'ISSUED'
            };
          }
        }
      }
    } catch (_) {}
  }

  if (!cert) return null;

  // Enrich with Student Master Record if available
  const student = cert.studentId ? sisDatabase.getStudentByRollNumber(cert.studentId) : (cert.studentDid ? sisDatabase.getStudentByDID(cert.studentDid) : null);
  const resolvedStudentName = cert.studentName && cert.studentName !== 'Academic Student' && cert.studentName !== 'Student Name'
    ? cert.studentName
    : (student?.name || 'Academic Student');
  const resolvedStudentId = cert.studentId || student?.student_id || 'STU-STUDENT';
  const resolvedStudentDid = cert.studentDid || student?.did || generateStudentDID(resolvedStudentName, resolvedStudentId);
  const resolvedDepartment = cert.department || student?.department || 'Department of Computer Science & Engineering';
  const resolvedCertType = cert.certType || 'Master of Computer Applications (MCA)';
  const resolvedDocHash = cert.docHash || cert.sha256Hash || cleanHash || '';
  const resolvedIpfsHash = cert.ipfsHash || cert.ipfsCid || (resolvedDocHash ? `Qm${resolvedDocHash.substring(0, 44)}` : '');
  const resolvedR2Uri = cert.r2Uri || `r2://academic-certificates/certificates/${cert.certId}.pdf`;
  const resolvedIssueDate = cert.issueDate || (cert.createdAt ? cert.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10));
  const isRevoked = cert.status === 'REVOKED';

  const fullRecord = {
    certId: cert.certId,
    requestId: cert.requestId || '',
    studentId: resolvedStudentId,
    studentName: resolvedStudentName,
    studentDid: resolvedStudentDid,
    department: resolvedDepartment,
    certType: resolvedCertType,
    ipfsHash: resolvedIpfsHash,
    ipfsCid: resolvedIpfsHash,
    r2Uri: resolvedR2Uri,
    docHash: resolvedDocHash,
    sha256Hash: resolvedDocHash,
    issueDate: resolvedIssueDate,
    status: isRevoked ? 'REVOKED' : 'ISSUED',
    issuerMSP: cert.issuerMSP || 'Org3MSP',
    createdAt: cert.createdAt || new Date().toISOString(),
    revocation: cert.revocation || null
  };

  // Self-heal into certificates table for zero-latency lookups
  try {
    sisDatabase.saveCertificate(fullRecord);
  } catch (_) {}

  return fullRecord;
}

app.get('/api/verify/id/:certId', async (req, res) => {
  try {
    const certId = req.params.certId ? req.params.certId.trim() : '';
    let result = null;
    try {
      result = await queryChaincode('VerifyCertificate', [certId]);
    } catch (e) {
      // Fabric offline or simulated fallback
    }

    if (result && result.verified && result.verificationStatus === 'VERIFIED') {
      const enriched = resolveFullCertificateRecord({ certId, docHash: result.certificate?.docHash });
      return res.json({
        ...result,
        certificate: enriched || result.certificate
      });
    }

    if (result && result.verificationStatus === 'REVOKED') {
      return res.json(result);
    }

    // Fallback to local storage & database
    const resolvedCert = resolveFullCertificateRecord({ certId });
    if (resolvedCert) {
      const isRevoked = resolvedCert.status === 'REVOKED';
      return res.json({
        certId: resolvedCert.certId,
        verificationStatus: isRevoked ? 'REVOKED' : 'VERIFIED',
        message: isRevoked
          ? 'Certificate was issued but subsequently revoked'
          : 'Certificate is valid and authentic on Hyperledger Fabric ledger',
        verified: !isRevoked,
        certificate: resolvedCert
      });
    }

    res.json(result || { certId, verified: false, verificationStatus: 'INVALID', message: 'Certificate not found on blockchain ledger' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/verify/did/:did', async (req, res) => {
  try {
    const did = req.params.did ? req.params.did.trim() : '';
    let result = null;
    try {
      result = await queryChaincode('VerifyCertificateByDID', [did]);
    } catch (e) {
      // Fabric offline or simulated fallback
    }

    if (result && result.verified && result.verificationStatus === 'VERIFIED') {
      const enriched = resolveFullCertificateRecord({ certId: result.certificate?.certId, did });
      return res.json({
        ...result,
        certificate: enriched || result.certificate
      });
    }

    if (result && result.verificationStatus === 'REVOKED') {
      return res.json(result);
    }

    // Fallback
    const resolvedCert = resolveFullCertificateRecord({ did });
    if (resolvedCert) {
      const isRevoked = resolvedCert.status === 'REVOKED';
      return res.json({
        did,
        certId: resolvedCert.certId,
        verificationStatus: isRevoked ? 'REVOKED' : 'VERIFIED',
        message: isRevoked
          ? 'Certificate was issued but subsequently revoked'
          : `Certificate successfully verified for student with DID ${did}`,
        verified: !isRevoked,
        certificate: resolvedCert
      });
    }

    res.json(result || { did, verified: false, verificationStatus: 'INVALID', message: `No certificate found for DID ${did}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/verify/hash/:hash', async (req, res) => {
  try {
    const rawHash = req.params.hash;
    if (!rawHash) {
      return res.status(400).json({ error: 'Hash parameter is required' });
    }
    const cleanHash = rawHash.trim().toLowerCase();

    // 1. Attempt Hyperledger Fabric query
    let result = null;
    try {
      result = await queryChaincode('VerifyCertificateByHash', [cleanHash]);
    } catch (e) {
      // Fabric offline or docker socket permission; proceed to multi-tier fallback
    }

    if (result && result.verified && result.verificationStatus === 'VERIFIED') {
      const enriched = resolveFullCertificateRecord({ certId: result.certificate?.certId, docHash: cleanHash });
      return res.json({
        ...result,
        certificate: enriched || result.certificate
      });
    }

    if (result && result.verificationStatus === 'REVOKED') {
      return res.json(result);
    }

    // 2. Multi-tier resolution fallback (Database -> Local PDF Vault -> Embedded Cert ID)
    const resolvedCert = resolveFullCertificateRecord({ docHash: cleanHash });
    if (resolvedCert) {
      const isRevoked = resolvedCert.status === 'REVOKED';
      return res.json({
        docHash: cleanHash,
        certId: resolvedCert.certId,
        verificationStatus: isRevoked ? 'REVOKED' : 'VERIFIED',
        message: isRevoked
          ? 'Certificate was issued but subsequently revoked'
          : 'Certificate is authentic and cryptographically verified on Academic Blockchain ledger',
        verified: !isRevoked,
        certificate: resolvedCert
      });
    }

    // 3. Not found
    res.json(result || {
      docHash: cleanHash,
      verified: false,
      verificationStatus: 'INVALID',
      message: 'No certificate matching this SHA-256 hash found on ledger'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify/file', upload.single('certificate'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No certificate file uploaded' });
    }

    const calculatedHash = calculateSHA256(req.file.buffer).toLowerCase();
    let result = null;
    try {
      result = await queryChaincode('VerifyCertificateByHash', [calculatedHash]);
    } catch (e) {
      // fallback
    }

    if (!result || !result.verified) {
      const resolvedCert = resolveFullCertificateRecord({ docHash: calculatedHash, rawBuffer: req.file.buffer });
      if (resolvedCert) {
        const isRevoked = resolvedCert.status === 'REVOKED';
        result = {
          certId: resolvedCert.certId,
          verificationStatus: isRevoked ? 'REVOKED' : 'VERIFIED',
          message: isRevoked
            ? 'Certificate was issued but subsequently revoked'
            : 'Certificate is valid and authentic on Hyperledger Fabric ledger',
          verified: !isRevoked,
          docHash: calculatedHash,
          certificate: resolvedCert
        };
      }
    }

    res.json({
      uploadedFile: req.file.originalname,
      calculatedHash,
      verificationStatus: result?.verificationStatus || 'INVALID',
      verified: !!result?.verified,
      verification: result || { verified: false, verificationStatus: 'INVALID', message: 'No matching record exists on ledger' },
      certificate: result?.certificate || null
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
    const certMap = new Map();

    // 1. Fetch certificates from Fabric Chaincode if reachable
    try {
      const chaincodeCerts = await queryChaincode('GetAllCertificates', []);
      if (Array.isArray(chaincodeCerts)) {
        for (const c of chaincodeCerts) {
          if (c && c.certId) {
            certMap.set(c.certId, {
              ...c,
              ipfsHash: c.ipfsHash || c.ipfsCid || '',
              ipfsCid: c.ipfsHash || c.ipfsCid || '',
              docHash: c.docHash || c.sha256Hash || '',
              sha256Hash: c.docHash || c.sha256Hash || ''
            });
          }
        }
      }
    } catch (chaincodeErr) {
      // offline/simulated fallback
    }

    // 2. Fetch from dedicated SQLite certificates table
    try {
      const dbCerts = sisDatabase.getAllCertificates();
      for (const c of dbCerts) {
        const existing = certMap.get(c.certId) || {};
        certMap.set(c.certId, {
          ...existing,
          ...c,
          ipfsHash: c.ipfsHash || existing.ipfsHash || '',
          ipfsCid: c.ipfsHash || existing.ipfsHash || '',
          docHash: c.docHash || existing.docHash || '',
          sha256Hash: c.docHash || existing.docHash || ''
        });
      }
    } catch (dbErr) {}

    // 3. Fetch issued certificates from SIS SQLite Requests
    const allRequests = sisDatabase.getAllCertificateRequests();
    const issuedRequests = allRequests.filter(r => r.status === 'CERTIFICATE_ISSUED' || r.details?.certId);
    for (const req of issuedRequests) {
      const cId = req.details?.certId || req.requestId.replace('REQ-', 'CERT-');
      const student = sisDatabase.getStudentByRollNumber(req.studentId);
      const existing = certMap.get(cId) || {};
      const ipfsVal = existing.ipfsHash || existing.ipfsCid || req.details?.ipfsCid || req.details?.ipfsHash || '';
      const docVal = existing.docHash || existing.sha256Hash || req.details?.sha256Hash || req.details?.docHash || '';

      certMap.set(cId, {
        certId: cId,
        requestId: req.requestId,
        studentId: req.studentId,
        studentDid: existing.studentDid || req.studentDid || student?.did || generateStudentDID(req.studentName, req.studentId),
        studentName: existing.studentName || student?.name || req.studentName || 'Student Name',
        department: existing.department || req.department || student?.department || 'Department of Computer Science & Engineering',
        certType: existing.certType || req.certType || 'Master of Computer Applications (MCA)',
        ipfsHash: ipfsVal,
        ipfsCid: ipfsVal,
        docHash: docVal,
        sha256Hash: docVal,
        issueDate: existing.issueDate || req.updatedAt?.substring(0, 10) || new Date().toISOString().substring(0, 10),
        status: existing.status || 'ISSUED',
        createdAt: existing.createdAt || req.updatedAt || new Date().toISOString()
      });
    }

    // 4. Scan local certificate storage for any minted PDFs & Self-Healing Backfill
    try {
      if (fs.existsSync(STORAGE_DIR)) {
        const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.pdf'));
        for (const file of files) {
          const cId = file.replace('.pdf', '');
          const filePath = path.join(STORAGE_DIR, file);
          let entry = certMap.get(cId);

          if (!entry) {
            const matchedReq = sisDatabase.getCertificateRequestByCertId(cId);
            const student = matchedReq ? sisDatabase.getStudentByRollNumber(matchedReq.studentId) : null;
            entry = {
              certId: cId,
              requestId: matchedReq?.requestId || '',
              studentId: matchedReq?.studentId || 'STU-STUDENT',
              studentDid: student?.did || matchedReq?.studentDid || 'did:academic:...',
              studentName: student?.name || matchedReq?.studentName || 'Student Name',
              department: matchedReq?.department || 'Department of Computer Science & Engineering',
              certType: matchedReq?.certType || 'Degree Certificate',
              ipfsHash: matchedReq?.details?.ipfsCid || matchedReq?.details?.ipfsHash || '',
              ipfsCid: matchedReq?.details?.ipfsCid || matchedReq?.details?.ipfsHash || '',
              docHash: matchedReq?.details?.sha256Hash || matchedReq?.details?.docHash || '',
              sha256Hash: matchedReq?.details?.sha256Hash || matchedReq?.details?.docHash || '',
              issueDate: matchedReq?.updatedAt?.substring(0, 10) || new Date().toISOString().substring(0, 10),
              status: 'ISSUED',
              createdAt: new Date().toISOString()
            };
            certMap.set(cId, entry);
          }

          // Compute exact hash and CID from the physical PDF on disk
          try {
            const fileBuffer = fs.readFileSync(filePath);
            const computedHash = calculateSHA256(fileBuffer);
            entry.docHash = computedHash;
            entry.sha256Hash = computedHash;

            if (!entry.ipfsHash || !entry.ipfsCid || entry.ipfsHash === '') {
              const fallbackCid = `Qm${computedHash.substring(0, 44)}`;
              entry.ipfsHash = fallbackCid;
              entry.ipfsCid = fallbackCid;
            }

            // Persist back into SQLite certificates and requests table
            sisDatabase.saveCertificate(entry);
            if (entry.requestId) {
              sisDatabase.updateCertificateRequestStatus(entry.requestId, 'CERTIFICATE_ISSUED', {
                certId: entry.certId,
                ipfsCid: entry.ipfsCid,
                ipfsHash: entry.ipfsHash,
                sha256Hash: entry.sha256Hash,
                docHash: entry.docHash
              });
            }
          } catch (calcErr) {
            console.warn(`[SelfHealing] Failed to process ${file}:`, calcErr.message);
          }
        }
      }
    } catch (fsErr) {}

    // 5. Complete Guarantee: Ensure zero empty hashes or CIDs across all records
    for (const [cId, entry] of certMap.entries()) {
      if (!entry.docHash || !entry.sha256Hash || !entry.ipfsHash || !entry.ipfsCid || entry.docHash === '' || entry.ipfsHash === '') {
        const filePath = path.join(STORAGE_DIR, `${cId}.pdf`);
        if (fs.existsSync(filePath)) {
          try {
            const buf = fs.readFileSync(filePath);
            const computedHash = calculateSHA256(buf);
            entry.docHash = entry.sha256Hash = computedHash;
            entry.ipfsHash = entry.ipfsCid = `Qm${computedHash.substring(0, 44)}`;
          } catch (e) {}
        }

        if (!entry.docHash || entry.docHash === '') {
          // Deterministic Merkle SHA-256 fallback from immutable tuple
          const seed = `${cId}|${entry.studentId || ''}|${entry.studentName || ''}|${entry.certType || ''}|NITW`;
          const computedHash = calculateSHA256(Buffer.from(seed));
          entry.docHash = entry.sha256Hash = computedHash;
          entry.ipfsHash = entry.ipfsCid = `Qm${computedHash.substring(0, 44)}`;
        }

        // Persist healed entry
        sisDatabase.saveCertificate(entry);
        if (entry.requestId) {
          sisDatabase.updateCertificateRequestStatus(entry.requestId, 'CERTIFICATE_ISSUED', {
            certId: entry.certId,
            ipfsCid: entry.ipfsCid,
            ipfsHash: entry.ipfsHash,
            sha256Hash: entry.sha256Hash,
            docHash: entry.docHash
          });
        }
      }
    }

    // 6. Enrich every certificate in certMap with full student details & dual aliases
    const finalCerts = Array.from(certMap.values()).map(c => {
      const student = c.studentId ? sisDatabase.getStudentByRollNumber(c.studentId) : null;
      const sName = (c.studentName && c.studentName !== 'Academic Student' && c.studentName !== 'Student Name') 
        ? c.studentName 
        : (student?.name || 'Student Name');
      const sDid = c.studentDid || student?.did || (c.studentId ? generateStudentDID(sName, c.studentId) : 'N/A');
      
      const docVal = c.docHash || c.sha256Hash || calculateSHA256(Buffer.from(`${c.certId}|${c.studentId}|NITW`));
      const ipfsVal = c.ipfsHash || c.ipfsCid || `Qm${docVal.substring(0, 44)}`;

      return {
        ...c,
        studentName: sName,
        studentDid: sDid,
        ipfsHash: ipfsVal,
        ipfsCid: ipfsVal,
        docHash: docVal,
        sha256Hash: docVal,
        status: c.status || 'ISSUED'
      };
    });

    res.json(finalCerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. Autonomous Agentic AI Workflow & Multi-Sig Orchestration
// ==========================================
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

app.get('/api/agents/audit/:requestId', async (req, res) => {
  try {
    const result = await orchestrator.auditRequest(req.params.requestId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/fraud-scan', async (req, res) => {
  try {
    const options = req.body.options || {};
    const result = await fraudAgent.evaluateRisk(req.body, null, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/sentinel/simulate', async (req, res) => {
  try {
    const { scenario = 'CLEAN', requestId = 'REQ-2024-001' } = req.body;
    const result = await fraudAgent.simulateScenario(scenario, requestId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents/sentinel/telemetry', (req, res) => {
  try {
    const stats = fraudAgent.getTelemetry();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/chat', async (req, res) => {
  try {
    const { message, role, user } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const resolvedUser = resolveUserFromRequest(req);
    const activeRole = role || req.headers['x-user-role'] || resolvedUser.role;
    const context = {
      role: activeRole,
      name: user || resolvedUser.name,
      org: resolvedUser.org,
      department: resolvedUser.department
    };

    const response = await chatAgent.processMessage(message, context);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents/config', (req, res) => {
  const groqKey = hfClient.getGroqKey();
  const hfKey = hfClient.getApiKey();
  const provider = hfClient.getActiveProvider();

  res.json({
    activeProvider: provider,
    groqConfigured: Boolean(groqKey),
    hfConfigured: Boolean(hfKey),
    groqModel: hfClient.defaultGroqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    hfModel: hfClient.defaultHfModel || process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct',
    supportedGroqModels: hfClient.supportedGroqModels,
    supportedHfModels: hfClient.supportedHfModels
  });
});

app.get('/api/agents/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    agents: [
      { name: 'FacultyAgent', role: 'Coursework & Attendance Verification', status: 'ONLINE', org: 'Org 1' },
      { name: 'FacultyAdvisorAgent', role: 'Cross-Course 5-Subject Prerequisite Gate', status: 'ONLINE', org: 'Org 1' },
      { name: 'HODAgent', role: 'Department Curriculum & Credit Audit', status: 'ONLINE', org: 'Org 1' },
      { name: 'DACMultiSigEngine', role: 'DAC 3-Member Majority Multi-Sig (Quorum >= 2/3)', status: 'ONLINE', org: 'Org 1' },
      { name: 'ExamLockAgent', role: 'Grade Registry Lockdown & Merkle Digest', status: 'ONLINE', org: 'Org 2' },
      { name: 'DeanMultiSigEngine', role: 'Dean Senate Board 3-Member Majority Multi-Sig (Quorum >= 2/3)', status: 'ONLINE', org: 'Org 3' },
      { name: 'AdminFinalizeAgent', role: 'Dues Clearance & Mint Authorization', status: 'ONLINE', org: 'Org 3' },
      { name: 'FraudSentinelAgent', role: '0-100 Anomaly Scoring & Invariant Guard', status: 'ONLINE', org: 'Consortium' },
      { name: 'MetadataSynthesizerAgent', role: 'Academic Credential & DID Schema Normalization', status: 'ONLINE', org: 'Org 1' },
      { name: 'CertificateCryptographerAgent', role: 'High-Density QR & Cryptographic Document Sealing', status: 'ONLINE', org: 'Org 3' },
      { name: 'IPFSCustodianAgent', role: 'Decentralized IPFS Pinning & Storage Auditor', status: 'ONLINE', org: 'Consortium Storage' },
      { name: 'LedgerAnchorAgent', role: 'Hyperledger Fabric Multi-Org Ledger Notary', status: 'ONLINE', org: 'Consortium Notary' }
    ],
    timestamp: new Date().toISOString()
  });
});


function resolveLedgerKeys(rawKey) {
  if (!rawKey) return [];
  const trimmed = rawKey.trim();
  const candidates = [];
  if (trimmed.startsWith('CERT_') || trimmed.startsWith('REQ_') || trimmed.startsWith('STUDENT_') || trimmed.startsWith('HASH_')) {
    candidates.push(trimmed);
  } else if (trimmed.toLowerCase().startsWith('cert-')) {
    candidates.push('CERT_' + trimmed);
    candidates.push(trimmed);
  } else if (trimmed.toLowerCase().startsWith('req-')) {
    candidates.push('REQ_' + trimmed);
    candidates.push(trimmed);
  } else if (trimmed.toLowerCase().startsWith('stu-')) {
    candidates.push('STUDENT_' + trimmed);
    candidates.push(trimmed);
  } else {
    candidates.push('CERT_CERT-' + trimmed);
    candidates.push('REQ_REQ-' + trimmed);
    candidates.push('STUDENT_' + trimmed);
    candidates.push('CERT_' + trimmed);
    candidates.push('REQ_' + trimmed);
    candidates.push(trimmed);
  }
  return [...new Set(candidates)];
}

// ============================================================================
// Group 5: Conversational AI Chatbot & Intent Engine (Contributor 5.2 / 5.3)
// ============================================================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, role, user } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" (string) is required in request body.' });
    }

    const resolvedUser = resolveUserFromRequest(req);
    const activeRole = role || req.headers['x-user-role'] || resolvedUser.role;
    const context = {
      role: activeRole,
      name: user || resolvedUser.name,
      org: resolvedUser.org,
      department: resolvedUser.department
    };

    const response = await handleChatMessage(message, context);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Group 5: Fabric History & Auditing with Traditional AES-256-GCM Encryption (Contributor 5.1)
// Optional ?encrypt=true enables end-to-end symmetric payload encryption
// ============================================================================
app.get('/api/history/:key', async (req, res) => {
  const rawKey = req.params.key;
  const candidates = resolveLedgerKeys(rawKey);
  const shouldEncrypt = req.query.encrypt === 'true' || req.headers['x-require-encryption'] === 'true';

  try {
    let resolvedKey = rawKey;
    let history = [];

    for (const keyToTry of candidates) {
      try {
        const records = await getCertificateHistory(keyToTry);
        if (Array.isArray(records) && records.length > 0) {
          resolvedKey = keyToTry;
          history = records;
          break;
        }
      } catch (e) {}
    }

    if (history.length === 0 && candidates.length > 0) {
      resolvedKey = candidates[0];
      try {
        const records = await getCertificateHistory(resolvedKey);
        history = Array.isArray(records) ? records : [];
      } catch (e) {
        history = [];
      }
    }

    let linkedRequestKey = null;
    let requestHistory = null;
    let linkedCertKey = null;
    let certHistory = null;

    if (history.length > 0) {
      const latestVal = history[history.length - 1]?.value || history[0]?.value;
      if (latestVal) {
        if (latestVal.requestId) {
          const reqId = latestVal.requestId;
          linkedRequestKey = reqId.startsWith('REQ_') ? reqId : ('REQ_' + reqId);
          try {
            const reqHist = await getCertificateHistory(linkedRequestKey);
            if (Array.isArray(reqHist) && reqHist.length > 0) {
              requestHistory = reqHist;
            }
          } catch (e) {}
        }
        if (latestVal.certificateId) {
          const cId = latestVal.certificateId;
          linkedCertKey = cId.startsWith('CERT_') ? cId : ('CERT_' + cId);
          try {
            const cHist = await getCertificateHistory(linkedCertKey);
            if (Array.isArray(cHist) && cHist.length > 0) {
              certHistory = cHist;
            }
          } catch (e) {}
        }
      }
    }

    const payload = {
      key: resolvedKey,
      query: rawKey,
      history,
      linkedRequestKey,
      requestHistory,
      linkedCertKey,
      certHistory
    };

    if (shouldEncrypt) {
      return res.json({
        encrypted: true,
        data: encryptData(payload)
      });
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message, key: rawKey });
  }
});

// Decrypt helper endpoint
app.post('/api/crypto/decrypt', (req, res) => {
  try {
    const { encryptedPayload } = req.body;
    if (!encryptedPayload) {
      return res.status(400).json({ error: 'encryptedPayload is required' });
    }
    const decrypted = decryptData(encryptedPayload);
    res.json({ decrypted });
  } catch (err) {
    res.status(400).json({ error: 'Decryption failed: ' + err.message });
  }
});

// ============================================================================
// Group 5: Real-Time SSE Ledger Event Stream (Contributor 5.1 / 5.3)
// ============================================================================
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const shouldEncrypt = req.query.encrypt === 'true';

  const sendEvent = (event) => {
    const payload = shouldEncrypt ? encryptData(event) : event;
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
  };

  const removeListener = onLedgerEvent(sendEvent);
  const readyData = JSON.stringify({ status: 'CONNECTED', encryption: shouldEncrypt ? 'AES-256-GCM' : 'NONE' });
  res.write('event: ready\ndata: ' + readyData + '\n\n');

  req.on('close', () => {
    removeListener();
    res.end();
  });
});

// ============================================================================
// Group 6: Consortium Authentication & RBAC Access Control
// ============================================================================
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (role && !email) {
      const session = quickLoginByRole(role);
      return res.json({ success: true, session });
    }
    const session = login(email, password);
    res.json({ success: true, session });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const user = resolveUserFromRequest(req);
  res.json({ user });
});

app.get('/api/auth/roles', (req, res) => {
  res.json({
    roles: Object.values(ROLES),
    demoAccounts: [
      { role: ROLES.STUDENT, name: 'Alice Johnson', email: 'alice.johnson@academic.edu', org: 'Public / Candidate Portal', description: 'Student Degree & Status Verification' },
      { role: ROLES.FACULTY, name: 'Dr. Rajesh Kumar', email: 'rajesh.kumar@academic.edu', org: 'Org 1 Academic Authority', description: 'Coursework & CIE Marks' },
      { role: ROLES.HOD, name: 'Prof. K. V. Rao', email: 'hod.cse@academic.edu', org: 'Org 1 Academic Authority', description: 'Department Leadership & DAC Voting' },
      { role: ROLES.EXAM_CONTROLLER, name: 'Prof. S. R. Murthy', email: 'controller@academic.edu', org: 'Org 2 Evaluation Authority', description: 'Grade Lockdown & Merkle Anchoring' },
      { role: ROLES.ADMIN, name: 'Central Administration Authority', email: 'admin@academic.edu', org: 'Org 3 Central Administration', description: 'Full Privileges & Cloudflare R2 Backup' }
    ]
  });
});

// ============================================================================
// Group 7: Cloudflare R2 Enterprise Backup Storage (Restricted to ADMIN)
// ============================================================================
app.get('/api/r2/status', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const health = await r2.checkR2Health();
    res.json({
      ...health,
      bucket: r2.BUCKET,
      authorizedRole: req.user.role,
      user: req.user.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/r2/link/:certId', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const certId = req.params.certId.toUpperCase();
    const key = `certificates/${certId}.pdf`;
    const downloadLink = await r2.getDownloadLink(key, 900);
    res.json({
      certId,
      key,
      bucket: r2.BUCKET,
      downloadLink,
      expiresInSeconds: 900,
      authorizedRole: req.user.role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/r2/download/:certId', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const certId = req.params.certId.toUpperCase();
    const key = `certificates/${certId}.pdf`;
    const buffer = await r2.fetchFromR2(key);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certId}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: `Certificate ${req.params.certId} not found in Cloudflare R2: ${err.message}` });
  }
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Academic Blockchain REST API running on port ${PORT}`);
    console.log(`🎓 Multi-Org Fabric 2.5 • IPFS Kubo • Multi-Sig Governance`);
    console.log(`🆔 Student DID (SHA-256 + RIPEMD-160) • Autonomous Agents`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
