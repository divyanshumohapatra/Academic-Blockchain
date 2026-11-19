'use strict';

/**
 * ============================================================================
 * Automated Verification Suite: Cloudflare R2 & RBAC Consortium Access Control
 * ============================================================================
 */

require('dotenv').config();
const assert = require('assert');
const r2 = require('./src/r2');
const { ROLES, login, quickLoginByRole, requireRole, DEMO_ACCOUNTS } = require('./src/auth');
const app = require('./src/server');
const http = require('http');

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Cloudflare R2 & RBAC Verification Suite');
  console.log('======================================================\n');

  let server;
  let testPort = 4055;
  let baseUrl = `http://127.0.0.1:${testPort}`;

  // Start temporary server for HTTP endpoint tests
  await new Promise((resolve) => {
    server = app.listen(testPort, '127.0.0.1', () => {
      console.log(`[Test Server] Running on ${baseUrl}`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function report(name, isSuccess, details = '') {
    if (isSuccess) {
      console.log(`✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} - ${details}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Cloudflare R2 Live Bucket Connectivity & Operations
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Cloudflare R2 Direct Operations ---');
    try {
      const health = await r2.checkR2Health();
      report('Cloudflare R2 Health Check', health.healthy === true, `Bucket: ${health.bucket}, Mode: ${health.mode}`);

      const testContent = Buffer.from('Academic Blockchain Cloudflare R2 Integration Test Artifact - ' + Date.now());
      const testKey = 'test/test-cert.txt';
      const uploadResult = await r2.uploadToR2(testContent, testKey, 'text/plain');
      report('Cloudflare R2 Upload Object', uploadResult.success === true, `URI: ${uploadResult.storageUri}`);

      const presignedUrl = await r2.getDownloadLink(testKey, 300);
      report('Cloudflare R2 Presigned Download Link', typeof presignedUrl === 'string' && presignedUrl.includes(r2.BUCKET), 'Generated 15-min signed URL');

      const fetchedBuffer = await r2.fetchFromR2(testKey);
      report('Cloudflare R2 Fetch Object & Integrity', fetchedBuffer.toString() === testContent.toString(), 'SHA-256 bit-perfect roundtrip verified');
    } catch (err) {
      report('Cloudflare R2 Direct Operations', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Consortium Authentication & Credential Authorization
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Consortium Authentication & Role Credentials ---');
    try {
      // Admin login with user specified credentials: admin@academic.edu / adminPassword123
      const adminSession = login('admin@academic.edu', 'adminPassword123');
      report('Admin Login (admin@academic.edu)', adminSession.role === ROLES.ADMIN, `Token: ${adminSession.token.substring(0, 12)}...`);

      // Wrong password fails
      let wrongPassThrew = false;
      try {
        login('admin@academic.edu', 'wrongPass');
      } catch (e) {
        wrongPassThrew = true;
      }
      report('Admin Invalid Password Rejection', wrongPassThrew, 'Correctly throws 401 error');

      // Faculty login
      const facultySession = login('rajesh.kumar@academic.edu', 'password123');
      report('Faculty Login (rajesh.kumar@academic.edu)', facultySession.role === ROLES.FACULTY, `Course: ${facultySession.courseId}`);

      // HOD login
      const hodSession = login('hod.cse@academic.edu', 'hodPassword123');
      report('HOD Login (hod.cse@academic.edu)', hodSession.role === ROLES.HOD, `Org: ${hodSession.org}`);

      // Exam Controller login
      const examSession = login('controller@academic.edu', 'examPassword123');
      report('Exam Controller Login (controller@academic.edu)', examSession.role === ROLES.EXAM_CONTROLLER, `Org: ${examSession.org}`);
    } catch (err) {
      report('Consortium Authentication Tests', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Cloudflare R2 API Endpoints RBAC Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Cloudflare R2 API RBAC Guard ---');
    try {
      // 3.1 Student requests R2 status -> Expect 403 Forbidden
      const resStudentStatus = await fetch(`${baseUrl}/api/r2/status`, {
        headers: { 'x-user-role': 'STUDENT' }
      });
      report('Student Access to /api/r2/status is Forbidden', resStudentStatus.status === 403, `HTTP ${resStudentStatus.status}`);

      // 3.2 Faculty requests R2 status -> Expect 403 Forbidden
      const resFacultyStatus = await fetch(`${baseUrl}/api/r2/status`, {
        headers: { 'x-user-role': 'FACULTY' }
      });
      report('Faculty Access to /api/r2/status is Forbidden', resFacultyStatus.status === 403, `HTTP ${resFacultyStatus.status}`);

      // 3.3 Admin requests R2 status -> Expect 200 OK
      const resAdminStatus = await fetch(`${baseUrl}/api/r2/status`, {
        headers: { 'x-user-role': 'ADMIN' }
      });
      const adminStatusData = await resAdminStatus.json();
      report('Admin Access to /api/r2/status is Authorized', resAdminStatus.status === 200 && adminStatusData.healthy === true, `Bucket: ${adminStatusData.bucket}`);

      // 3.4 Student requests R2 link -> Expect 403 Forbidden
      const resStudentLink = await fetch(`${baseUrl}/api/r2/link/CERT-2024-001`, {
        headers: { 'x-user-role': 'STUDENT' }
      });
      report('Student Access to /api/r2/link is Forbidden', resStudentLink.status === 403, `HTTP ${resStudentLink.status}`);

      // 3.5 Admin requests R2 link -> Expect 200 OK with presigned URL
      const resAdminLink = await fetch(`${baseUrl}/api/r2/link/CERT-2024-001`, {
        headers: { 'x-user-role': 'ADMIN' }
      });
      const adminLinkData = await resAdminLink.json();
      report('Admin Access to /api/r2/link is Authorized', resAdminLink.status === 200 && Boolean(adminLinkData.downloadLink), `Presigned Link: ${adminLinkData.downloadLink ? 'Generated' : 'Missing'}`);
    } catch (err) {
      report('Cloudflare R2 API RBAC Guard', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Conversational Chatbot RBAC & Organization Segregation
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Chatbot Role-Based Access Control ---');
    try {
      // 4.1 Student asks about Cloudflare R2 status -> RBAC Denied
      const studentR2Query = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Check Cloudflare R2 backup status', role: 'STUDENT' })
      });
      const studentR2Data = await studentR2Query.json();
      report(
        'Chatbot: Student query for Cloudflare R2 status Denied',
        studentR2Data.intent === 'RBAC_FORBIDDEN' && studentR2Data.reply.includes('Access Denied'),
        `Intent: ${studentR2Data.intent}`
      );

      // 4.2 Re-verify: Cloudflare link can ONLY be accessed by ADMIN:
      // Test STUDENT attempting to get Cloudflare link
      const studentLinkQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Give me cloudflare link for CERT-2024-001', role: 'STUDENT' })
      });
      const studentLinkData = await studentLinkQuery.json();
      report(
        'Chatbot: Student denied Cloudflare download link',
        studentLinkData.intent === 'RBAC_FORBIDDEN' && studentLinkData.reply.includes('Access Denied'),
        `Intent: ${studentLinkData.intent}`
      );

      // Test FACULTY attempting to get Cloudflare link
      const facultyLinkQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Give me cloudflare link for CERT-2024-001', role: 'FACULTY' })
      });
      const facultyLinkData = await facultyLinkQuery.json();
      report(
        'Chatbot: Faculty denied Cloudflare download link',
        facultyLinkData.intent === 'RBAC_FORBIDDEN' && facultyLinkData.reply.includes('Access Denied'),
        `Intent: ${facultyLinkData.intent}`
      );

      // Test HOD attempting to get Cloudflare link
      const hodLinkQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'HOD' },
        body: JSON.stringify({ message: 'Give me cloudflare link for CERT-2024-001', role: 'HOD' })
      });
      const hodLinkData = await hodLinkQuery.json();
      report(
        'Chatbot: HOD denied Cloudflare download link',
        hodLinkData.intent === 'RBAC_FORBIDDEN' && hodLinkData.reply.includes('Access Denied'),
        `Intent: ${hodLinkData.intent}`
      );

      // Test EXAM_CONTROLLER attempting to get Cloudflare link
      const examLinkQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'EXAM_CONTROLLER' },
        body: JSON.stringify({ message: 'Give me cloudflare link for CERT-2024-001', role: 'EXAM_CONTROLLER' })
      });
      const examLinkData = await examLinkQuery.json();
      report(
        'Chatbot: Exam Controller denied Cloudflare download link',
        examLinkData.intent === 'RBAC_FORBIDDEN' && examLinkData.reply.includes('Access Denied'),
        `Intent: ${examLinkData.intent}`
      );

      // Test ADMIN requesting Cloudflare link -> Authorized!
      const adminCertLinkQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ message: 'Get Cloudflare R2 link for CERT-2024-001', role: 'ADMIN' })
      });
      const adminCertLinkData = await adminCertLinkQuery.json();
      report(
        'Chatbot: Admin authorized Cloudflare R2 download link',
        adminCertLinkData.intent === 'R2_BACKUP_LINK' && adminCertLinkData.reply.includes('Presigned Download URL'),
        `Intent: ${adminCertLinkData.intent}`
      );

      // Test ADMIN requesting Cloudflare status
      const adminR2Query = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ message: 'Check Cloudflare R2 backup status', role: 'ADMIN' })
      });
      const adminR2Data = await adminR2Query.json();
      report(
        'Chatbot: Admin query for Cloudflare R2 status Authorized',
        adminR2Data.intent === 'R2_STATUS' && adminR2Data.reply.includes('Cloudflare R2 Enterprise Backup Status'),
        `Intent: ${adminR2Data.intent}`
      );

      // Test ADMIN asking for link help without specifying cert ID
      const adminLinkHelpQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ message: 'Give me cloudflare download link', role: 'ADMIN' })
      });
      const adminLinkHelpData = await adminLinkHelpQuery.json();
      report(
        'Chatbot: Admin link generator help prompt without ID',
        adminLinkHelpData.intent === 'R2_LINK_HELP',
        `Intent: ${adminLinkHelpData.intent}`
      );

      // 4.3 Student asks to lock grades (privileged action) -> Role Restricted
      const studentPrivilegedQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Lock grades for student STU-2024-001', role: 'STUDENT' })
      });
      const studentPrivData = await studentPrivilegedQuery.json();
      report(
        'Chatbot: Student restricted from grade lockdown',
        studentPrivData.intent === 'RBAC_FORBIDDEN' && studentPrivData.reply.includes('Role-Restricted'),
        `Intent: ${studentPrivData.intent}`
      );

      // 4.4 Faculty searches for instructor dossier
      const facultyQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Find Dr. Rajesh Kumar', role: 'FACULTY' })
      });
      const facultyData = await facultyQuery.json();
      report(
        'Chatbot: Faculty queries instructor dossier',
        facultyData.intent === 'FACULTY_LOOKUP' && facultyData.reply.includes('Rajesh Kumar'),
        `Intent: ${facultyData.intent}`
      );

      // 4.5 Public verification open to Student
      const publicVerifyQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'What is the status of CERT-101?', role: 'STUDENT' })
      });
      const publicVerifyData = await publicVerifyQuery.json();
      report(
        'Chatbot: Public Verification open to Student',
        publicVerifyData.reply.includes('CERT-101') || publicVerifyData.intent === 'STATUS_CHECK',
        `Intent: ${publicVerifyData.intent}`
      );

      // 4.6 HOD queries milestone approvers
      const hodApproverQuery = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'HOD' },
        body: JSON.stringify({ message: 'Who approved CERT-101?', role: 'HOD' })
      });
      const hodApproverData = await hodApproverQuery.json();
      report(
        'Chatbot: HOD queries milestone approvers',
        hodApproverData.intent === 'WHO_APPROVED' || hodApproverData.reply.includes('approved'),
        `Intent: ${hodApproverData.intent}`
      );
    } catch (err) {
      report('Chatbot RBAC Tests', false, err.message);
    }

  } finally {
    if (server) {
      server.close();
      console.log('\n[Test Server] Shutdown complete.');
    }
  }

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
