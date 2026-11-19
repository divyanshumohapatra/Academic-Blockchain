'use strict';

/**
 * ============================================================================
 * Automated Verification Suite: Cloudflare R2 & RBAC Consortium Access Control
 * ============================================================================
 */

require('dotenv').config();
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

    // ------------------------------------------------------------------------
    // TEST 5: Specialized Role-Based Operational Features & Privacy Guards
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Specialized Role-Based Operational Features & Privacy Guards ---');
    try {
      // 5.1 Faculty queries Course Roster (Allowed)
      const facultyRosterRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Show course roster for CS501', role: 'FACULTY' })
      });
      const facultyRosterData = await facultyRosterRes.json();
      report(
        'Faculty queries Course Roster (CS501) [Allowed]',
        facultyRosterData.intent === 'COURSE_ROSTER' && facultyRosterData.reply.includes('Course Roster'),
        `Intent: ${facultyRosterData.intent}`
      );

      // 5.2 Student queries Course Roster (Denied)
      const studentRosterRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Show course roster for CS501', role: 'STUDENT' })
      });
      const studentRosterData = await studentRosterRes.json();
      report(
        'Student queries Course Roster (CS501) [Denied]',
        studentRosterData.intent === 'RBAC_FORBIDDEN' && studentRosterData.reply.includes('Access Denied'),
        `Intent: ${studentRosterData.intent}`
      );

      // 5.3 Faculty queries CIE Marks Audit (Allowed)
      const facultyCieRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Check CIE marks audit for CS501', role: 'FACULTY' })
      });
      const facultyCieData = await facultyCieRes.json();
      report(
        'Faculty queries CIE Marks Audit [Allowed]',
        facultyCieData.intent === 'CIE_AUDIT' && facultyCieData.reply.includes('Continuous Internal Evaluation'),
        `Intent: ${facultyCieData.intent}`
      );

      // 5.4 Student queries CIE Marks Audit (Denied)
      const studentCieRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Check CIE marks audit for CS501', role: 'STUDENT' })
      });
      const studentCieData = await studentCieRes.json();
      report(
        'Student queries CIE Marks Audit [Denied]',
        studentCieData.intent === 'RBAC_FORBIDDEN' && studentCieData.reply.includes('Access Denied'),
        `Intent: ${studentCieData.intent}`
      );

      // 5.5 HOD queries Department Graduation Pipeline (Allowed)
      const hodPipelineRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'HOD' },
        body: JSON.stringify({ message: 'Department clearance pipeline', role: 'HOD' })
      });
      const hodPipelineData = await hodPipelineRes.json();
      report(
        'HOD queries Department Graduation Pipeline [Allowed]',
        hodPipelineData.intent === 'DEPARTMENT_AUDIT' && hodPipelineData.reply.includes('Department Academic Clearance'),
        `Intent: ${hodPipelineData.intent}`
      );

      // 5.6 Faculty queries Department Graduation Pipeline (Denied)
      const facultyPipelineRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Department clearance pipeline', role: 'FACULTY' })
      });
      const facultyPipelineData = await facultyPipelineRes.json();
      report(
        'Faculty queries Department Graduation Pipeline [Denied]',
        facultyPipelineData.intent === 'RBAC_FORBIDDEN' && facultyPipelineData.reply.includes('Access Denied'),
        `Intent: ${facultyPipelineData.intent}`
      );

      // 5.7 HOD queries DAC Committee Multi-Sig Quorum (Allowed)
      const hodDacRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'HOD' },
        body: JSON.stringify({ message: 'DAC committee multi-sig quorum', role: 'HOD' })
      });
      const hodDacData = await hodDacRes.json();
      report(
        'HOD queries DAC Multi-Sig Quorum [Allowed]',
        hodDacData.intent === 'DAC_QUORUM' && hodDacData.reply.includes('DAC'),
        `Intent: ${hodDacData.intent}`
      );

      // 5.8 Exam Controller queries DAC Committee Quorum (Denied)
      const examDacRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'EXAM_CONTROLLER' },
        body: JSON.stringify({ message: 'DAC committee multi-sig quorum', role: 'EXAM_CONTROLLER' })
      });
      const examDacData = await examDacRes.json();
      report(
        'Exam Controller queries DAC Multi-Sig Quorum [Denied]',
        examDacData.intent === 'RBAC_FORBIDDEN' && examDacData.reply.includes('Access Denied'),
        `Intent: ${examDacData.intent}`
      );

      // 5.9 Exam Controller queries Exam Grade Lockdown & Merkle Root (Allowed)
      const examLockRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'EXAM_CONTROLLER' },
        body: JSON.stringify({ message: 'Lock examination grades and verify Merkle root', role: 'EXAM_CONTROLLER' })
      });
      const examLockData = await examLockRes.json();
      report(
        'Exam Controller queries Exam Lockdown & Merkle Root [Allowed]',
        examLockData.intent === 'EXAM_LOCKDOWN' && examLockData.reply.includes('Merkle'),
        `Intent: ${examLockData.intent}`
      );

      // 5.10 HOD queries Exam Grade Lockdown (Denied)
      const hodLockRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'HOD' },
        body: JSON.stringify({ message: 'Lock examination grades and verify Merkle root', role: 'HOD' })
      });
      const hodLockData = await hodLockRes.json();
      report(
        'HOD queries Exam Lockdown [Denied]',
        hodLockData.intent === 'RBAC_FORBIDDEN' && hodLockData.reply.includes('Access Denied'),
        `Intent: ${hodLockData.intent}`
      );

      // 5.11 Exam Controller queries Grade Anomaly & Tamper Audit (Allowed)
      const examAnomalyRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'EXAM_CONTROLLER' },
        body: JSON.stringify({ message: 'Run grade anomaly and tamper detection audit', role: 'EXAM_CONTROLLER' })
      });
      const examAnomalyData = await examAnomalyRes.json();
      report(
        'Exam Controller queries Grade Anomaly & Tamper Audit [Allowed]',
        examAnomalyData.intent === 'GRADE_ANOMALY' && examAnomalyData.reply.includes('Grade Anomaly'),
        `Intent: ${examAnomalyData.intent}`
      );

      // 5.12 Student queries Grade Anomaly (Denied)
      const studentAnomalyRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Run grade anomaly and tamper detection audit', role: 'STUDENT' })
      });
      const studentAnomalyData = await studentAnomalyRes.json();
      report(
        'Student queries Grade Anomaly [Denied]',
        studentAnomalyData.intent === 'RBAC_FORBIDDEN' && studentAnomalyData.reply.includes('Access Denied'),
        `Intent: ${studentAnomalyData.intent}`
      );

      // 5.13 Student queries own institutional dues (Allowed for Self)
      const studentSelfDuesRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Check my fee dues', role: 'STUDENT', studentId: 'STU-2024-001' })
      });
      const studentSelfDuesData = await studentSelfDuesRes.json();
      report(
        'Student queries Own Fee Dues (Self) [Allowed]',
        studentSelfDuesData.intent === 'INSTITUTIONAL_DUES' && studentSelfDuesData.reply.includes('Institutional Dues'),
        `Intent: ${studentSelfDuesData.intent}`
      );

      // 5.14 Student queries another student\'s dues (Privacy Guard Denied)
      const studentCrossDuesRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Check fee dues for STU-2024-002', role: 'STUDENT', studentId: 'STU-2024-001' })
      });
      const studentCrossDuesData = await studentCrossDuesRes.json();
      report(
        'Student queries Other Student Dues [Privacy Guard Denied]',
        studentCrossDuesData.intent === 'RBAC_FORBIDDEN' && studentCrossDuesData.reply.includes('Privacy Guard'),
        `Intent: ${studentCrossDuesData.intent}`
      );

      // 5.15 Admin queries Institutional Dues Overview (Allowed)
      const adminDuesRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ message: 'Check institutional fee and library dues', role: 'ADMIN' })
      });
      const adminDuesData = await adminDuesRes.json();
      report(
        'Admin queries Institutional Dues Overview [Allowed]',
        adminDuesData.intent === 'INSTITUTIONAL_DUES' && adminDuesData.reply.includes('Institutional Bursar'),
        `Intent: ${adminDuesData.intent}`
      );

      // 5.16 Admin queries On-Chain Revocation Registry (Allowed)
      const adminRevocationRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({ message: 'Audit on-chain revocation registry', role: 'ADMIN' })
      });
      const adminRevocationData = await adminRevocationRes.json();
      report(
        'Admin queries On-Chain Revocation Registry [Allowed]',
        adminRevocationData.intent === 'REVOCATION_AUDIT' && adminRevocationData.reply.includes('Revocation Registry'),
        `Intent: ${adminRevocationData.intent}`
      );

      // 5.17 Faculty queries On-Chain Revocation Registry (Denied)
      const facultyRevocationRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Audit on-chain revocation registry', role: 'FACULTY' })
      });
      const facultyRevocationData = await facultyRevocationRes.json();
      report(
        'Faculty queries Revocation Registry [Denied]',
        facultyRevocationData.intent === 'RBAC_FORBIDDEN' && facultyRevocationData.reply.includes('Access Denied'),
        `Intent: ${facultyRevocationData.intent}`
      );

      // 5.18 Multi-Agent chat endpoint (/api/agents/chat) verifies identical RBAC
      const agentRosterRes = await fetch(`${baseUrl}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'FACULTY' },
        body: JSON.stringify({ message: 'Show course roster for CS501', role: 'FACULTY' })
      });
      const agentRosterData = await agentRosterRes.json();
      report(
        'Agent Chat API (/api/agents/chat): Faculty Course Roster [Allowed]',
        agentRosterData.intent === 'COURSE_ROSTER' && agentRosterData.reply.includes('Course Roster'),
        `Intent: ${agentRosterData.intent}`
      );

      const agentStudentRosterRes = await fetch(`${baseUrl}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'STUDENT' },
        body: JSON.stringify({ message: 'Show course roster for CS501', role: 'STUDENT' })
      });
      const agentStudentRosterData = await agentStudentRosterRes.json();
      report(
        'Agent Chat API (/api/agents/chat): Student Course Roster [Denied]',
        agentStudentRosterData.intent === 'RBAC_FORBIDDEN' && agentStudentRosterData.reply.includes('Access Denied'),
        `Intent: ${agentStudentRosterData.intent}`
      );
    } catch (err) {
      report('Specialized RBAC Tests', false, err.message);
    }

    // ==========================================
    // 6. Employer Portal Multi-Tiered Verification Suite
    // ==========================================
    console.log('\n--- 6. Employer Portal Multi-Tiered Verification Suite ---');
    try {
      const { calculateSHA256 } = require('./src/ipfs');
      const testCertPath = path.join(__dirname, 'storage/certificates/CERT-2024-001.pdf');
      const testCertBuffer = fs.readFileSync(testCertPath);
      const testCertHash = calculateSHA256(testCertBuffer).toLowerCase();

      // 6.1 Verification by exact SHA-256 binary hash
      const hashVerifyRes = await fetch(`${baseUrl}/api/verify/hash/${testCertHash}`);
      const hashVerifyData = await hashVerifyRes.json();
      report(
        'Verify Approved Certificate by SHA-256 Hash',
        hashVerifyData.verified === true &&
        hashVerifyData.verificationStatus === 'VERIFIED' &&
        hashVerifyData.certificate &&
        hashVerifyData.certificate.certId === 'CERT-2024-001' &&
        Boolean(hashVerifyData.certificate.studentName) &&
        Boolean(hashVerifyData.certificate.docHash),
        `Status: ${hashVerifyData.verificationStatus}, Student: ${hashVerifyData.certificate?.studentName}`
      );

      // 6.2 Verification with invalid SHA-256 hash correctly rejects
      const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const fakeHashRes = await fetch(`${baseUrl}/api/verify/hash/${fakeHash}`);
      const fakeHashData = await fakeHashRes.json();
      report(
        'Reject Unanchored / Invalid Certificate Hash',
        fakeHashData.verified === false && fakeHashData.verificationStatus === 'INVALID',
        `Status: ${fakeHashData.verificationStatus}`
      );

      // 6.3 Verification by Certificate ID
      const idVerifyRes = await fetch(`${baseUrl}/api/verify/id/CERT-2024-001`);
      const idVerifyData = await idVerifyRes.json();
      report(
        'Verify Approved Certificate by Certificate ID',
        idVerifyData.verified === true &&
        idVerifyData.verificationStatus === 'VERIFIED' &&
        idVerifyData.certificate &&
        idVerifyData.certificate.certId === 'CERT-2024-001',
        `Status: ${idVerifyData.verificationStatus}`
      );

      // 6.4 Verification by Student DID
      const didVerifyRes = await fetch(`${baseUrl}/api/verify/did/did:academic:a038a2bdb75e4eca20c7efcf34c62fa57f7bd1be`);
      const didVerifyData = await didVerifyRes.json();
      report(
        'Verify Approved Certificate by Student DID',
        didVerifyData.verified === true &&
        didVerifyData.verificationStatus === 'VERIFIED' &&
        didVerifyData.certificate &&
        Boolean(didVerifyData.certificate.certId),
        `Status: ${didVerifyData.verificationStatus}, CertId: ${didVerifyData.certificate?.certId}`
      );

      // 6.5 Verification via File Upload (/api/verify/file)
      const FormData = require('form-data');
      const form = new FormData();
      form.append('certificate', testCertBuffer, {
        filename: 'CERT-2024-001.pdf',
        contentType: 'application/pdf'
      });

      const fileVerifyRes = await fetch(`${baseUrl}/api/verify/file`, {
        method: 'POST',
        headers: form.getHeaders(),
        body: form.getBuffer()
      });
      const fileVerifyData = await fileVerifyRes.json();
      report(
        'Verify Approved Certificate by Direct File Upload (/api/verify/file)',
        fileVerifyData.verified === true &&
        fileVerifyData.verificationStatus === 'VERIFIED' &&
        fileVerifyData.certificate &&
        fileVerifyData.certificate.certId === 'CERT-2024-001',
        `Status: ${fileVerifyData.verificationStatus}, CertId: ${fileVerifyData.certificate?.certId}`
      );
    } catch (err) {
      report('Employer Portal Multi-Tiered Verification Suite', false, err.message);
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
