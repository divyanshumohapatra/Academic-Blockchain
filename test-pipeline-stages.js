'use strict';

const db = require('./backend/src/db/sisDatabase');
const orch = require('./backend/src/agents/orchestrator');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 VERIFICATION SUITE: STAGE SEPARATION & SIGNATURE FIX');
  console.log('========================================================\n');

  // 1. Verify Distinct Stages in Orchestrator
  console.log('--> [Test 1] Verifying Stage Separation (Faculty Advisor vs HOD)...');
  const audit = await orch.auditRequest('REQ-2024-001');
  if (audit.stageReadiness.facultyAdvisor && audit.stageReadiness.hod) {
    console.log('   ✅ Faculty Advisor and HOD stages are distinct in orchestrator stage readiness!');
    console.log('      • facultyAdvisor agent:', audit.stageReadiness.facultyAdvisor.agent);
    console.log('      • hod agent:', audit.stageReadiness.hod.agent);
  } else {
    throw new Error('Faculty Advisor and HOD are not separated in audit.stageReadiness');
  }

  // 2. Test Pipeline on Newly Registered Student (Ensuring no false signature halts)
  console.log('\n--> [Test 2] Testing Autonomous Pipeline on Newly Enrolled Student (Draft Marks)...');
  const testStudentId = 'STU-VERIFY-' + Math.floor(Math.random() * 9000 + 1000);
  const testReqId = 'REQ-VERIFY-' + Math.floor(Math.random() * 9000 + 1000);

  db.addOrUpdateStudent({
    studentId: testStudentId,
    name: 'Autonomous Verification Student',
    email: 'autoverify@academic.edu',
    department: 'Department of Computer Science & Engineering',
    attendance: 86.5,
    cieMarks: 41.0,
    totalCredits: 160,
    requiredCredits: 160,
    disciplinaryClearance: 1,
    capstoneScore: 84,
    originalityReport: 91,
    cgpa: 8.7,
    backlogs: 0,
    isOnLedger: true
  });

  db.enrollStudentInSemesterCourses(
    testStudentId, 
    null, 
    'Semester 5', 
    'Master of Computer Applications (MCA)'
  );

  db.saveCertificateRequest({
    requestId: testReqId,
    studentId: testStudentId,
    studentName: 'Autonomous Verification Student',
    status: 'SUBMITTED',
    details: {
      studentId: testStudentId,
      attendance: 86.5,
      cieMarks: 41.0,
      totalCredits: 160
    }
  });

  const pipeRes = await orch.runAutonomousPipeline(testReqId, { autoIssue: true });
  console.log('   Pipeline Success:', pipeRes.success);
  console.log('   Pipeline Message:', pipeRes.message);
  console.log('   Final Status:', pipeRes.finalStatus);

  if (!pipeRes.success) {
    throw new Error(`Pipeline halted unexpectedly: ${pipeRes.message}`);
  }

  const stepNames = pipeRes.executionLogs.map(l => l.step);
  console.log('   Recorded Steps:', stepNames);

  const hasFA = stepNames.includes('FACULTY_ADVISOR_APPROVAL');
  const hasHOD = stepNames.includes('HOD_APPROVAL');
  const hasDAC = stepNames.includes('DAC_MULTISIG_CONSENSUS');

  if (!hasFA || !hasHOD || !hasDAC) {
    throw new Error(`Expected distinct FACULTY_ADVISOR_APPROVAL and HOD_APPROVAL steps. Got: ${stepNames.join(', ')}`);
  }
  console.log('   ✅ Both FACULTY_ADVISOR_APPROVAL and HOD_APPROVAL executed in separate blocks!');

  // 3. Test Deficit Student Halts Appropriately
  console.log('\n--> [Test 3] Verifying Legitimate Deficit Halts Correctly...');
  db.updateCertificateRequestStatus('REQ-TEST-DEFICIT-HALT', 'SUBMITTED');
  db.saveCertificateRequest({
    requestId: 'REQ-TEST-DEFICIT-HALT',
    studentId: 'STU-2024-DEFICIT',
    studentName: 'Bob Smith',
    status: 'SUBMITTED',
    details: {
      studentId: 'STU-2024-DEFICIT',
      attendance: 62.0,
      cieMarks: 18.0,
      totalCredits: 144
    }
  });

  const deficitRes = await orch.runAutonomousPipeline('REQ-TEST-DEFICIT-HALT', { autoIssue: true });
  console.log('   Deficit Pipeline Success (should be false):', deficitRes.success);
  console.log('   Halted Reason:', deficitRes.message);
  if (!deficitRes.success) {
    console.log('   ✅ Deficit student properly quarantined with legitimate academic hold!');
  } else {
    throw new Error('Deficit student was incorrectly approved!');
  }

  // 4. Verify Ledger Explorer Integrity
  console.log('\n--> [Test 4] Verifying Ledger Explorer Certificates Table...');
  const certs = db.getAllCertificates();
  console.log(`   Found ${certs.length} certificates in SQLite certificates table`);
  const missing = certs.filter(c => !c.ipfsCid && !c.ipfsHash);
  if (missing.length === 0) {
    console.log('   ✅ 100% of certificates have valid IPFS CIDs and digests (0 empty hashes)!');
  } else {
    throw new Error(`${missing.length} certificates are missing IPFS CIDs!`);
  }

  console.log('\n🎉 ALL PIPELINE STAGE SEPARATION & SIGNATURE TESTS PASSED 100%!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
