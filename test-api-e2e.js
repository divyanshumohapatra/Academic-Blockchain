'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const app = require('./backend/src/server');
const sis = require('./backend/src/db/sisDatabase');

function mockRequest(method, url, body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json' };
    
    let statusCode = 200;
    const resHeaders = {};

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k] = v; };
    res.getHeader = (k) => resHeaders[k];
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resolve({ status: statusCode, body: data });
    };
    res.send = (data) => {
      resolve({ status: statusCode, body: data });
    };
    res.end = (data) => {
      resolve({ status: statusCode, body: data });
    };

    req.body = body;
    app(req, res);
  });
}

async function runApiIntegrationTests() {
  console.log('🚀 Starting API End-to-End Integration Tests (In-Memory Express Pipeline)...\n');

  // -------------------------------------------------------------------------
  // Test 1: Verify GET /api/semester-registrations
  // -------------------------------------------------------------------------
  console.log('--> [API Test 1] Testing GET /api/semester-registrations...');
  const semRegsRes = await mockRequest('GET', '/api/semester-registrations');
  assert.strictEqual(semRegsRes.status, 200);
  assert.ok(Array.isArray(semRegsRes.body));
  assert.ok(semRegsRes.body.length >= 5);
  console.log(`   ✅ Returned ${semRegsRes.body.length} student semester registrations.`);

  const aliceRegRes = await mockRequest('GET', '/api/students/STU-2024-001/semester-registration');
  assert.strictEqual(aliceRegRes.status, 200);
  assert.strictEqual(aliceRegRes.body.department, 'Department of Computer Science & Engineering');
  assert.strictEqual(aliceRegRes.body.branch, 'Master of Computer Applications (MCA)');
  assert.strictEqual(aliceRegRes.body.registeredCourses.length, 5);
  console.log(`   ✅ Alice Johnson: Dept = "${aliceRegRes.body.department}", Branch = "${aliceRegRes.body.branch}", 5 courses.`);

  // -------------------------------------------------------------------------
  // Test 2: Database vs Ledger Distinction on Certificate Request
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 2] Testing Ledger requirement for Certificate Requests...');
  // Ensure STU-2024-BACKLOG is off-ledger (is_on_ledger = 0)
  sis.db.prepare('UPDATE students SET is_on_ledger = 0, registered_on_ledger_at = NULL WHERE student_id = ?').run('STU-2024-BACKLOG');

  const blockedReqRes = await mockRequest('POST', '/api/requests', {
    requestId: 'REQ-TEST-BLOCKED',
    studentId: 'STU-2024-BACKLOG',
    certType: 'Master of Computer Applications (MCA)',
    department: 'Department of Computer Science & Engineering'
  });
  console.log('   Response status for un-registered student:', blockedReqRes.status);
  console.log('   Response error message:', blockedReqRes.body.error);
  assert.strictEqual(blockedReqRes.status, 400, 'Must return 400 for student not on ledger');
  assert.match(blockedReqRes.body.error, /Ledger Verification Failed.*NOT been registered on the blockchain ledger/i);
  console.log('   ✅ Off-ledger certificate request correctly rejected with 400.');

  // -------------------------------------------------------------------------
  // Test 3: Register Student on Ledger via POST /api/students
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 3] Registering student on blockchain ledger via POST /api/students...');
  const regRes = await mockRequest('POST', '/api/students', {
    studentId: 'STU-2024-001',
    name: 'Alice Johnson',
    email: 'alice@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollmentYear: '2024'
  });
  assert.strictEqual(regRes.status, 201);
  assert.strictEqual(regRes.body.success, true);
  assert.strictEqual(regRes.body.isOnLedger, true);
  assert.match(regRes.body.did, /^did:academic:[0-9a-f]{40}$/);
  console.log(`   ✅ Alice registered on ledger with DID: ${regRes.body.did}`);

  // Check GET /api/students (only ledger students returned)
  const ledgerStudentsRes = await mockRequest('GET', '/api/students');
  assert.strictEqual(ledgerStudentsRes.status, 200);
  assert.ok(ledgerStudentsRes.body.some(s => s.studentId === 'STU-2024-001'));
  console.log(`   ✅ GET /api/students includes Alice Johnson on ledger.`);

  // -------------------------------------------------------------------------
  // Test 4: Branch Mismatch Validation
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 4] Testing Branch Mismatch Rejection...');
  // Alice is in MCA. Submitting with B.Tech CSE should fail.
  const mismatchBranchRes = await mockRequest('POST', '/api/requests', {
    requestId: 'REQ-TEST-MISMATCH',
    studentId: 'STU-2024-001',
    certType: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
    department: 'Department of Computer Science & Engineering'
  });
  console.log('   Status for branch mismatch:', mismatchBranchRes.status);
  console.log('   Error message:', mismatchBranchRes.body.error);
  assert.strictEqual(mismatchBranchRes.status, 400);
  assert.match(mismatchBranchRes.body.error, /Branch Mismatch/i);
  console.log('   ✅ Branch mismatch correctly blocked with 400.');

  // -------------------------------------------------------------------------
  // Test 5: Department Mismatch Validation
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 5] Testing Department Mismatch Rejection...');
  const mismatchDeptRes = await mockRequest('POST', '/api/requests', {
    requestId: 'REQ-TEST-MISMATCH-DEPT',
    studentId: 'STU-2024-001',
    certType: 'Master of Computer Applications (MCA)',
    department: 'Department of Mechanical Engineering'
  });
  console.log('   Status for dept mismatch:', mismatchDeptRes.status);
  console.log('   Error message:', mismatchDeptRes.body.error);
  assert.strictEqual(mismatchDeptRes.status, 400);
  assert.match(mismatchDeptRes.body.error, /Department Mismatch/i);
  console.log('   ✅ Department mismatch correctly blocked with 400.');

  // -------------------------------------------------------------------------
  // Test 6: Successful Certificate Request Submission with Matching Credentials
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 6] Testing Successful Certificate Request with Matching Branch...');
  const validReqRes = await mockRequest('POST', '/api/requests', {
    requestId: 'REQ-TEST-VALID-001',
    studentId: 'STU-2024-001',
    certType: 'Master of Computer Applications (MCA)',
    department: 'Department of Computer Science & Engineering'
  });
  console.log('   Status for valid submission:', validReqRes.status);
  assert.strictEqual(validReqRes.status, 201);
  assert.strictEqual(validReqRes.body.success, true);
  assert.match(validReqRes.body.did, /^did:academic:[0-9a-f]{40}$/);
  console.log('   ✅ Certificate request accepted with valid DID and matching academic credentials.');

  // -------------------------------------------------------------------------
  // Test 7: Simultaneous Faculty Marks Submission
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 7] Testing Simultaneous Faculty Marks Ingestion...');
  const simultaneousRes = await mockRequest('POST', '/api/faculty/courses/CS501/marks/manual', {
    facultyId: 'FAC-001',
    marks: [
      { studentId: 'STU-2024-001', cieMarks: 48, labMarks: 24, attendance: 95, endsemMarks: 46 },
      { studentId: 'STU-2024-002', cieMarks: 40, labMarks: 20, attendance: 85, endsemMarks: 40 }
    ]
  });
  assert.strictEqual(simultaneousRes.status, 200);
  assert.strictEqual(simultaneousRes.body.success, true);
  assert.strictEqual(simultaneousRes.body.updatedCount, 2);
  console.log(`   ✅ Simultaneously updated ${simultaneousRes.body.updatedCount} students' marks.`);

  // -------------------------------------------------------------------------
  // Test 8: Testing Exam Lockdown on REQ-2024-001 (Zero Endorsement Crash)
  // -------------------------------------------------------------------------
  console.log('\n--> [API Test 8] Testing POST /api/workflow/exam-lock on REQ-2024-001...');
  const examLockRes = await mockRequest('POST', '/api/workflow/exam-lock', {
    requestId: 'REQ-2024-001',
    examOfficerId: 'ExamController-01',
    gradesHash: 'GRADES_SHA256_' + Date.now(),
    comments: 'Exam grades verified and locked'
  });
  console.log('   Status for exam-lock:', examLockRes.status);
  console.log('   Response body:', JSON.stringify(examLockRes.body));
  assert.strictEqual(examLockRes.status, 200, 'exam-lock must return 200 OK');
  assert.strictEqual(examLockRes.body.success, true, 'exam-lock must be successful');
  const reqInDb = sis.getCertificateRequest('REQ-2024-001');
  assert.strictEqual(reqInDb.status, 'EXAM_LOCKED', 'Status must be updated to EXAM_LOCKED in database');
  console.log('   ✅ Exam grades successfully locked on REQ-2024-001 with zero endorsement crashes.');

  console.log('\n🎉 ALL 8 API END-TO-END INTEGRATION TESTS PASSED FLIGHT TESTS!');
}

runApiIntegrationTests().catch(err => {
  console.error('\n❌ API Integration Test Failed:', err);
  process.exit(1);
});
