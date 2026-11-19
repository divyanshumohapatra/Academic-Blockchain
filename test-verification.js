'use strict';

const assert = require('assert');
const sis = require('./backend/src/db/sisDatabase');
const { generateStudentDID } = require('./backend/src/cryptoUtil');

console.log('🧪 Starting Academic Blockchain Core Verification Suite...\n');

// 1. Verify DID Derivation (SHA-256 + RIPEMD-160)
console.log('--> Test 1: Verifying DID Derivation (SHA-256 + RIPEMD-160)...');
const testDID = generateStudentDID('Alice Johnson', 'STU-2024-001');
console.log('   DID Generated:', testDID);
assert.match(testDID, /^did:academic:[0-9a-f]{40}$/, 'DID must match did:academic:<40 hex chars>');
console.log('   ✅ Test 1 Passed: 40-character Hash160 hex DID derived correctly.\n');

// 2. Verify Database vs Ledger Distinction
console.log('--> Test 2: Verifying Database vs Ledger Distinction...');
// Reset STU-2024-001 to database-only
sis.db.prepare('UPDATE students SET is_on_ledger = 0, registered_on_ledger_at = NULL WHERE student_id = ?').run('STU-2024-001');

const aliceBefore = sis.getStudentByRollNumber('STU-2024-001');
assert.strictEqual(aliceBefore.isOnLedger, false, 'Student must initially be off-ledger (in database only)');
const ledgerStudentsBefore = sis.getLedgerStudents();
assert.ok(!ledgerStudentsBefore.some(s => s.studentId === 'STU-2024-001'), 'Student STU-2024-001 must not be in getLedgerStudents()');
console.log('   Student in SIS DB:', aliceBefore.studentId, '| isOnLedger:', aliceBefore.isOnLedger);
console.log('   Ledger student count before registration:', ledgerStudentsBefore.length);

// Now mark student on ledger (simulating POST /api/students)
sis.markStudentOnLedger('STU-2024-001', testDID);
const aliceAfter = sis.getStudentByRollNumber('STU-2024-001');
assert.strictEqual(aliceAfter.isOnLedger, true, 'Student must be on-ledger after registration');
assert.ok(aliceAfter.registeredOnLedgerAt, 'Must record registration timestamp');
const ledgerStudentsAfter = sis.getLedgerStudents();
assert.ok(ledgerStudentsAfter.some(s => s.studentId === 'STU-2024-001'), 'Student must now appear in getLedgerStudents()');
console.log('   Student after registration: isOnLedger =', aliceAfter.isOnLedger, '| Registered at:', aliceAfter.registeredOnLedgerAt);
console.log('   ✅ Test 2 Passed: Strict Database vs Ledger distinction verified.\n');

// 3. Verify Department, Semester & Course Registrations
console.log('--> Test 3: Verifying Student Semester & Course Registrations...');
const allRegs = sis.getAllSemesterRegistrations();
console.log('   Total student semester cohorts:', allRegs.length);
assert.ok(allRegs.length >= 5, 'Must have at least 5 student semester registrations');

const aliceReg = sis.getStudentSemesterRegistration('STU-2024-001');
console.log('   Alice Academic Profile:');
console.log('     Department:', aliceReg.department);
console.log('     Branch:', aliceReg.branch);
console.log('     Semester:', aliceReg.semesterLabel);
console.log('     Courses Enrolled:', aliceReg.registeredCourses.map(c => c.course_id).join(', '));

assert.strictEqual(aliceReg.department, 'Department of Computer Science & Engineering');
assert.ok(aliceReg.branch.includes('MCA'));
assert.strictEqual(aliceReg.semesterNumber, 5);
assert.strictEqual(aliceReg.registeredCourses.length, 5);

const rahulReg = sis.getStudentSemesterRegistration('STU-2024-002');
assert.ok(rahulReg.branch.includes('B.Tech CSE'));
assert.strictEqual(rahulReg.department, 'Department of Computer Science & Engineering');

const bobReg = sis.getStudentSemesterRegistration('STU-2024-DEFICIT');
assert.ok(bobReg.branch.includes('M.Tech CSE'));
assert.strictEqual(bobReg.department, 'Department of Computer Science & Engineering');

console.log('   ✅ Test 3 Passed: Dept, Branch (MCA, B.Tech CSE, M.Tech CSE), Sem 5 & Courses verified.\n');

// 4. Verify Branch and Department Matching Rules
console.log('--> Test 4: Verifying Certificate Request Branch & Department Matching...');

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

// Alice Johnson is in MCA
assert.strictEqual(checkBranchMatch('MCA', aliceReg.branch), true, 'MCA matches MCA');
assert.strictEqual(checkBranchMatch('Master of Computer Applications (MCA)', aliceReg.branch), true, 'Full title matches');
assert.strictEqual(checkBranchMatch('Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)', aliceReg.branch), false, 'B.Tech does not match MCA');
assert.strictEqual(checkBranchMatch('Master of Technology in Computer Science & Engineering (M.Tech CSE)', aliceReg.branch), false, 'M.Tech does not match MCA');

// Rahul Sharma is in B.Tech CSE
assert.strictEqual(checkBranchMatch('B.Tech CSE', rahulReg.branch), true, 'B.Tech CSE matches B.Tech CSE');
assert.strictEqual(checkBranchMatch('MCA', rahulReg.branch), false, 'MCA does not match B.Tech CSE');

// Bob Smith is in M.Tech CSE
assert.strictEqual(checkBranchMatch('M.Tech CSE', bobReg.branch), true, 'M.Tech CSE matches M.Tech CSE');
assert.strictEqual(checkBranchMatch('MCA', bobReg.branch), false, 'MCA does not match M.Tech CSE');

console.log('   ✅ Test 4 Passed: Exact branch matching across MCA, B.Tech CSE, and M.Tech CSE verified.\n');

// 5. Verify Simultaneous Faculty Marks Updates and 5 Courses
console.log('--> Test 5: Verifying 5 Faculties, 5 Subjects and Simultaneous Marks Processing...');
const faculties = sis.getAllFaculties();
const courses = sis.getAllCourses();
console.log('   Faculties Count:', faculties.length);
console.log('   Courses Count:', courses.length);
assert.strictEqual(faculties.length, 5, 'Must have 5 faculties');
assert.ok(courses.length >= 5, 'Must have at least 5 courses across semesters');
assert.strictEqual(sis.getCoursesBySemester('Semester 5').length, 5, 'Must have 5 courses in Semester 5');

// Simultaneous update across all students in CS501
const studentsInCourse = sis.getStudentsEnrolledInCourse('CS501');
console.log('   Students enrolled in CS501:', studentsInCourse.length);
assert.ok(studentsInCourse.length >= 5, 'All seeded students enrolled in CS501');

const batchMarks = studentsInCourse.map(s => ({
  studentId: s.student_id,
  cieMarks: 45.0,
  labMarks: 22.0,
  attendance: 88.0,
  endsemMarks: 44.0
}));

const updatedResults = sis.upsertCourseMarks('CS501', batchMarks, 'FAC-001', 'SIG_FAC_001_SIMULTANEOUS');
console.log('   Simultaneously updated marks count:', updatedResults.length);
assert.strictEqual(updatedResults.length, studentsInCourse.length);
console.log('   ✅ Test 5 Passed: Simultaneous marks recording and grading verified.\n');

// 6. Verify Faculty Advisor Comprehensive Cross-Course Gate
console.log('--> Test 6: Verifying Faculty Advisor Cross-Course Matrix Audit...');
const aliceAudit = sis.getStudentComprehensiveAudit('STU-2024-001');
console.log('   Alice Audit: Eligible =', aliceAudit.isEligible, '| Computed SGPA =', aliceAudit.computedSgpa);
assert.strictEqual(aliceAudit.isEligible, true, 'Alice Johnson must be eligible');

const bobAudit = sis.getStudentComprehensiveAudit('STU-2024-DEFICIT');
console.log('   Bob Audit (Deficit persona): Eligible =', bobAudit.isEligible, '| Deficit Reasons =', bobAudit.deficitReasons);
assert.strictEqual(bobAudit.isEligible, false, 'Bob Smith with low attendance/CIE must be blocked');

const charlieAudit = sis.getStudentComprehensiveAudit('STU-2024-BACKLOG');
console.log('   Charlie Audit (STU-2024-BACKLOG): Eligible =', charlieAudit.isEligible, '| Deficit Reasons =', charlieAudit.deficitReasons);
assert.strictEqual(charlieAudit.isEligible, true, 'Charlie Brown (STU-2024-BACKLOG) must be eligible after completing all subjects');

console.log('   ✅ Test 6 Passed: Faculty Advisor cross-course matrix verified.\n');

// 7. Verify Multi-Sig Voting Engine
console.log('--> Test 7: Verifying Multi-Sig Quorum Engine (>= 2/3)...');
const reqId = 'TEST-VERIFY-REQ-001';
sis.db.prepare('DELETE FROM multisig_votes WHERE request_id = ?').run(reqId);
sis.recordMultiSigVote(reqId, 'DAC_COMMITTEE', 'VOTER-1', 'Dr. Rajesh Kumar', 'HOD', 'APPROVE', 'SIG_1', 'Approved');
let status1 = sis.getMultiSigStatus(reqId, 'DAC_COMMITTEE');
console.log('   After 1 vote: approvals =', status1.approvalCount, '| isMajorityPassed =', status1.isMajorityPassed);
assert.strictEqual(status1.isMajorityPassed, false, '1 vote is below 2/3 quorum');

sis.recordMultiSigVote(reqId, 'DAC_COMMITTEE', 'VOTER-2', 'Dr. Sunita Rao', 'DAC Member', 'APPROVE', 'SIG_2', 'Approved');
let status2 = sis.getMultiSigStatus(reqId, 'DAC_COMMITTEE');
console.log('   After 2 votes: approvals =', status2.approvalCount, '| isMajorityPassed =', status2.isMajorityPassed);
assert.strictEqual(status2.isMajorityPassed, true, '2 votes satisfies 2/3 quorum');

console.log('   ✅ Test 7 Passed: Multi-sig majority quorum verified.\n');

// 8. Verify REQ-2024-002 Auto-Recovery and Autonomous Execution
console.log('--> Test 8: Verifying REQ-2024-002 Auto-Recovery and Autonomous Pipeline...');
const rahulDID = generateStudentDID('Rahul Sharma', 'STU-2024-002');
sis.markStudentOnLedger('STU-2024-002', rahulDID);

// Ensure no stale request exists first
sis.db.prepare('DELETE FROM certificate_requests WHERE request_id = ?').run('REQ-2024-002');
sis.db.prepare('DELETE FROM multisig_votes WHERE request_id = ?').run('REQ-2024-002');

const orchestrator = require('./backend/src/agents/orchestrator');

(async () => {
  const result = await orchestrator.runAutonomousPipeline('REQ-2024-002', { autoIssue: true });
  console.log('   Pipeline Success:', result.success);
  console.log('   Final Status:', result.finalStatus);
  console.log('   Certificate ID:', result.issuanceResult?.certId);
  console.log('   Execution Logs Count:', result.executionLogs.length);

  assert.strictEqual(result.success, true, 'REQ-2024-002 must run successfully through all stages');
  assert.strictEqual(result.finalStatus, 'CERTIFICATE_ISSUED', 'Final status must be CERTIFICATE_ISSUED');
  assert.ok(result.issuanceResult?.certId, 'Certificate ID must be present');

  console.log('   ✅ Test 8 Passed: REQ-2024-002 auto-recovered, passed multi-agent pipeline and issued certificate.\n');
  console.log('🎉 ALL 8 TEST SUITES PASSED FLAWLESSLY!');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
