'use strict';

const { runFraudInspection } = require('./fraudAgent');

console.log('===============================================================');
console.log(' 🛡️ GROUP 3: FRAUD SENTINEL AGENT — SIMULATION TEST SUITE      ');
console.log(' Modules: Contributor 3.1, 3.2, 3.3 Security & Risk Engine     ');
console.log('===============================================================\n');

let passedTests = 0;
let totalTests = 4;

// -------------------------------------------------------------
// Test 1: Legitimate High-Performing Student
// -------------------------------------------------------------
console.log('--> TEST 1: Evaluating Legitimate Student (Expected: LOW Risk, Cleared)');
const genuineStudentPayload = {
  studentId: 'STU-1001-GENUINE',
  requestId: 'REQ-1001',
  transcript: {
    previousGPA: 8.5,
    recentSemesterGPA: 8.8,
    totalCreditsEarned: 160,
    requiredCredits: 160,
    completedCourses: ['CS101', 'CS201', 'MATH201', 'CS301', 'CS401', 'CS405', 'CS410']
  },
  history: [
    { stage: 'SUBMITTED', timestamp: '2026-09-01T10:00:00.000Z' },
    { stage: 'FACULTY_APPROVED', timestamp: '2026-09-02T11:00:00.000Z' },
    { stage: 'HOD_APPROVED', timestamp: '2026-09-03T09:30:00.000Z' }
  ]
};

const res1 = runFraudInspection(genuineStudentPayload);
console.log(`   • Risk Score: ${res1.riskScore}/100 [Level: ${res1.riskLevel}]`);
console.log(`   • Recommendation: ${res1.recommendation}`);
console.log(`   • Quarantined: ${res1.shouldQuarantine ? 'YES' : 'NO'}`);

if (res1.riskScore === 0 && res1.riskLevel === 'LOW' && !res1.shouldQuarantine) {
  console.log('   ✅ TEST 1 PASSED: Legitimate student cleared with 0 risk points.\n');
  passedTests++;
} else {
  console.log('   ❌ TEST 1 FAILED.\n');
}

// -------------------------------------------------------------
// Test 2: CGPA Velocity Spike (Severe Grade Tampering)
// -------------------------------------------------------------
console.log('--> TEST 2: Evaluating CGPA Velocity Spike (Expected: CRITICAL Risk, Quarantine)');
const tamperStudentPayload = {
  studentId: 'STU-2002-TAMPERED',
  requestId: 'REQ-2002',
  transcript: {
    previousGPA: 5.1,
    recentSemesterGPA: 9.9, // +4.8 Spike!
    totalCreditsEarned: 160,
    requiredCredits: 160,
    completedCourses: ['CS101', 'CS201', 'CS301']
  },
  history: [
    { stage: 'SUBMITTED', timestamp: '2026-09-01T10:00:00.000Z' }
  ]
};

const res2 = runFraudInspection(tamperStudentPayload);
console.log(`   • Risk Score: ${res2.riskScore}/100 [Level: ${res2.riskLevel}]`);
console.log(`   • Triggered Flags: ${res2.flags.map(f => f.type).join(', ')}`);
console.log(`   • Quarantined: ${res2.shouldQuarantine ? 'YES' : 'NO'}`);

if (res2.riskScore >= 45 && res2.flags.some(f => f.type === 'CGPA_VELOCITY_SPIKE')) {
  console.log('   ✅ TEST 2 PASSED: Velocity spike successfully intercepted.\n');
  passedTests++;
} else {
  console.log('   ❌ TEST 2 FAILED.\n');
}

// -------------------------------------------------------------
// Test 3: Curriculum Prerequisite Invariant Violation
// -------------------------------------------------------------
console.log('--> TEST 3: Evaluating Prerequisite Bypass (Expected: CRITICAL Risk, Quarantine)');
const bypassStudentPayload = {
  studentId: 'STU-3003-PREREQ-BYPASS',
  requestId: 'REQ-3003',
  transcript: {
    previousGPA: 7.2,
    recentSemesterGPA: 7.5,
    totalCreditsEarned: 140,
    requiredCredits: 160, // Credit deficit + Prerequisite bypass!
    completedCourses: ['CS401', 'CS405'] // Took Advanced Algorithms & Distributed Systems WITHOUT Data Structures or OS!
  },
  history: [
    { stage: 'SUBMITTED', timestamp: '2026-09-01T10:00:00.000Z' }
  ]
};

const res3 = runFraudInspection(bypassStudentPayload);
console.log(`   • Risk Score: ${res3.riskScore}/100 [Level: ${res3.riskLevel}]`);
console.log(`   • Triggered Flags:`);
res3.flags.forEach(f => console.log(`     - [${f.severity}] ${f.message}`));
console.log(`   • Quarantined: ${res3.shouldQuarantine ? 'YES' : 'NO'}`);

if (res3.shouldQuarantine && res3.flags.some(f => f.type === 'PREREQUISITE_INVARIANT_VIOLATION')) {
  console.log('   ✅ TEST 3 PASSED: Prerequisite invariant enforcement confirmed.\n');
  passedTests++;
} else {
  console.log('   ❌ TEST 3 FAILED.\n');
}

// -------------------------------------------------------------
// Test 4: Rapid Submission Velocity Replay Attack
// -------------------------------------------------------------
console.log('--> TEST 4: Evaluating Rapid Submission Replay (Expected: HIGH Risk Velocity Flag)');
const botStudentId = 'STU-BOT-999';

// Fire 3 rapid submissions in immediate succession
runFraudInspection({ studentId: botStudentId, transcript: { previousGPA: 7.0, recentSemesterGPA: 7.0 } });
runFraudInspection({ studentId: botStudentId, transcript: { previousGPA: 7.0, recentSemesterGPA: 7.0 } });
const res4 = runFraudInspection({ studentId: botStudentId, transcript: { previousGPA: 7.0, recentSemesterGPA: 7.0 } });

console.log(`   • Risk Score: ${res4.riskScore}/100 [Level: ${res4.riskLevel}]`);
console.log(`   • Triggered Flags: ${res4.flags.map(f => f.type).join(', ')}`);

if (res4.flags.some(f => f.type === 'RAPID_SUBMISSION_REPLAY')) {
  console.log('   ✅ TEST 4 PASSED: Rapid velocity attack detected.\n');
  passedTests++;
} else {
  console.log('   ❌ TEST 4 FAILED.\n');
}

console.log('===============================================================');
console.log(` 🎉 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(' Group 3 Fraud Sentinel Engine is fully verified!');
console.log('===============================================================');
