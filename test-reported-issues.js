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
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.send = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.end = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };

    req.body = body;
    app(req, res);
  });
}

async function runTests() {
  console.log('🧪 Starting Verification of User-Reported Issues...\n');

  // =========================================================================
  // Test 1: Faculty Advisor Sign & Forward State Persistence
  // =========================================================================
  console.log('--> [Test 1] Testing Faculty Advisor Sign & Forward...');
  const studentId = 'STU-2024-001';
  const preAudit = sis.getStudentComprehensiveAudit(studentId);
  assert.ok(preAudit.isEligible, 'Alice Johnson must be eligible');

  const faSignRes = await mockRequest('POST', '/api/faculty-advisor/sign-eligible', {
    studentId,
    requestId: preAudit.requestId || 'REQ-2024-001',
    comments: 'Verified by FA'
  });

  assert.strictEqual(faSignRes.status, 200);
  assert.strictEqual(faSignRes.body.success, true);
  assert.ok(faSignRes.body.faSignature, 'Must return cryptographic FA signature');
  assert.ok(faSignRes.body.requestId, 'Must return real requestId');

  // Verify that getStudentComprehensiveAudit now reflects faSigned: true
  const postAudit = sis.getStudentComprehensiveAudit(studentId);
  assert.strictEqual(postAudit.faSigned, true, 'postAudit.faSigned must be true');
  assert.strictEqual(postAudit.requestId, faSignRes.body.requestId);
  console.log(`   ✅ FA sign-eligible succeeded for ${studentId}. Request: ${postAudit.requestId}, faSigned: ${postAudit.faSigned}`);

  // Check request status in database
  const reqObj = sis.getCertificateRequest(postAudit.requestId);
  assert.strictEqual(reqObj.status, 'FA_APPROVED');
  console.log(`   ✅ SQLite request status successfully updated to: ${reqObj.status}`);

  // =========================================================================
  // Test 2: Ledger Explorer Name & PDF
  // =========================================================================
  console.log('\n--> [Test 2] Testing Ledger Explorer Certificates & PDF Retrieval...');
  const certsRes = await mockRequest('GET', '/api/certificates');
  assert.strictEqual(certsRes.status, 200);
  assert.ok(Array.isArray(certsRes.body), 'Certificates must be an array');
  assert.ok(certsRes.body.length > 0, 'Should have at least 1 certificate');

  for (const c of certsRes.body) {
    assert.ok(c.certId, 'Cert ID must exist');
    assert.ok(c.studentId, 'Student ID must exist');
    assert.ok(c.studentName && c.studentName !== '', `Student Name must exist for ${c.certId}`);
    assert.ok(c.studentDid && c.studentDid.startsWith('did:academic:'), `Student DID must exist for ${c.certId}`);
    console.log(`   ✅ Cert: ${c.certId} | Student: ${c.studentName} (${c.studentId}) | DID: ${c.studentDid.substring(0, 22)}...`);
  }

  // Test PDF retrieval for the first cert
  const testCertId = certsRes.body[0].certId;
  const pdfRes = await mockRequest('GET', `/api/certificates/${testCertId}/pdf`);
  assert.strictEqual(pdfRes.status, 200);
  assert.strictEqual(pdfRes.headers['Content-Type'], 'application/pdf');
  assert.ok(Buffer.isBuffer(pdfRes.body) && pdfRes.body.length > 1000, 'Must return valid PDF buffer > 1KB');
  console.log(`   ✅ PDF stream for ${testCertId} returned ${pdfRes.body.length} bytes with Content-Type: application/pdf`);

  // =========================================================================
  // Test 3: Registering Student Not Originally in the DB
  // =========================================================================
  console.log('\n--> [Test 3] Testing Registration of Student NOT in DB...');
  const newStudentId = `STU-NEW-${Date.now().toString().slice(-4)}`;
  const newName = 'Aarav Patel';
  const newEmail = 'aarav.patel@academic.edu';
  const newDept = 'Department of Computer Science & Engineering';

  const regRes = await mockRequest('POST', '/api/students', {
    studentId: newStudentId,
    name: newName,
    email: newEmail,
    department: newDept,
    branch: 'Master of Computer Applications (MCA)',
    semester: 'Semester 5',
    courses: [
      { course_id: 'CS501', course_name: 'Distributed Systems & Cloud Computing', credits: 4 },
      { course_id: 'CS502', course_name: 'Blockchain Architecture & Consensus Protocols', credits: 4 }
    ]
  });

  assert.strictEqual(regRes.status, 201);
  assert.strictEqual(regRes.body.success, true);
  assert.strictEqual(regRes.body.name, newName);
  assert.strictEqual(regRes.body.studentId, newStudentId);
  assert.ok(regRes.body.did && regRes.body.did.startsWith('did:academic:'));
  console.log(`   ✅ Registered new student: ${newName} (${newStudentId}) with DID: ${regRes.body.did}`);

  // Now verify that GET /api/students returns this student with Name and DID
  const studentsRes = await mockRequest('GET', '/api/students');
  assert.strictEqual(studentsRes.status, 200);
  const found = studentsRes.body.find(s => s.studentId === newStudentId);
  assert.ok(found, `New student ${newStudentId} must be present in GET /api/students`);
  assert.strictEqual(found.name, newName, 'Name must match');
  assert.strictEqual(found.did, regRes.body.did, 'DID must match');
  assert.strictEqual(found.isOnLedger, true, 'isOnLedger must be true');
  console.log(`   ✅ GET /api/students verified: ${found.name} | ${found.studentId} | ${found.did} | On-Ledger: ${found.isOnLedger}`);

  console.log('\n🎉 ALL 3 USER-REPORTED ISSUES HAVE BEEN FULLY RESOLVED AND VERIFIED!\n');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
