/**
 * Group 1 Integrated Master Test Suite
 * Covers Contributors 1.1, 1.2, and 1.3
 */

const assert = require('assert');
const AcademicContract = require('./chaincode/academic-contract/index.js');
const { evaluatePrerequisites, calculateAcademicStanding } = require('./backend/src/rules/prerequisites');
const { validateStudentInput, validateRequestInput } = require('./backend/src/validators/schemaValidator');
const { runOrg1DepartmentPipeline, Org1AcademicAutonomousAgent } = require('./backend/src/agents/orgAgents');
const crypto = require('crypto');

// Mock Fabric Stub
class MockStub {
  constructor() {
    this.state = new Map();
  }
  async getState(key) {
    return this.state.get(key) || Buffer.from('');
  }
  async putState(key, val) {
    this.state.set(key, Buffer.from(val));
  }
  async getStateByRange(start, end) {
    const entries = [];
    for (const [k, v] of this.state.entries()) {
      if (k >= start && k <= end) {
        entries.push({ value: v });
      }
    }
    let idx = 0;
    return {
      next: async () => {
        if (idx < entries.length) {
          return { value: entries[idx++], done: false };
        }
        return { done: true };
      },
      close: async () => {}
    };
  }
  getTxTimestamp() {
    return { seconds: { low: Math.floor(Date.now() / 1000) } };
  }
}

class MockContext {
  constructor(mspId = 'Org1MSP') {
    this.stub = new MockStub();
    this.clientIdentity = {
      getMSPID: () => mspId
    };
  }
}

async function runGroup1Tests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING GROUP 1 INTEGRATED TEST SUITE (1.1, 1.2, 1.3)');
  console.log('===============================================================');

  const contract = new AcademicContract();
  const ctx = new MockContext('Org1MSP');

  // --- SECTION 1: Contributor 1.1 Chaincode & Crypto Tests ---
  console.log('\n--- [Contributor 1.1: Academic Chaincode Lead] ---');

  // 1.1 Test: Keypair and Register Student
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const studentProfile = {
    cgpa: 9.75,
    attendance: 92.0,
    totalCredits: 164,
    requiredCredits: 160,
    backlogs: 0,
    completedCourses: ['CS101', 'CS102', 'CS201', 'CS202', 'CS301'],
    publicKeyPem: publicKey
  };

  const regRes = await contract.RegisterStudent(
    ctx, 'STU-G1-001', 'Ananya Roy', 'ananya@academic.edu',
    'Department of Computer Science & Engineering', '2024',
    JSON.stringify(studentProfile)
  );
  const regObj = JSON.parse(regRes);
  assert.strictEqual(regObj.academicRecord.honors, 'SUMMA_CUM_LAUDE');
  assert.strictEqual(Boolean(regObj.publicKeyPem), true);
  console.log('  ✅ PASS: RegisterStudent successfully registers with Latin Honors and ECDSA key');

  // 1.2 Test: Signed RequestCertificate
  const reqPayload = 'STU-G1-001:REQ-G1-001:B.Tech CSE:2026-11-19T10:00:00Z';
  const signer = crypto.createSign('SHA256');
  signer.update(reqPayload);
  signer.end();
  const signatureBase64 = signer.sign(privateKey, 'base64');

  const reqDetails = {
    attendance: 92.0,
    cgpa: 9.75,
    totalCredits: 164,
    requiredCredits: 160,
    backlogs: 0,
    studentSignature: signatureBase64,
    signatureTimestamp: '2026-11-19T10:00:00Z',
    department: 'Department of Computer Science & Engineering'
  };

  const reqRes = await contract.RequestCertificate(
    ctx, 'REQ-G1-001', 'STU-G1-001', 'B.Tech CSE', JSON.stringify(reqDetails)
  );
  const reqObj = JSON.parse(reqRes);
  assert.strictEqual(reqObj.digitalSignature.verified, true);
  assert.strictEqual(reqObj.status, 'SUBMITTED');
  assert.strictEqual(Boolean(reqObj.academicSnapshot.transcriptDigest), true);
  console.log('  ✅ PASS: RequestCertificate validates ECDSA signature and seals transcript digest');

  // --- SECTION 2: Contributor 1.2 CouchDB Rich Queries & Multi-Level Approvals ---
  console.log('\n--- [Contributor 1.2: CouchDB State & Identity Lead] ---');

  // Register second student in another department
  await contract.RegisterStudent(
    ctx, 'STU-G1-002', 'Rohan Verma', 'rohan@academic.edu',
    'Department of Electrical Engineering', '2024',
    JSON.stringify({ cgpa: 8.8, attendance: 85.0, backlogs: 0, totalCredits: 160 })
  );

  // 2.1 Test: QueryStudentsByDepartment
  const cseStudentsRaw = await contract.QueryStudentsByDepartment(ctx, 'Computer Science');
  const cseStudents = JSON.parse(cseStudentsRaw);
  assert.strictEqual(cseStudents.length >= 1, true);
  assert.strictEqual(cseStudents[0].studentId, 'STU-G1-001');
  console.log('  ✅ PASS: QueryStudentsByDepartment executes CouchDB department query');

  // 2.2 Test: QueryStudentsByHonors
  const summaStudentsRaw = await contract.QueryStudentsByHonors(ctx, 'SUMMA_CUM_LAUDE');
  const summaStudents = JSON.parse(summaStudentsRaw);
  assert.strictEqual(summaStudents.length >= 1, true);
  assert.strictEqual(summaStudents[0].studentId, 'STU-G1-001');
  console.log('  ✅ PASS: QueryStudentsByHonors filters students by Latin Honors');

  // 2.3 Test: GetDepartmentSummaryMetrics
  const metricsRaw = await contract.GetDepartmentSummaryMetrics(ctx, 'Computer Science');
  const metrics = JSON.parse(metricsRaw);
  assert.strictEqual(metrics.totalRegisteredStudents >= 1, true);
  assert.strictEqual(metrics.honorsBreakdown.SUMMA_CUM_LAUDE >= 1, true);
  console.log('  ✅ PASS: GetDepartmentSummaryMetrics aggregates department analytics');

  // 2.4 Test: Multi-Level Approvals (Faculty -> HOD -> DAC MultiSig)
  await contract.ApproveFaculty(ctx, 'REQ-G1-001', 'FACULTY_CS_01', 'Coursework verified');
  await contract.ApproveHOD(ctx, 'REQ-G1-001', 'HOD_CS_01', 'Department NOC approved');
  await contract.ApproveDACMultiSig(ctx, 'REQ-G1-001', 'DAC_MEMBER_1', 'SIG_DAC_1', 'Recommended');
  const dacFinal = await contract.ApproveDACMultiSig(ctx, 'REQ-G1-001', 'DAC_MEMBER_2', 'SIG_DAC_2', 'Approved');
  const dacObj = JSON.parse(dacFinal);
  assert.strictEqual(dacObj.status, 'DAC_APPROVED');
  console.log('  ✅ PASS: Multi-level departmental approval pipeline achieves DAC_APPROVED');

  // --- SECTION 3: Contributor 1.3 Org 1 Academic Autonomous Agent ---
  console.log('\n--- [Contributor 1.3: Org 1 Academic Agent Lead] ---');

  const autonomousAgent = new Org1AcademicAutonomousAgent();
  assert.strictEqual(autonomousAgent.org, 'Org1MSP');

  // 3.1 Test: Pre-Mint Readiness Verification
  const readiness = await autonomousAgent.verifyPreMintReadiness('REQ-G1-001', regObj);
  assert.strictEqual(readiness.readyForMinting, true);
  assert.strictEqual(readiness.checklist.registeredPublicKey, true);
  console.log('  ✅ PASS: Org1AcademicAutonomousAgent verifies pre-mint readiness for Group 4');

  // 3.2 Test: Pipeline Execution with Sentinel Handshake
  const pipelineResult = await runOrg1DepartmentPipeline('REQ-G1-AUTONOMOUS', {
    name: 'Ananya Roy',
    department: 'Department of Computer Science & Engineering',
    cgpa: 9.75,
    attendance: 92.0,
    backlogs: 0
  });
  assert.strictEqual(pipelineResult.success, true);
  assert.strictEqual(pipelineResult.currentStage, 'DAC_APPROVED');
  console.log('  ✅ PASS: runOrg1DepartmentPipeline successfully executes with Sentinel Handshake');

  console.log('\n===============================================================');
  console.log('🎉 ALL GROUP 1 TESTS (1.1, 1.2, 1.3) PASSED SUCCESSFULLY!');
  console.log('===============================================================');
}

runGroup1Tests().catch(err => {
  console.error('❌ Test Failure:', err);
  process.exit(1);
});
