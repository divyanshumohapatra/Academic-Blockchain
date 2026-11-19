'use strict';

/**
 * Academic Department Prerequisite & Course Completion Verification Rules
 * Implements Contributor 1.1 Specification:
 * - Minimum statutory attendance (75.0%)
 * - Minimum cumulative CGPA (5.0 / 10.0)
 * - Required credits completion (B.Tech: 160, MCA: 120, M.Tech: 80, Default: 120)
 * - Zero unresolved academic backlogs
 * - Mandatory core prerequisite courses
 * - Administrative clearance (fee dues == 0, library clearance == true)
 */

const crypto = require('crypto');

const DEGREE_REQUIREMENTS = {
  'Bachelor of Technology in CSE': {
    requiredCredits: 160,
    minCgpa: 5.0,
    minAttendance: 75.0,
    maxBacklogs: 0,
    coreCourses: ['CS101', 'CS102', 'CS201', 'CS202', 'CS301']
  },
  'Master of Computer Applications (MCA)': {
    requiredCredits: 120,
    minCgpa: 5.0,
    minAttendance: 75.0,
    maxBacklogs: 0,
    coreCourses: ['MCA101', 'MCA102', 'MCA201', 'MCA202']
  },
  'Master of Technology (M.Tech)': {
    requiredCredits: 80,
    minCgpa: 6.0,
    minAttendance: 75.0,
    maxBacklogs: 0,
    coreCourses: ['MT501', 'MT502', 'MT601']
  },
  'Doctor of Philosophy (Ph.D)': {
    requiredCredits: 40,
    minCgpa: 6.5,
    minAttendance: 75.0,
    maxBacklogs: 0,
    coreCourses: ['RES901', 'RES902']
  },
  'default': {
    requiredCredits: 120,
    minCgpa: 5.0,
    minAttendance: 75.0,
    maxBacklogs: 0,
    coreCourses: []
  }
};

/**
 * Contributor 1.1 Enhancement: Course Prerequisite Dependency DAG
 * Maps courses to their mandatory foundational prerequisite courses.
 */
const COURSE_DEPENDENCIES = {
  'CS201': ['CS101'], // Data Structures requires Intro to Programming
  'CS202': ['CS102'], // Discrete Structures requires Engineering Mathematics
  'CS301': ['CS201'], // Operating Systems requires Data Structures
  'MCA201': ['MCA101'],
  'MCA202': ['MCA102'],
  'MT601': ['MT501']
};

/**
 * Contributor 1.1 Enhancement: Calculate Latin Academic Honors & Standing
 */
function calculateAcademicStanding(cgpa = 0, attendance = 0, backlogs = 0) {
  const numCgpa = Number(cgpa) || 0;
  const numAtt = Number(attendance) || 0;
  const numBacklogs = Number(backlogs) || 0;

  if (numBacklogs > 0 || numCgpa < 5.0) {
    return { standing: 'ACADEMIC_PROBATION', honors: 'NONE' };
  }

  let honors = 'NONE';
  if (numCgpa >= 9.5 && numAtt >= 85.0) {
    honors = 'SUMMA_CUM_LAUDE';
  } else if (numCgpa >= 9.0) {
    honors = 'MAGNA_CUM_LAUDE';
  } else if (numCgpa >= 8.5) {
    honors = numAtt >= 90.0 ? 'DEAN_HONOR_ROLL' : 'CUM_LAUDE';
  }

  return { standing: 'GOOD_STANDING', honors };
}

/**
 * Contributor 1.1 Enhancement: Cryptographic Digital Signature Verification
 */
function verifyStudentRequestSignature(publicKeyPem, studentId, requestId, certType, timestamp, signatureBase64) {
  try {
    if (!publicKeyPem || !signatureBase64) return false;
    const canonicalPayload = `${String(studentId).trim()}:${String(requestId).trim()}:${String(certType).trim()}:${timestamp || ''}`;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalPayload);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve requirements profile for a specific degree
 */
function getDegreeRequirements(certType = '') {
  for (const [key, reqs] of Object.entries(DEGREE_REQUIREMENTS)) {
    if (key !== 'default' && certType.toLowerCase().includes(key.toLowerCase())) {
      return { degree: key, ...reqs };
    }
  }
  return { degree: 'Standard Academic Degree', ...DEGREE_REQUIREMENTS.default };
}

/**
 * Evaluate all prerequisite rules for a student and proposed certificate request
 * @param {Object} student - Registered student on-chain record
 * @param {string} certType - Type of certificate requested
 * @param {Object} submittedDetails - Request details submitted in request body
 * @returns {Object} { eligible, violations, evaluatedCriteria, requirements }
 */
function evaluatePrerequisites(student = {}, certType = '', submittedDetails = {}) {
  const reqs = getDegreeRequirements(certType);
  const violations = [];
  const evaluatedCriteria = {};

  // Extract student metrics, prioritizing explicitly submitted metrics or on-chain record
  const academicRecord = student.academicRecord || {};
  
  // 1. Attendance Check (Statutory minimum 75%)
  const attendance = Number(
    submittedDetails.attendance !== undefined 
      ? submittedDetails.attendance 
      : (academicRecord.attendance !== undefined ? academicRecord.attendance : 85.0)
  );
  evaluatedCriteria.attendance = {
    value: attendance,
    required: reqs.minAttendance,
    passed: attendance >= reqs.minAttendance
  };
  if (!evaluatedCriteria.attendance.passed) {
    violations.push(`Attendance requirement not met: ${attendance}% recorded, minimum required is ${reqs.minAttendance}%`);
  }

  // 2. CGPA Check
  const cgpa = Number(
    submittedDetails.cgpa !== undefined 
      ? submittedDetails.cgpa 
      : (academicRecord.cgpa !== undefined ? academicRecord.cgpa : 8.0)
  );
  evaluatedCriteria.cgpa = {
    value: cgpa,
    required: reqs.minCgpa,
    passed: cgpa >= reqs.minCgpa
  };
  if (!evaluatedCriteria.cgpa.passed) {
    violations.push(`CGPA requirement not met: ${cgpa} recorded, minimum required is ${reqs.minCgpa}`);
  }

  // 3. Credit Completion Check
  const totalCredits = Number(
    submittedDetails.totalCredits !== undefined 
      ? submittedDetails.totalCredits 
      : (academicRecord.totalCredits !== undefined ? academicRecord.totalCredits : reqs.requiredCredits)
  );
  const requiredCredits = Number(
    submittedDetails.requiredCredits !== undefined 
      ? submittedDetails.requiredCredits 
      : (academicRecord.requiredCredits !== undefined ? academicRecord.requiredCredits : reqs.requiredCredits)
  );
  evaluatedCriteria.credits = {
    totalCredits,
    requiredCredits,
    passed: totalCredits >= requiredCredits
  };
  if (!evaluatedCriteria.credits.passed) {
    violations.push(`Credits completion requirement not met: ${totalCredits} earned, ${requiredCredits} required`);
  }

  // 4. Backlog Check
  const backlogs = Number(
    submittedDetails.backlogs !== undefined 
      ? submittedDetails.backlogs 
      : (academicRecord.backlogs !== undefined ? academicRecord.backlogs : 0)
  );
  evaluatedCriteria.backlogs = {
    value: backlogs,
    allowed: reqs.maxBacklogs,
    passed: backlogs <= reqs.maxBacklogs
  };
  if (!evaluatedCriteria.backlogs.passed) {
    violations.push(`Unresolved academic backlogs: ${backlogs} active backlog(s) found, 0 permitted for degree issuance`);
  }

  // 5. Course Prerequisites Check
  const completedCourses = Array.isArray(submittedDetails.completedCourses)
    ? submittedDetails.completedCourses
    : (Array.isArray(academicRecord.completedCourses) ? academicRecord.completedCourses : reqs.coreCourses);
  
  const missingCoreCourses = reqs.coreCourses.filter(course => !completedCourses.includes(course));
  evaluatedCriteria.coreCourses = {
    required: reqs.coreCourses,
    completed: completedCourses,
    missing: missingCoreCourses,
    passed: missingCoreCourses.length === 0
  };
  if (missingCoreCourses.length > 0) {
    violations.push(`Mandatory prerequisite core courses missing: ${missingCoreCourses.join(', ')}`);
  }

  // 5b. Contributor 1.1 Enhancement: Prerequisite Dependency Graph (DAG) Check
  const dagViolations = [];
  for (const course of completedCourses) {
    const requiredPrereqs = COURSE_DEPENDENCIES[course] || [];
    for (const prereq of requiredPrereqs) {
      if (!completedCourses.includes(prereq)) {
        dagViolations.push(`Prerequisite dependency broken: '${course}' requires prior completion of '${prereq}'`);
      }
    }
  }
  evaluatedCriteria.prerequisiteGraph = {
    evaluated: true,
    passed: dagViolations.length === 0,
    brokenDependencies: dagViolations
  };
  if (dagViolations.length > 0) {
    violations.push(...dagViolations);
  }

  // 5c. Contributor 1.1 Enhancement: Academic Standing & Latin Honors Attestation
  const standingAttestation = calculateAcademicStanding(cgpa, attendance, backlogs);
  evaluatedCriteria.academicStanding = standingAttestation;

  // 6. Dues and Administrative Clearance
  if (submittedDetails.feeDues !== undefined && Number(submittedDetails.feeDues) > 0) {
    evaluatedCriteria.feeDues = { value: Number(submittedDetails.feeDues), passed: false };
    violations.push(`Outstanding tuition fee dues: ₹${submittedDetails.feeDues}`);
  } else {
    evaluatedCriteria.feeDues = { value: 0, passed: true };
  }

  if (submittedDetails.libraryDues !== undefined && Number(submittedDetails.libraryDues) > 0) {
    evaluatedCriteria.libraryDues = { value: Number(submittedDetails.libraryDues), passed: false };
    violations.push(`Outstanding library fine / non-returned items: ₹${submittedDetails.libraryDues}`);
  } else {
    evaluatedCriteria.libraryDues = { value: 0, passed: true };
  }

  const eligible = violations.length === 0;

  return {
    eligible,
    violations,
    evaluatedCriteria,
    requirements: reqs,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  DEGREE_REQUIREMENTS,
  COURSE_DEPENDENCIES,
  getDegreeRequirements,
  calculateAcademicStanding,
  verifyStudentRequestSignature,
  evaluatePrerequisites
};
