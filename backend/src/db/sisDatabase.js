'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const STORAGE_DIR = path.join(__dirname, '../../storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const DB_PATH = path.join(STORAGE_DIR, 'university_sis.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    enrollment_year TEXT NOT NULL,
    attendance REAL NOT NULL DEFAULT 85.0,
    cie_marks REAL NOT NULL DEFAULT 40.0,
    prerequisites_met INTEGER NOT NULL DEFAULT 1,
    total_credits INTEGER NOT NULL DEFAULT 160,
    required_credits INTEGER NOT NULL DEFAULT 160,
    disciplinary_clearance INTEGER NOT NULL DEFAULT 1,
    capstone_score REAL NOT NULL DEFAULT 85.0,
    originality_report REAL NOT NULL DEFAULT 92.0,
    cgpa REAL NOT NULL DEFAULT 8.50,
    backlogs INTEGER NOT NULL DEFAULT 0,
    residency_met INTEGER NOT NULL DEFAULT 1,
    institutional_clearance INTEGER NOT NULL DEFAULT 1,
    fee_dues REAL NOT NULL DEFAULT 0.0,
    library_dues REAL NOT NULL DEFAULT 0.0
  );
`);

// Pre-seed realistic student personas
const SEED_STUDENTS = [
  {
    student_id: 'STU-2024-001',
    name: 'Alice Johnson',
    email: 'alice@academic.edu',
    department: 'Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 91.2,
    cie_marks: 46.0,
    prerequisites_met: 1,
    total_credits: 164,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 92.0,
    originality_report: 96.0,
    cgpa: 9.15,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0
  },
  {
    student_id: 'STU-2024-002',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@academic.edu',
    department: 'Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 84.0,
    cie_marks: 38.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 82.0,
    originality_report: 88.0,
    cgpa: 8.40,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0
  },
  {
    student_id: 'STU-2024-DEFICIT',
    name: 'Bob Smith',
    email: 'bob.smith@academic.edu',
    department: 'Mechanical Engineering',
    enrollment_year: '2024',
    attendance: 62.0,       // Below 75% statutory requirement
    cie_marks: 18.0,        // Below 20.0/50 requirement
    prerequisites_met: 0,
    total_credits: 144,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 65.0,
    originality_report: 82.0,
    cgpa: 6.80,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0
  },
  {
    student_id: 'STU-2024-BACKLOG',
    name: 'Charlie Brown',
    email: 'charlie.brown@academic.edu',
    department: 'Electrical Engineering',
    enrollment_year: '2024',
    attendance: 80.0,
    cie_marks: 32.0,
    prerequisites_met: 1,
    total_credits: 152,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 75.0,
    originality_report: 85.0,
    cgpa: 6.10,
    backlogs: 2,            // Active backlogs block exam lockdown
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0
  },
  {
    student_id: 'STU-2024-DUES',
    name: 'Diana Prince',
    email: 'diana.prince@academic.edu',
    department: 'Civil Engineering',
    enrollment_year: '2024',
    attendance: 89.0,
    cie_marks: 44.0,
    prerequisites_met: 1,
    total_credits: 162,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 88.0,
    originality_report: 90.0,
    cgpa: 8.90,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 25000.0,      // Unpaid tuition dues block final authorization
    library_dues: 1500.0    // Unpaid library dues block final authorization
  },
  {
    student_id: 'STU-2024-CAPSTONE',
    name: 'Evan Wright',
    email: 'evan.wright@academic.edu',
    department: 'Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 82.0,
    cie_marks: 36.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 45.0,   // Below 60 capstone score
    originality_report: 52.0,// Below 80% originality report
    cgpa: 7.20,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0
  }
];

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO students (
    student_id, name, email, department, enrollment_year,
    attendance, cie_marks, prerequisites_met, total_credits, required_credits,
    disciplinary_clearance, capstone_score, originality_report,
    cgpa, backlogs, residency_met, institutional_clearance, fee_dues, library_dues
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`);

for (const s of SEED_STUDENTS) {
  insertStmt.run(
    s.student_id, s.name, s.email, s.department, s.enrollment_year,
    s.attendance, s.cie_marks, s.prerequisites_met, s.total_credits, s.required_credits,
    s.disciplinary_clearance, s.capstone_score, s.originality_report,
    s.cgpa, s.backlogs, s.residency_met, s.institutional_clearance, s.fee_dues, s.library_dues
  );
}

function formatStudentRecord(row) {
  if (!row) return null;
  return {
    studentId: row.student_id,
    name: row.name,
    email: row.email,
    department: row.department,
    enrollmentYear: row.enrollment_year,
    attendance: Number(row.attendance),
    cieMarks: Number(row.cie_marks),
    prerequisitesMet: Boolean(row.prerequisites_met),
    totalCredits: Number(row.total_credits),
    requiredCredits: Number(row.required_credits),
    disciplinaryClearance: Boolean(row.disciplinary_clearance),
    capstoneScore: Number(row.capstone_score),
    originalityReport: Number(row.originality_report),
    cgpa: Number(row.cgpa),
    backlogs: Number(row.backlogs),
    residencyMet: Boolean(row.residency_met),
    institutionalClearance: Boolean(row.institutional_clearance),
    feeDues: Number(row.fee_dues),
    libraryDues: Number(row.library_dues)
  };
}

function getStudentByRollNumber(studentId) {
  if (!studentId) return null;
  const stmt = db.prepare('SELECT * FROM students WHERE student_id = ?');
  const row = stmt.get(studentId.trim());
  return formatStudentRecord(row);
}

function getAllSISStudents() {
  const stmt = db.prepare('SELECT * FROM students ORDER BY student_id ASC');
  const rows = stmt.all();
  return rows.map(formatStudentRecord);
}

function addOrUpdateStudent(data) {
  insertStmt.run(
    data.studentId || data.student_id,
    data.name,
    data.email,
    data.department || 'Computer Science & Engineering',
    data.enrollmentYear || data.enrollment_year || '2024',
    data.attendance !== undefined ? Number(data.attendance) : 85.0,
    data.cieMarks !== undefined ? Number(data.cieMarks) : 40.0,
    data.prerequisitesMet !== undefined ? (data.prerequisitesMet ? 1 : 0) : 1,
    data.totalCredits !== undefined ? Number(data.totalCredits) : 160,
    data.requiredCredits !== undefined ? Number(data.requiredCredits) : 160,
    data.disciplinaryClearance !== undefined ? (data.disciplinaryClearance ? 1 : 0) : 1,
    data.capstoneScore !== undefined ? Number(data.capstoneScore) : 85.0,
    data.originalityReport !== undefined ? Number(data.originalityReport) : 90.0,
    data.cgpa !== undefined ? Number(data.cgpa) : 8.50,
    data.backlogs !== undefined ? Number(data.backlogs) : 0,
    data.residencyMet !== undefined ? (data.residencyMet ? 1 : 0) : 1,
    data.institutionalClearance !== undefined ? (data.institutionalClearance ? 1 : 0) : 1,
    data.feeDues !== undefined ? Number(data.feeDues) : 0.0,
    data.libraryDues !== undefined ? Number(data.libraryDues) : 0.0
  );
  return getStudentByRollNumber(data.studentId || data.student_id);
}

module.exports = {
  db,
  DB_PATH,
  getStudentByRollNumber,
  getAllSISStudents,
  addOrUpdateStudent
};
