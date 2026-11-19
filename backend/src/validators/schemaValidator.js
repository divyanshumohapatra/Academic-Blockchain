'use strict';

/**
 * Rich Schema Validation for Student Onboarding and Certificate Requests
 * Contributor 1.1 — Academic Chaincode & REST API Validation Lead
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_REGEX = /^[A-Za-z0-9_-]{3,32}$/;
const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

function validateStudentInput(data = {}) {
  const errors = [];

  // studentId
  if (!data.studentId || typeof data.studentId !== 'string') {
    errors.push('studentId is required and must be a string');
  } else if (!STUDENT_ID_REGEX.test(data.studentId.trim())) {
    errors.push(`studentId '${data.studentId}' is invalid: must be 3-32 alphanumeric characters, dashes, or underscores`);
  }

  // name
  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  } else {
    const trimmed = data.name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      errors.push('name must be between 2 and 100 characters');
    }
  }

  // email
  if (!data.email || typeof data.email !== 'string') {
    errors.push('email is required and must be a string');
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.push(`email '${data.email}' is invalid: must be a valid email address format (e.g. student@academic.edu)`);
  }

  // department
  if (data.department && typeof data.department !== 'string') {
    errors.push('department must be a string');
  }

  // enrollmentYear
  if (data.enrollmentYear !== undefined) {
    const year = Number(data.enrollmentYear);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1990 || year > currentYear + 2) {
      errors.push(`enrollmentYear must be a 4-digit year between 1990 and ${currentYear + 2}`);
    }
  }

  // Optional Academic Record fields
  if (data.cgpa !== undefined) {
    const cgpa = Number(data.cgpa);
    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10.0) {
      errors.push('cgpa must be a number between 0.0 and 10.0');
    }
  }

  if (data.totalCredits !== undefined) {
    const credits = Number(data.totalCredits);
    if (isNaN(credits) || credits < 0) {
      errors.push('totalCredits must be a non-negative number');
    }
  }

  if (data.attendance !== undefined) {
    const att = Number(data.attendance);
    if (isNaN(att) || att < 0 || att > 100.0) {
      errors.push('attendance must be a percentage between 0.0 and 100.0');
    }
  }

  if (data.backlogs !== undefined) {
    const backlogs = Number(data.backlogs);
    if (isNaN(backlogs) || backlogs < 0 || !Number.isInteger(backlogs)) {
      errors.push('backlogs must be a non-negative integer');
    }
  }

  if (data.completedCourses !== undefined && !Array.isArray(data.completedCourses)) {
    errors.push('completedCourses must be an array of course code strings');
  }

  // Contributor 1.1 Enhancement: Optional Public Key format validation
  if (data.publicKeyPem !== undefined || data.publicKey !== undefined) {
    const key = data.publicKeyPem || data.publicKey;
    if (typeof key !== 'string' || (!key.includes('BEGIN PUBLIC KEY') && key.length < 32)) {
      errors.push('publicKey must be a valid PEM formatted string or hex public key');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateRequestInput(data = {}) {
  const errors = [];

  // requestId
  if (!data.requestId || typeof data.requestId !== 'string') {
    errors.push('requestId is required and must be a string');
  } else if (!REQUEST_ID_REGEX.test(data.requestId.trim())) {
    errors.push(`requestId '${data.requestId}' is invalid: must be 3-64 alphanumeric characters, dashes, or underscores`);
  }

  // studentId
  if (!data.studentId || typeof data.studentId !== 'string') {
    errors.push('studentId is required and must be a string');
  } else if (!STUDENT_ID_REGEX.test(data.studentId.trim())) {
    errors.push(`studentId '${data.studentId}' is invalid: must be 3-32 alphanumeric characters, dashes, or underscores`);
  }

  // certType
  if (!data.certType || typeof data.certType !== 'string' || data.certType.trim().length < 3) {
    errors.push('certType is required and must be at least 3 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  EMAIL_REGEX,
  STUDENT_ID_REGEX,
  REQUEST_ID_REGEX,
  validateStudentInput,
  validateRequestInput
};
