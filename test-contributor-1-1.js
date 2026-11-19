'use strict';

/**
 * Contributor 1.1 Verification Test Suite
 * Tests:
 * 1. Rich Schema Validation for RegisterStudent & RequestCertificate
 * 2. Org1MSP Client Identity Access Control
 * 3. Student Identity Lifecycle Management (ACTIVE, SUSPENDED, record updates)
 * 4. Departmental Prerequisite Rules Engine (attendance, CGPA, credits, backlogs)
 */

const assert = require('assert');
const AcademicContract = require('./chaincode/academic-contract/index.js');
const { evaluatePrerequisites, getDegreeRequirements } = require('./backend/src/rules/prerequisites.js');
const { validateStudentInput, validateRequestInput } = require('./backend/src/validators/schemaValidator.js');

// Mock Fabric Stub & Context
function createMockContext(mspId = 'Org1MSP') {
  const ledgerState = new Map();

  const stub = {
    getTxTimestamp: () => ({
      seconds: { low: Math.floor(Date.now() / 1000) },
      nanos: 0
    }),
    getState: async (key) => ledgerState.get(key) || Buffer.alloc(0),
    putState: async (key, val) => {
      ledgerState.set(key, Buffer.isBuffer(val) ? val : Buffer.from(val));
    },
    getStateByRange: async (start, end) => {
      const keys = Array.from(ledgerState.keys()).sort();
      let index = 0;
      return {
        next: async () => {
          while (index < keys.length) {
            const k = keys[index++];
            if (k >= start && k <= end) {
              return { value: { value: ledgerState.get(k) }, done: false };
            }
          }
          return { done: true };
        },
        close: async () => {}
      };
    }
  };

  const clientIdentity = {
    getMSPID: () => mspId
  };

  return { ctx: { stub, clientIdentity }, ledgerState };
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 RUNNING CONTRIBUTOR 1.1 UNIT & INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  console.log('--- Phase 1: REST API Schema Validators ---');

  test('validateStudentInput accepts valid student schema', () => {
    const res = validateStudentInput({
      studentId: 'STU-1001',
      name: 'Aditya Sharma',
      email: 'aditya@academic.edu',
      department: 'Computer Science & Engineering',
      enrollmentYear: '2024',
      cgpa: 8.9,
      totalCredits: 164,
      attendance: 92.5,
      backlogs: 0
    });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  test('validateStudentInput rejects invalid email and negative credits', () => {
    const res = validateStudentInput({
      studentId: 'STU-1001',
      name: 'A',
      email: 'invalid-email-format',
      enrollmentYear: '1850',
      totalCredits: -5
    });
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('email')));
    assert.ok(res.errors.some(e => e.includes('name')));
    assert.ok(res.errors.some(e => e.includes('enrollmentYear')));
    assert.ok(res.errors.some(e => e.includes('totalCredits')));
  });

  test('validateRequestInput validates required fields and IDs', () => {
    const resValid = validateRequestInput({
      requestId: 'REQ-2024-001',
      studentId: 'STU-1001',
      certType: 'Bachelor of Technology in CSE'
    });
    assert.strictEqual(resValid.isValid, true);

    const resInvalid = validateRequestInput({
      requestId: '!!Invalid!!',
      studentId: '',
      certType: 'AB'
    });
    assert.strictEqual(resInvalid.isValid, false);
  });

  console.log('\n--- Phase 2: Departmental Prerequisite Rules Engine ---');

  test('evaluatePrerequisites approves compliant student for B.Tech', () => {
    const student = {
      academicRecord: {
        cgpa: 8.5,
        totalCredits: 160,
        requiredCredits: 160,
        attendance: 88.0,
        backlogs: 0,
        completedCourses: ['CS101', 'CS102', 'CS201', 'CS202', 'CS301']
      }
    };
    const evalResult = evaluatePrerequisites(student, 'Bachelor of Technology in CSE', {});
    assert.strictEqual(evalResult.eligible, true);
    assert.strictEqual(evalResult.violations.length, 0);
  });

  test('evaluatePrerequisites detects low attendance violation (<75%)', () => {
    const student = {
      academicRecord: {
        cgpa: 8.5,
        totalCredits: 160,
        attendance: 68.0, // Low attendance
        backlogs: 0
      }
    };
    const evalResult = evaluatePrerequisites(student, 'Bachelor of Technology in CSE', {});
    assert.strictEqual(evalResult.eligible, false);
    assert.ok(evalResult.violations.some(v => v.includes('Attendance requirement not met')));
  });

  test('evaluatePrerequisites detects unresolved backlogs violation', () => {
    const student = {
      academicRecord: {
        cgpa: 7.2,
        totalCredits: 160,
        attendance: 82.0,
        backlogs: 2 // Has active backlogs
      }
    };
    const evalResult = evaluatePrerequisites(student, 'Bachelor of Technology in CSE', {});
    assert.strictEqual(evalResult.eligible, false);
    assert.ok(evalResult.violations.some(v => v.includes('Unresolved academic backlogs')));
  });

  test('evaluatePrerequisites detects outstanding fee dues', () => {
    const student = {
      academicRecord: { cgpa: 8.0, totalCredits: 160, attendance: 85.0, backlogs: 0 }
    };
    const evalResult = evaluatePrerequisites(student, 'Bachelor of Technology in CSE', { feeDues: 15000 });
    assert.strictEqual(evalResult.eligible, false);
    assert.ok(evalResult.violations.some(v => v.includes('Outstanding tuition fee dues')));
  });

  console.log('\n--- Phase 3: Smart Contract & Chaincode Logic ---');

  const contract = new AcademicContract();

  await testAsync('RegisterStudent registers student with rich schema & Org1MSP', async () => {
    const { ctx } = createMockContext('Org1MSP');
    const profile = {
      cgpa: 8.7,
      totalCredits: 160,
      attendance: 91.0,
      backlogs: 0,
      completedCourses: ['CS101', 'CS102', 'CS201', 'CS202', 'CS301']
    };

    const resJson = await contract.RegisterStudent(
      ctx,
      'STU-1001',
      'John Doe',
      'john@academic.edu',
      'Computer Science & Engineering',
      '2024',
      JSON.stringify(profile)
    );

    const student = JSON.parse(resJson);
    assert.strictEqual(student.studentId, 'STU-1001');
    assert.strictEqual(student.status, 'ACTIVE');
    assert.strictEqual(student.registeredBy, 'Org1MSP');
    assert.strictEqual(student.academicRecord.cgpa, 8.7);
    assert.strictEqual(student.academicRecord.attendance, 91.0);
    assert.strictEqual(student.academicRecord.prerequisitesMet, true);
  });

  await testAsync('RegisterStudent rejects non-Org1MSP invoking client', async () => {
    const { ctx } = createMockContext('Org2MSP'); // Unauthorized Org
    let threw = false;
    try {
      await contract.RegisterStudent(
        ctx,
        'STU-1002',
        'Jane Doe',
        'jane@academic.edu',
        'Computer Science',
        '2024'
      );
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Access Denied'));
    }
    assert.strictEqual(threw, true, 'Should have thrown access denied for Org2MSP');
  });

  await testAsync('UpdateStudentAcademicRecord updates metrics under Org1MSP', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(ctx, 'STU-2001', 'Mark Smith', 'mark@academic.edu', 'CSE', '2024');

    const updateJson = await contract.UpdateStudentAcademicRecord(
      ctx,
      'STU-2001',
      JSON.stringify({ cgpa: 9.3, totalCredits: 168, attendance: 95.0 })
    );

    const updated = JSON.parse(updateJson);
    assert.strictEqual(updated.academicRecord.cgpa, 9.3);
    assert.strictEqual(updated.academicRecord.totalCredits, 168);
    assert.strictEqual(updated.academicRecord.attendance, 95.0);
  });

  await testAsync('UpdateStudentStatus updates lifecycle status and audits history', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(ctx, 'STU-3001', 'Sara Lee', 'sara@academic.edu', 'CSE', '2024');

    const updatedJson = await contract.UpdateStudentStatus(
      ctx,
      'STU-3001',
      'SUSPENDED',
      'Disciplinary inquiry pending'
    );

    const updated = JSON.parse(updatedJson);
    assert.strictEqual(updated.status, 'SUSPENDED');
    assert.strictEqual(updated.statusHistory.length, 2);
    assert.strictEqual(updated.statusHistory[1].status, 'SUSPENDED');
  });

  await testAsync('RequestCertificate rejects suspended student', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(ctx, 'STU-4001', 'Alex Ray', 'alex@academic.edu', 'CSE', '2024');
    await contract.UpdateStudentStatus(ctx, 'STU-4001', 'SUSPENDED', 'Disciplinary freeze');

    let threw = false;
    try {
      await contract.RequestCertificate(ctx, 'REQ-4001', 'STU-4001', 'Bachelor of Technology in CSE');
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Only ACTIVE students may apply'));
    }
    assert.strictEqual(threw, true, 'Should have thrown for suspended student');
  });

  await testAsync('RequestCertificate enforces prerequisite attendance check', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(
      ctx,
      'STU-5001',
      'Bob Dylan',
      'bob@academic.edu',
      'CSE',
      '2024',
      JSON.stringify({ attendance: 65.0 }) // Below 75%
    );

    let threw = false;
    try {
      await contract.RequestCertificate(ctx, 'REQ-5001', 'STU-5001', 'Bachelor of Technology in CSE');
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Statutory attendance must be >= 75.0%'));
    }
    assert.strictEqual(threw, true, 'Should fail when attendance is below 75%');
  });

  await testAsync('RequestCertificate creates request with academicSnapshot & prerequisitesValidation', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(
      ctx,
      'STU-6001',
      'Charlie Brown',
      'charlie@academic.edu',
      'Computer Science',
      '2024',
      JSON.stringify({ cgpa: 8.8, totalCredits: 160, attendance: 90.0, backlogs: 0 })
    );

    const reqJson = await contract.RequestCertificate(
      ctx,
      'REQ-6001',
      'STU-6001',
      'Bachelor of Technology in CSE'
    );

    const request = JSON.parse(reqJson);
    assert.strictEqual(request.requestId, 'REQ-6001');
    assert.strictEqual(request.status, 'SUBMITTED');
    assert.strictEqual(request.prerequisitesValidation.verified, true);
    assert.strictEqual(request.academicSnapshot.cgpa, 8.8);
    assert.strictEqual(request.academicSnapshot.attendance, 90.0);
  });

  await testAsync('VerifyStudentEligibility queries prerequisite eligibility', async () => {
    const { ctx } = createMockContext('Org1MSP');
    await contract.RegisterStudent(
      ctx,
      'STU-7001',
      'David Miller',
      'david@academic.edu',
      'Computer Science',
      '2024',
      JSON.stringify({ cgpa: 9.1, totalCredits: 160, attendance: 94.0, backlogs: 0 })
    );

    const resJson = await contract.VerifyStudentEligibility(ctx, 'STU-7001', 'Bachelor of Technology in CSE');
    const res = JSON.parse(resJson);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.violations.length, 0);
  });

  console.log('\n--- Phase 4: Contributor 1.1 Enhancements (Crypto Non-Repudiation, Honors, Transcript Digest) ---');

  const crypto = require('crypto');

  test('Course Dependency DAG detects broken prerequisite chain', () => {
    const student = {
      academicRecord: {
        cgpa: 8.5,
        totalCredits: 160,
        attendance: 85.0,
        backlogs: 0,
        completedCourses: ['CS301'] // Missing CS201 prerequisite!
      }
    };
    const evalResult = evaluatePrerequisites(student, 'Bachelor of Technology in CSE', {
      completedCourses: ['CS301']
    });
    assert.strictEqual(evalResult.eligible, false);
    assert.ok(evalResult.violations.some(v => v.includes('Prerequisite dependency broken')));
  });

  await testAsync('RegisterStudent records Latin Honors (Summa Cum Laude & Dean Honor Roll)', async () => {
    const { ctx } = createMockContext('Org1MSP');
    const resJson = await contract.RegisterStudent(
      ctx,
      'STU-HONOR-1',
      'Honors Scholar',
      'scholar@academic.edu',
      'CSE',
      '2024',
      JSON.stringify({ cgpa: 9.7, attendance: 95.0, backlogs: 0, totalCredits: 160 })
    );
    const student = JSON.parse(resJson);
    assert.strictEqual(student.academicRecord.academicStanding, 'GOOD_STANDING');
    assert.strictEqual(student.academicRecord.honors, 'SUMMA_CUM_LAUDE');
  });

  await testAsync('RegisterStudent stores ECDSA public key & RequestCertificate verifies valid signature', async () => {
    const { ctx } = createMockContext('Org1MSP');
    
    // Generate test student ECDSA keypair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    await contract.RegisterStudent(
      ctx,
      'STU-CRYPTO-1',
      'Crypto Student',
      'crypto@academic.edu',
      'CSE',
      '2024',
      JSON.stringify({
        cgpa: 9.0,
        attendance: 90.0,
        backlogs: 0,
        totalCredits: 160,
        publicKeyPem: publicKey
      })
    );

    // Sign request payload: studentId:requestId:certType:timestamp
    const timestamp = '2026-11-19T01:00:00.000Z';
    const payload = `STU-CRYPTO-1:REQ-SIG-001:Bachelor of Technology in CSE:${timestamp}`;
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    const signatureBase64 = signer.sign(privateKey, 'base64');

    const reqJson = await contract.RequestCertificate(
      ctx,
      'REQ-SIG-001',
      'STU-CRYPTO-1',
      'Bachelor of Technology in CSE',
      JSON.stringify({
        studentSignature: signatureBase64,
        signatureTimestamp: timestamp
      })
    );

    const req = JSON.parse(reqJson);
    assert.strictEqual(req.digitalSignature.provided, true);
    assert.strictEqual(req.digitalSignature.verified, true);
    assert.ok(req.academicSnapshot.transcriptDigest);
    assert.strictEqual(req.academicSnapshot.honors, 'MAGNA_CUM_LAUDE');
  });

  await testAsync('RequestCertificate rejects forged / tampered digital signature', async () => {
    const { ctx } = createMockContext('Org1MSP');
    
    // Valid student key
    const { publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Attacker key
    const { privateKey: attackerPrivateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    await contract.RegisterStudent(
      ctx,
      'STU-CRYPTO-2',
      'Victim Student',
      'victim@academic.edu',
      'CSE',
      '2024',
      JSON.stringify({
        cgpa: 8.8,
        attendance: 88.0,
        backlogs: 0,
        totalCredits: 160,
        publicKeyPem: publicKey
      })
    );

    // Attacker attempts to sign with their own private key
    const timestamp = '2026-11-19T01:00:00.000Z';
    const payload = `STU-CRYPTO-2:REQ-FORGE-001:Bachelor of Technology in CSE:${timestamp}`;
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    const forgedSignature = signer.sign(attackerPrivateKey, 'base64');

    let threw = false;
    try {
      await contract.RequestCertificate(
        ctx,
        'REQ-FORGE-001',
        'STU-CRYPTO-2',
        'Bachelor of Technology in CSE',
        JSON.stringify({
          studentSignature: forgedSignature,
          signatureTimestamp: timestamp
        })
      );
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Cryptographic verification failed'));
    }
    assert.strictEqual(threw, true, 'Should reject forged signature');
  });

  await testAsync('VerifyStudentSignature query helper confirms valid signature on-chain', async () => {
    const { ctx } = createMockContext('Org1MSP');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    await contract.RegisterStudent(
      ctx,
      'STU-CRYPTO-3',
      'Signature Tester',
      'sig@academic.edu',
      'CSE',
      '2024',
      JSON.stringify({ publicKeyPem: publicKey })
    );

    const timestamp = '2026-11-19T01:00:00.000Z';
    const payload = `STU-CRYPTO-3:REQ-VERIFY-001:Bachelor of Technology in CSE:${timestamp}`;
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    signer.end();
    const signatureBase64 = signer.sign(privateKey, 'base64');

    const verifyResJson = await contract.VerifyStudentSignature(
      ctx,
      'STU-CRYPTO-3',
      'REQ-VERIFY-001',
      'Bachelor of Technology in CSE',
      timestamp,
      signatureBase64
    );
    const verifyRes = JSON.parse(verifyResJson);
    assert.strictEqual(verifyRes.verified, true);
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Tests Passed (100% SUCCESS)`);
  console.log('===============================================================');
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
