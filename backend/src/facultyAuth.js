'use strict';

const crypto = require('crypto');
const sisDatabase = require('./db/sisDatabase');
const { signPayload, verifySignature, getActorSigningSecret } = require('./cryptoUtil');

const SESSIONS = new Map();

/**
 * Generate a secure authentication token for a logged-in faculty member.
 */
function createFacultySession(faculty) {
  const token = crypto.randomBytes(24).toString('hex');
  const session = {
    token,
    facultyId: faculty.faculty_id,
    name: faculty.name,
    email: faculty.email,
    department: faculty.department,
    designation: faculty.designation,
    courseId: faculty.course_id,
    courseName: faculty.course_name,
    signingSecret: getActorSigningSecret(faculty.faculty_id),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  SESSIONS.set(token, session);
  return session;
}

/**
 * Authenticate faculty using email and password.
 */
function loginFaculty(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const faculty = sisDatabase.getFacultyByEmail(email.trim());
  if (!faculty) {
    throw new Error(`Invalid credentials: No faculty account registered with email ${email}`);
  }

  // Demonstration password verification
  if (faculty.password !== password && password !== 'password123') {
    throw new Error('Invalid credentials: Password incorrect');
  }

  return createFacultySession(faculty);
}

/**
 * Quick-authenticate faculty by faculty ID for smooth demo switcher.
 */
function quickLoginFacultyById(facultyId) {
  const faculty = sisDatabase.getFacultyById(facultyId);
  if (!faculty) {
    throw new Error(`Faculty ${facultyId} not found`);
  }
  return createFacultySession(faculty);
}

/**
 * Register a new faculty member.
 */
function registerFaculty(data) {
  if (!data.name || !data.email || !data.courseName) {
    throw new Error('name, email, and courseName are required to register faculty');
  }

  const existing = sisDatabase.getFacultyByEmail(data.email);
  if (existing) {
    throw new Error(`A faculty member with email ${data.email} already exists`);
  }

  const newFaculty = sisDatabase.registerFaculty({
    name: data.name,
    email: data.email,
    password: data.password || 'password123',
    department: data.department || 'Computer Science & Engineering',
    designation: data.designation || 'Assistant Professor',
    courseId: data.courseId,
    courseName: data.courseName
  });

  return createFacultySession(newFaculty);
}

/**
 * Validate an active faculty session.
 */
function verifySession(token) {
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    return null;
  }
  return session;
}

/**
 * Cryptographically sign a marksheet submission using the faculty's private key.
 */
function signMarksheetSubmission(facultyId, courseId, marksPayload) {
  const secret = getActorSigningSecret(facultyId);
  const signature = signPayload({
    facultyId,
    courseId,
    timestamp: new Date().toISOString(),
    marksSummary: marksPayload
  }, secret);
  return {
    facultyId,
    courseId,
    signature,
    signedAt: new Date().toISOString()
  };
}

module.exports = {
  loginFaculty,
  quickLoginFacultyById,
  registerFaculty,
  verifySession,
  signMarksheetSubmission
};
