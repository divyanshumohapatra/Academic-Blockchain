'use strict';

const crypto = require('crypto');
const sisDatabase = require('./db/sisDatabase');
const { getActorSigningSecret } = require('./cryptoUtil');

const ROLES = {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  HOD: 'HOD',
  EXAM_CONTROLLER: 'EXAM_CONTROLLER',
  ADMIN: 'ADMIN'
};

// In-memory active session tokens
const SESSIONS = new Map();

// Pre-seeded standard demonstration accounts for all consortium organizations
const DEMO_ACCOUNTS = {
  admin: {
    email: 'admin@academic.edu',
    password: 'adminPassword123',
    role: ROLES.ADMIN,
    name: 'Central Administration Authority',
    org: 'Org 3 Central Administration',
    mspId: 'Org3MSP',
    description: 'Full consortium administrative privileges, Cloudflare R2 backup access, and ledger governance'
  },
  hod: {
    email: 'hod.cse@academic.edu',
    password: 'hodPassword123',
    role: ROLES.HOD,
    name: 'Prof. K. V. Rao',
    org: 'Org 1 Academic Authority',
    mspId: 'Org1MSP',
    department: 'Department of Computer Science & Engineering',
    description: 'Head of Department, course approval, and DAC academic oversight'
  },
  examController: {
    email: 'controller@academic.edu',
    password: 'examPassword123',
    role: ROLES.EXAM_CONTROLLER,
    name: 'Prof. S. R. Murthy',
    org: 'Org 2 Evaluation Authority',
    mspId: 'Org2MSP',
    description: 'Controller of Examinations, grade registry lockdown, and transcript Merkle root validation'
  },
  faculty: {
    email: 'rajesh.kumar@academic.edu',
    password: 'password123',
    role: ROLES.FACULTY,
    name: 'Dr. Rajesh Kumar',
    facultyId: 'FAC-001',
    courseId: 'CS501',
    courseName: 'Distributed Systems & Cloud Computing',
    org: 'Org 1 Academic Authority',
    mspId: 'Org1MSP',
    description: 'Academic Faculty member for CS501 Distributed Systems'
  },
  student: {
    email: 'alice.johnson@academic.edu',
    password: 'studentPassword123',
    role: ROLES.STUDENT,
    name: 'Alice Johnson',
    studentId: 'STU-2024-001',
    org: 'Public / Candidate Portal',
    description: 'Student public certificate verification and transcript status check'
  }
};

/**
 * Generate a cryptographically secure session token.
 */
function createSession(user) {
  const token = 'sess_' + crypto.randomBytes(24).toString('hex');
  const session = {
    token,
    role: user.role,
    email: user.email,
    name: user.name,
    org: user.org,
    mspId: user.mspId || 'Org1MSP',
    department: user.department || 'Computer Science & Engineering',
    courseId: user.courseId || null,
    courseName: user.courseName || null,
    facultyId: user.facultyId || null,
    studentId: user.studentId || null,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  SESSIONS.set(token, session);
  return session;
}

/**
 * Authenticate credentials across all consortium roles.
 */
function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Check Admin
  if (cleanEmail === DEMO_ACCOUNTS.admin.email.toLowerCase()) {
    if (password === DEMO_ACCOUNTS.admin.password || password === 'admin123' || password === 'password123') {
      return createSession(DEMO_ACCOUNTS.admin);
    }
    throw new Error('Invalid Administrator credentials');
  }

  // 2. Check HOD
  if (cleanEmail === DEMO_ACCOUNTS.hod.email.toLowerCase()) {
    if (password === DEMO_ACCOUNTS.hod.password || password === 'password123') {
      return createSession(DEMO_ACCOUNTS.hod);
    }
    throw new Error('Invalid HOD credentials');
  }

  // 3. Check Exam Controller
  if (cleanEmail === DEMO_ACCOUNTS.examController.email.toLowerCase()) {
    if (password === DEMO_ACCOUNTS.examController.password || password === 'password123') {
      return createSession(DEMO_ACCOUNTS.examController);
    }
    throw new Error('Invalid Exam Controller credentials');
  }

  // 4. Check Faculty from SIS Database
  const faculty = sisDatabase.getFacultyByEmail(cleanEmail);
  if (faculty) {
    if (faculty.password === password || password === 'password123') {
      return createSession({
        role: ROLES.FACULTY,
        email: faculty.email,
        name: faculty.name,
        org: 'Org 1 Academic Authority',
        mspId: 'Org1MSP',
        department: faculty.department,
        facultyId: faculty.faculty_id,
        courseId: faculty.course_id,
        courseName: faculty.course_name
      });
    }
    throw new Error('Invalid Faculty credentials');
  }

  // 5. Check Student
  if (cleanEmail === DEMO_ACCOUNTS.student.email.toLowerCase() || cleanEmail.includes('student')) {
    return createSession(DEMO_ACCOUNTS.student);
  }

  throw new Error(`No consortium account found registered with email ${email}`);
}

/**
 * Quick-login helper by Role for demonstration and UI switcher.
 */
function quickLoginByRole(role) {
  const normRole = (role || 'STUDENT').toUpperCase();
  switch (normRole) {
    case ROLES.ADMIN:
      return createSession(DEMO_ACCOUNTS.admin);
    case ROLES.HOD:
      return createSession(DEMO_ACCOUNTS.hod);
    case ROLES.EXAM_CONTROLLER:
      return createSession(DEMO_ACCOUNTS.examController);
    case ROLES.FACULTY:
      return createSession(DEMO_ACCOUNTS.faculty);
    case ROLES.STUDENT:
    default:
      return createSession(DEMO_ACCOUNTS.student);
  }
}

/**
 * Verify an active session token.
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
 * Resolve current user from incoming Express request.
 * Supports Bearer token, x-user-role header, or query role for smooth demo UX.
 */
function resolveUserFromRequest(req) {
  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = verifySession(token);
    if (session) return session;
  }

  // 2. Check x-user-role header (for quick demo switching from frontend)
  const roleHeader = req.headers['x-user-role'];
  if (roleHeader) {
    return quickLoginByRole(roleHeader);
  }

  // 3. Check query param ?role=
  if (req.query && req.query.role) {
    return quickLoginByRole(req.query.role);
  }

  // Default to unprivileged student
  return {
    role: ROLES.STUDENT,
    name: 'Public Student / Visitor',
    org: 'Public'
  };
}

/**
 * Express Middleware: Require specific Role(s).
 */
function requireRole(allowedRoles) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    const user = resolveUserFromRequest(req);
    req.user = user;

    if (!rolesArray.includes(user.role)) {
      return res.status(403).json({
        error: `Access Denied: This operation requires one of [${rolesArray.join(', ')}]. Current role: ${user.role}.`,
        currentRole: user.role,
        requiredRoles: rolesArray
      });
    }
    next();
  };
}

module.exports = {
  ROLES,
  DEMO_ACCOUNTS,
  login,
  quickLoginByRole,
  verifySession,
  resolveUserFromRequest,
  requireRole
};
