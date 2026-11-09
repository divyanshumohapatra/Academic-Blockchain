'use strict';

const axios = require('axios');

const API_BASE = 'http://localhost:4000/api';

async function runOrg1AgentTests() {
  console.log('================================================================');
  console.log('🧪 Starting Contributor 1.3: Org 1 Academic Agent Verification');
  console.log('================================================================\n');

  const timestamp = Date.now().toString().slice(-4);

  // -------------------------------------------------------------
  // Test 1: Ineligible Student (Attendance < 75%)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Ineligible Student (Attendance < 75%) ---');
  const stuId1 = `STU-LOW-ATT-${timestamp}`;
  const reqId1 = `REQ-LOW-ATT-${timestamp}`;

  await axios.post(`${API_BASE}/students`, {
    studentId: stuId1,
    name: 'Rahul Sharma (Low Attendance)',
    email: 'rahul.lowatt@academic.edu',
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024'
  });

  await axios.post(`${API_BASE}/requests`, {
    requestId: reqId1,
    studentId: stuId1,
    certType: 'Master of Computer Applications (MCA)',
    details: {
      attendance: 68.5, // FAILS statutory minimum 75.0%
      cieMarks: 38.0,
      prerequisitesMet: true,
      totalCredits: 162,
      requiredCredits: 160,
      capstoneScore: 82,
      originalityReport: 90
    }
  });

  // Call Org 1 Audit
  const auditRes1 = await axios.post(`${API_BASE}/agents/org1/audit/${reqId1}`);
  console.log(`[Audit Result 1] Decision: ${auditRes1.data.decision}, Escalate: ${auditRes1.data.escalate}`);
  console.log(`[Audit Reasons 1]:`, auditRes1.data.escalationReasons);

  if (auditRes1.data.decision !== 'REJECT' || !auditRes1.data.escalate) {
    throw new Error('FAIL: Low attendance student should have been rejected and escalated!');
  }
  console.log('✅ TEST 1 Passed: Low attendance correctly rejected with escalation.\n');

  // Try auto-approve (should be blocked)
  try {
    await axios.post(`${API_BASE}/agents/org1/auto-approve/${reqId1}`);
    throw new Error('FAIL: Auto-approve should have failed for low attendance!');
  } catch (err) {
    if (err.response && err.response.status === 422) {
      console.log('✅ TEST 1 Auto-Approve correctly blocked with HTTP 422.\n');
    } else {
      throw err;
    }
  }

  // -------------------------------------------------------------
  // Test 2: Ineligible Student (CIE Marks < 20.0/50)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Ineligible Student (CIE Marks < 20.0/50) ---');
  const stuId2 = `STU-LOW-CIE-${timestamp}`;
  const reqId2 = `REQ-LOW-CIE-${timestamp}`;

  await axios.post(`${API_BASE}/students`, {
    studentId: stuId2,
    name: 'Priya Patel (Low CIE)',
    email: 'priya.lowcie@academic.edu',
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024'
  });

  await axios.post(`${API_BASE}/requests`, {
    requestId: reqId2,
    studentId: stuId2,
    certType: 'Master of Computer Applications (MCA)',
    details: {
      attendance: 88.0,
      cieMarks: 16.5, // FAILS minimum 20.0/50
      prerequisitesMet: true,
      totalCredits: 162,
      requiredCredits: 160,
      capstoneScore: 78,
      originalityReport: 88
    }
  });

  const auditRes2 = await axios.post(`${API_BASE}/agents/org1/audit/${reqId2}`);
  console.log(`[Audit Result 2] Decision: ${auditRes2.data.decision}, Escalate: ${auditRes2.data.escalate}`);
  console.log(`[Audit Reasons 2]:`, auditRes2.data.escalationReasons);

  if (auditRes2.data.decision !== 'REJECT' || !auditRes2.data.escalate) {
    throw new Error('FAIL: Low CIE student should have been rejected!');
  }
  console.log('✅ TEST 2 Passed: Low CIE score correctly rejected with escalation.\n');

  // -------------------------------------------------------------
  // Test 3: Ineligible Student (Prerequisites Not Met)
  // -------------------------------------------------------------
  console.log('--- TEST 3: Ineligible Student (Prerequisites Not Met) ---');
  const stuId3 = `STU-NO-PREREQ-${timestamp}`;
  const reqId3 = `REQ-NO-PREREQ-${timestamp}`;

  await axios.post(`${API_BASE}/students`, {
    studentId: stuId3,
    name: 'Vikram Singh (Missing Prerequisites)',
    email: 'vikram.noprereq@academic.edu',
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024'
  });

  await axios.post(`${API_BASE}/requests`, {
    requestId: reqId3,
    studentId: stuId3,
    certType: 'Master of Computer Applications (MCA)',
    details: {
      attendance: 86.0,
      cieMarks: 35.0,
      prerequisitesMet: false, // FAILS prerequisite verification
      totalCredits: 162,
      requiredCredits: 160,
      capstoneScore: 85,
      originalityReport: 92
    }
  });

  const auditRes3 = await axios.post(`${API_BASE}/agents/org1/audit/${reqId3}`);
  console.log(`[Audit Result 3] Decision: ${auditRes3.data.decision}, Escalate: ${auditRes3.data.escalate}`);
  console.log(`[Audit Reasons 3]:`, auditRes3.data.escalationReasons);

  if (auditRes3.data.decision !== 'REJECT' || !auditRes3.data.escalate) {
    throw new Error('FAIL: Unmet prerequisites student should have been rejected!');
  }
  console.log('✅ TEST 3 Passed: Incomplete prerequisites correctly rejected with escalation.\n');

  // -------------------------------------------------------------
  // Test 4: Fully Eligible Student (Passes All Stages 1-3)
  // -------------------------------------------------------------
  console.log('--- TEST 4: Fully Eligible Student & Autonomous Org 1 Approval ---');
  const stuId4 = `STU-ELIGIBLE-${timestamp}`;
  const reqId4 = `REQ-ELIGIBLE-${timestamp}`;

  await axios.post(`${API_BASE}/students`, {
    studentId: stuId4,
    name: 'Ananya Deshmukh (Eligible Honors)',
    email: 'ananya.deshmukh@academic.edu',
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024'
  });

  await axios.post(`${API_BASE}/requests`, {
    requestId: reqId4,
    studentId: stuId4,
    certType: 'Master of Computer Applications (MCA)',
    details: {
      attendance: 92.4, // >= 75.0%
      cieMarks: 45.0,   // >= 20.0/50
      prerequisitesMet: true,
      totalCredits: 168, // >= 160
      requiredCredits: 160,
      disciplinaryClearance: true,
      capstoneScore: 91, // >= 60/100
      originalityReport: 96 // >= 80%
    }
  });

  // Verify Audit Passes
  const auditRes4 = await axios.post(`${API_BASE}/agents/org1/audit/${reqId4}`);
  console.log(`[Audit Result 4] Decision: ${auditRes4.data.decision}, Confidence: ${auditRes4.data.confidence}`);
  console.log(`[Audit Trail Items]: ${auditRes4.data.auditTrail.length} checks performed.`);
  auditRes4.data.auditTrail.forEach(item => {
    console.log(`   - [${item.rule}] ${item.metric}: ${item.actual} (${item.passed ? 'PASSED' : 'FAILED'})`);
  });

  if (auditRes4.data.decision !== 'APPROVE' || auditRes4.data.escalate) {
    throw new Error('FAIL: Eligible student should be approved!');
  }
  console.log('✅ TEST 4 Audit Passed: All criteria satisfied.\n');

  // Execute Auto-Approval across Stages 1-3
  console.log('--> Executing /api/agents/org1/auto-approve...');
  const approveRes = await axios.post(`${API_BASE}/agents/org1/auto-approve/${reqId4}`);
  console.log('[Auto-Approve Result]:', {
    success: approveRes.data.success,
    finalStatus: approveRes.data.finalStatus,
    completedStages: approveRes.data.completedStages,
    endorsingMsp: approveRes.data.endorsingMsp,
    targetPeer: approveRes.data.targetPeer
  });

  if (!approveRes.data.success || approveRes.data.finalStatus !== 'DAC_APPROVED') {
    throw new Error(`FAIL: Expected final status DAC_APPROVED, got ${approveRes.data.finalStatus}`);
  }

  // -------------------------------------------------------------
  // Test 5: Verify Ledger State on Fabric
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Verifying Ledger State On-Chain ---');
  const reqCheck = await axios.get(`${API_BASE}/requests/${reqId4}`);
  console.log('[On-Chain Status]:', reqCheck.data.status);
  console.log('[On-Chain History Count]:', reqCheck.data.history.length);
  reqCheck.data.history.forEach((h, idx) => {
    console.log(`   Stage ${idx + 1}: ${h.stage} by ${h.updatedBy} at ${h.timestamp} - "${h.comments}"`);
  });

  if (reqCheck.data.status !== 'DAC_APPROVED') {
    throw new Error(`FAIL: On-chain ledger status mismatch: expected DAC_APPROVED, got ${reqCheck.data.status}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL ORG 1 AUTONOMOUS AGENT VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runOrg1AgentTests().catch(err => {
  console.error('❌ Test failed with error:', err.response?.data || err.message);
  process.exit(1);
});
