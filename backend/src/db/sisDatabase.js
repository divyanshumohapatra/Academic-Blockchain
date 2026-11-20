'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { generateStudentDID } = require('../cryptoUtil');

const STORAGE_DIR = path.join(__dirname, '../../storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const DB_PATH = path.join(STORAGE_DIR, 'university_sis.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    did TEXT,
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
    library_dues REAL NOT NULL DEFAULT 0.0,
    is_on_ledger INTEGER NOT NULL DEFAULT 0,
    registered_on_ledger_at TEXT
  );

  CREATE TABLE IF NOT EXISTS student_semester_registrations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL UNIQUE,
    student_name TEXT NOT NULL,
    department TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester_number INTEGER NOT NULL DEFAULT 5,
    semester_label TEXT NOT NULL DEFAULT 'Semester 5',
    academic_year TEXT NOT NULL DEFAULT '2024-2025',
    registered_courses_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS faculties (
    faculty_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    course_id TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    department TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 4,
    faculty_id TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Semester 5'
  );

  CREATE TABLE IF NOT EXISTS course_enrollments (
    course_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_did TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Semester 5',
    PRIMARY KEY (course_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS course_marks (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_did TEXT NOT NULL,
    cie_marks REAL NOT NULL DEFAULT 0.0,
    lab_marks REAL NOT NULL DEFAULT 0.0,
    attendance REAL NOT NULL DEFAULT 0.0,
    endsem_marks REAL NOT NULL DEFAULT 0.0,
    total_marks REAL NOT NULL DEFAULT 0.0,
    grade TEXT NOT NULL DEFAULT 'PENDING',
    signed_by_faculty INTEGER NOT NULL DEFAULT 0,
    faculty_signature TEXT,
    faculty_id TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    submitted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS multisig_votes (
    vote_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    voter_role TEXT NOT NULL,
    decision TEXT NOT NULL,
    signature TEXT NOT NULL,
    comments TEXT,
    voted_at TEXT NOT NULL
  );
`);

// Safe migration: Ensure 'did' column exists in students if db existed previously
try {
  db.exec('ALTER TABLE students ADD COLUMN did TEXT;');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE students ADD COLUMN is_on_ledger INTEGER NOT NULL DEFAULT 0;');
} catch (e) {}

try {
  db.exec('ALTER TABLE students ADD COLUMN registered_on_ledger_at TEXT;');
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_semester_registrations (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      student_name TEXT NOT NULL,
      department TEXT NOT NULL,
      branch TEXT NOT NULL,
      semester_number INTEGER NOT NULL DEFAULT 5,
      semester_label TEXT NOT NULL DEFAULT 'Semester 5',
      academic_year TEXT NOT NULL DEFAULT '2024-2025',
      registered_courses_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );
  `);
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS certificate_requests (
      request_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      student_did TEXT NOT NULL,
      student_name TEXT NOT NULL,
      cert_type TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      details_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      cert_id TEXT PRIMARY KEY,
      request_id TEXT,
      student_id TEXT NOT NULL,
      student_name TEXT,
      student_did TEXT,
      department TEXT,
      cert_type TEXT,
      ipfs_hash TEXT,
      r2_uri TEXT,
      doc_hash TEXT,
      issue_date TEXT,
      status TEXT NOT NULL DEFAULT 'ISSUED',
      created_at TEXT NOT NULL
    );
  `);
} catch (e) {}

try {
  db.exec('ALTER TABLE certificates ADD COLUMN r2_uri TEXT;');
} catch (e) {}

// 5 Pre-Seeded Faculties & 5 Distinct Subjects
const SEED_FACULTIES = [
  {
    faculty_id: 'FAC-001',
    name: 'Dr. Rajesh Kumar',
    email: 'rajesh.kumar@academic.edu',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Professor & Distributed Systems Chair',
    course_id: 'CS501',
    course_name: 'Distributed Systems & Cloud Computing'
  },
  {
    faculty_id: 'FAC-002',
    name: 'Dr. Sunita Rao',
    email: 'sunita.rao@academic.edu',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Associate Professor & Blockchain Lead',
    course_id: 'CS502',
    course_name: 'Blockchain Architecture & Consensus Protocols'
  },
  {
    faculty_id: 'FAC-003',
    name: 'Dr. Anand Patel',
    email: 'anand.patel@academic.edu',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Professor & Cryptography Chair',
    course_id: 'CS503',
    course_name: 'Applied Cryptography & Zero-Knowledge Proofs'
  },
  {
    faculty_id: 'FAC-004',
    name: 'Dr. Meenakshi Sundaram',
    email: 'meenakshi.s@academic.edu',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Associate Professor & Algorithms Lab Lead',
    course_id: 'CS504',
    course_name: 'Advanced Algorithms & Distributed State'
  },
  {
    faculty_id: 'FAC-005',
    name: 'Dr. Vikram Malhotra',
    email: 'vikram.malhotra@academic.edu',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Professor & AI Research Director',
    course_id: 'CS505',
    course_name: 'Decentralized AI & Autonomous Agents'
  }
];

// Pre-seed realistic student personas with DIDs
const SEED_STUDENTS = [
  {
    student_id: 'STU-2024-001',
    name: 'Alice Johnson',
    email: 'alice@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 92.0,
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
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-002',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@academic.edu',
    department: 'Department of Computer Science & Engineering',
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
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-003',
    name: 'Priya Patel',
    email: 'priya.patel@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 88.0,
    cie_marks: 42.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 86.0,
    originality_report: 90.0,
    cgpa: 8.65,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 25000.0,
    library_dues: 1200.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-004',
    name: 'David Miller',
    email: 'david.miller@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 78.0,
    cie_marks: 22.0,
    prerequisites_met: 1,
    total_credits: 156,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 60.0,
    originality_report: 80.0,
    cgpa: 5.80,
    backlogs: 1,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-005',
    name: 'Ananya Rao',
    email: 'ananya.rao@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 61.5,
    cie_marks: 16.0,
    prerequisites_met: 0,
    total_credits: 148,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 70.0,
    originality_report: 82.0,
    cgpa: 6.80,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-006',
    name: 'Vikram Malhotra',
    email: 'vikram.m.student@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 90.0,
    cie_marks: 44.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 88.0,
    originality_report: 94.0,
    cgpa: 8.90,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2020-013',
    name: 'Divyanshu Mohapatra',
    email: 'divyanshu.m@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2020',
    attendance: 90.0,
    cie_marks: 45.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 90.0,
    originality_report: 95.0,
    cgpa: 8.85,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-BACKLOG',
    name: 'Charlie Brown',
    email: 'charlie.brown@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 80.0,
    cie_marks: 32.0,
    prerequisites_met: 1,
    total_credits: 160,
    required_credits: 160,
    disciplinary_clearance: 1,
    capstone_score: 75.0,
    originality_report: 85.0,
    cgpa: 6.10,
    backlogs: 0,
    residency_met: 1,
    institutional_clearance: 1,
    fee_dues: 0.0,
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-DEFICIT',
    name: 'Bob Smith',
    email: 'bob.smith@academic.edu',
    department: 'Department of Computer Science & Engineering',
    enrollment_year: '2024',
    attendance: 62.0,
    cie_marks: 18.0,
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
    library_dues: 0.0,
    is_on_ledger: 1
  },
  {
    student_id: 'STU-2024-DUES',
    name: 'Diana Prince',
    email: 'diana.prince@academic.edu',
    department: 'Department of Computer Science & Engineering',
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
    fee_dues: 25000.0,
    library_dues: 1500.0,
    is_on_ledger: 1
  }
];

// Seed Students into Database (Default is_on_ledger = 0: In SIS Database, NOT on Ledger yet)
const insertStudentStmt = db.prepare(`
  INSERT INTO students (
    student_id, did, name, email, department, enrollment_year,
    attendance, cie_marks, prerequisites_met, total_credits, required_credits,
    disciplinary_clearance, capstone_score, originality_report,
    cgpa, backlogs, residency_met, institutional_clearance, fee_dues, library_dues,
    is_on_ledger, registered_on_ledger_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?
  )
  ON CONFLICT(student_id) DO UPDATE SET
    name = excluded.name,
    email = excluded.email,
    department = excluded.department,
    enrollment_year = excluded.enrollment_year,
    attendance = excluded.attendance,
    cie_marks = excluded.cie_marks,
    prerequisites_met = excluded.prerequisites_met,
    total_credits = excluded.total_credits,
    required_credits = excluded.required_credits,
    disciplinary_clearance = excluded.disciplinary_clearance,
    capstone_score = excluded.capstone_score,
    originality_report = excluded.originality_report,
    cgpa = excluded.cgpa,
    backlogs = excluded.backlogs,
    residency_met = excluded.residency_met,
    institutional_clearance = excluded.institutional_clearance,
    fee_dues = excluded.fee_dues,
    library_dues = excluded.library_dues
`);

for (const s of SEED_STUDENTS) {
  const did = generateStudentDID(s.name, s.student_id);
  insertStudentStmt.run(
    s.student_id, did, s.name, s.email, s.department, s.enrollment_year,
    s.attendance, s.cie_marks, s.prerequisites_met, s.total_credits, s.required_credits,
    s.disciplinary_clearance, s.capstone_score, s.originality_report,
    s.cgpa, s.backlogs, s.residency_met, s.institutional_clearance, s.fee_dues, s.library_dues,
    0, null // Enrolled in Database, but NOT yet registered on the blockchain ledger
  );
}

// Student Academic Registrations (Dept, Branch, Semester 5, Registered Courses)
// MCA, M.Tech CSE, and B.Tech CSE all fall under "Department of Computer Science & Engineering"
const SEED_SEMESTER_REGISTRATIONS = [
  {
    student_id: 'STU-2024-001',
    student_name: 'Alice Johnson',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Computer Applications (MCA)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-002',
    student_name: 'Rahul Sharma',
    department: 'Department of Computer Science & Engineering',
    branch: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-003',
    student_name: 'Priya Patel',
    department: 'Department of Computer Science & Engineering',
    branch: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-004',
    student_name: 'David Miller',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Technology in Computer Science & Engineering (M.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-005',
    student_name: 'Ananya Rao',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Computer Applications (MCA)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-006',
    student_name: 'Vikram Malhotra',
    department: 'Department of Computer Science & Engineering',
    branch: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2020-013',
    student_name: 'Divyanshu Mohapatra',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Computer Applications (MCA)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-BACKLOG',
    student_name: 'Charlie Brown',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Computer Applications (MCA)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-DEFICIT',
    student_name: 'Bob Smith',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Technology in Computer Science & Engineering (M.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  },
  {
    student_id: 'STU-2024-DUES',
    student_name: 'Diana Prince',
    department: 'Department of Computer Science & Engineering',
    branch: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
    semester_number: 5,
    semester_label: 'Semester 5',
    academic_year: '2024-2025'
  }
];

const insertSemesterRegStmt = db.prepare(`
  INSERT INTO student_semester_registrations (
    id, student_id, student_name, department, branch,
    semester_number, semester_label, academic_year,
    registered_courses_json, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(student_id) DO UPDATE SET
    student_name = excluded.student_name,
    department = excluded.department,
    branch = excluded.branch,
    semester_number = excluded.semester_number,
    semester_label = excluded.semester_label,
    academic_year = excluded.academic_year,
    registered_courses_json = excluded.registered_courses_json,
    status = excluded.status
`);

const STANDARD_SEM5_COURSES = [
  { course_id: 'CS501', course_name: 'Distributed Systems & Cloud Computing', credits: 4 },
  { course_id: 'CS502', course_name: 'Blockchain Architecture & Consensus Protocols', credits: 4 },
  { course_id: 'CS503', course_name: 'Applied Cryptography & Zero-Knowledge Proofs', credits: 4 },
  { course_id: 'CS504', course_name: 'Advanced Algorithms & Distributed State', credits: 4 },
  { course_id: 'CS505', course_name: 'Decentralized AI & Autonomous Agents', credits: 4 }
];

for (const reg of SEED_SEMESTER_REGISTRATIONS) {
  insertSemesterRegStmt.run(
    `REG_${reg.student_id}_SEM5`,
    reg.student_id,
    reg.student_name,
    reg.department,
    reg.branch,
    reg.semester_number,
    reg.semester_label,
    reg.academic_year,
    JSON.stringify(STANDARD_SEM5_COURSES),
    'ACTIVE',
    new Date().toISOString()
  );
}


// Comprehensive Semester-Wise Courses Catalog (Semesters 1 through 6)
const SEMESTER_COURSES_CATALOG = {
  'Semester 1': [
    { course_id: 'CS101', course_name: 'Mathematics for Computer Science', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS102', course_name: 'Problem Solving & C Programming', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS103', course_name: 'Digital Logic & Computer Organization', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS104', course_name: 'Web Technologies & UX Fundamentals', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS105', course_name: 'Professional Communication & Ethics', credits: 4, faculty_id: 'FAC-005' }
  ],
  'Semester 2': [
    { course_id: 'CS201', course_name: 'Discrete Mathematical Structures', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS202', course_name: 'Data Structures & Algorithms', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS203', course_name: 'Object-Oriented Programming (Java/C++)', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS204', course_name: 'Computer Architecture & Assembly', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS205', course_name: 'Environmental Science & Sustainability', credits: 4, faculty_id: 'FAC-005' }
  ],
  'Semester 3': [
    { course_id: 'CS301', course_name: 'Database Management Systems & SQL', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS302', course_name: 'Operating Systems & Kernel Architecture', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS303', course_name: 'Theory of Computation & Automata', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS304', course_name: 'Design and Analysis of Algorithms', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS305', course_name: 'Software Engineering & Agile Methods', credits: 4, faculty_id: 'FAC-005' }
  ],
  'Semester 4': [
    { course_id: 'CS401', course_name: 'Computer Networks & Protocols', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS402', course_name: 'Compiler Design & Language Systems', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS403', course_name: 'Artificial Intelligence & Knowledge Systems', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS404', course_name: 'Cloud Infrastructure & Microservices', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS405', course_name: 'Probability, Statistics & Linear Algebra', credits: 4, faculty_id: 'FAC-005' }
  ],
  'Semester 5': [
    { course_id: 'CS501', course_name: 'Distributed Systems & Cloud Computing', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS502', course_name: 'Blockchain Architecture & Consensus Protocols', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS503', course_name: 'Applied Cryptography & Zero-Knowledge Proofs', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS504', course_name: 'Advanced Algorithms & Distributed State', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS505', course_name: 'Decentralized AI & Autonomous Agents', credits: 4, faculty_id: 'FAC-005' }
  ],
  'Semester 6': [
    { course_id: 'CS601', course_name: 'Information Security & Digital Forensics', credits: 4, faculty_id: 'FAC-001' },
    { course_id: 'CS602', course_name: 'Big Data Analytics & Stream Processing', credits: 4, faculty_id: 'FAC-002' },
    { course_id: 'CS603', course_name: 'Smart Contracts & DApp Engineering', credits: 4, faculty_id: 'FAC-003' },
    { course_id: 'CS604', course_name: 'Internet of Things & Edge Computing', credits: 4, faculty_id: 'FAC-004' },
    { course_id: 'CS605', course_name: 'Deep Learning & Neural Architectures', credits: 4, faculty_id: 'FAC-005' }
  ]
};

// Seed Faculties and Courses
const insertFacultyStmt = db.prepare(`
  INSERT OR REPLACE INTO faculties (
    faculty_id, name, email, password, department, designation, course_id, course_name, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCourseStmt = db.prepare(`
  INSERT OR REPLACE INTO courses (
    course_id, course_name, department, credits, faculty_id, semester
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

for (const f of SEED_FACULTIES) {
  insertFacultyStmt.run(
    f.faculty_id, f.name, f.email, f.password, f.department, f.designation, f.course_id, f.course_name, new Date().toISOString()
  );
}

// Seed catalog courses for Semesters 1 through 6
for (const [semName, semCourses] of Object.entries(SEMESTER_COURSES_CATALOG)) {
  for (const c of semCourses) {
    insertCourseStmt.run(
      c.course_id, c.course_name, 'Department of Computer Science & Engineering', c.credits, c.faculty_id, semName
    );
  }
}

// Ensure STU-2024-BACKLOG has 0 backlogs and full credits in database
try {
  db.prepare(`UPDATE students SET backlogs = 0, total_credits = 160 WHERE student_id = 'STU-2024-BACKLOG'`).run();
} catch (e) {}

// Enroll students in all 5 courses & seed initial marks records
const insertEnrollmentStmt = db.prepare(`
  INSERT OR IGNORE INTO course_enrollments (course_id, student_id, student_did, semester)
  VALUES (?, ?, ?, ?)
`);

const insertMarksStmt = db.prepare(`
  INSERT OR REPLACE INTO course_marks (
    id, course_id, student_id, student_did,
    cie_marks, lab_marks, attendance, endsem_marks, total_marks, grade,
    signed_by_faculty, faculty_signature, faculty_id, status, submitted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const student of SEED_STUDENTS) {
  const did = generateStudentDID(student.name, student.student_id);
  for (const course of SEED_FACULTIES) {
    insertEnrollmentStmt.run(course.course_id, student.student_id, did, 'Semester 5');

    const markId = `${course.course_id}_${student.student_id}`;
    let cie = student.cie_marks || 42.0;
    let lab = 23.0;
    let att = student.attendance || 88.0;
    let endsem = 44.0;
    let signed = 1;
    let status = 'APPROVED_BY_FACULTY';

    if (student.student_id === 'STU-2024-004') {
      // David Miller: Failed CS503 (Applied Cryptography) with active backlog
      if (course.course_id === 'CS503') {
        cie = 12.0;
        lab = 10.0;
        att = 76.0;
        endsem = 16.0;
        signed = 0;
        status = 'DRAFT';
      } else {
        cie = 32.0;
        lab = 20.0;
        att = 80.0;
        endsem = 34.0;
      }
    } else if (student.student_id === 'STU-2024-005') {
      // Ananya Rao: Statutory attendance (<75%) and CIE (<20) deficit in CS501 and CS502
      if (course.course_id === 'CS501') {
        cie = 16.0;
        lab = 12.0;
        att = 62.0;
        endsem = 20.0;
        signed = 0;
        status = 'DRAFT';
      } else if (course.course_id === 'CS502') {
        cie = 15.0;
        lab = 10.0;
        att = 59.0;
        endsem = 20.0;
        signed = 0;
        status = 'DRAFT';
      } else {
        cie = 24.0;
        lab = 18.0;
        att = 76.0;
        endsem = 28.0;
      }
    } else if (student.student_id === 'STU-2024-DEFICIT') {
      // Bob Smith: Full deficit persona
      cie = 16.0;
      lab = 12.0;
      att = 60.0;
      endsem = 20.0;
      signed = 0;
      status = 'DRAFT';
    }

    const total = cie + lab + endsem;
    const grade = total >= 90 ? 'EX' : (total >= 80 ? 'A' : (total >= 70 ? 'B' : (total >= 60 ? 'C' : (total >= 50 ? 'D' : 'F'))));

    insertMarksStmt.run(
      markId,
      course.course_id,
      student.student_id,
      did,
      cie,
      lab,
      att,
      endsem,
      total,
      grade,
      signed,
      signed ? `SIG_FACULTY_${course.faculty_id}_HASH_${markId}` : null,
      course.faculty_id,
      status,
      new Date().toISOString()
    );
  }
}

// ----------------------------------------------------
// Public Accessor & Query Functions
// ----------------------------------------------------

function formatStudentRecord(row) {
  if (!row) return null;
  return {
    studentId: row.student_id,
    did: row.did || generateStudentDID(row.name, row.student_id),
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
    libraryDues: Number(row.library_dues),
    isOnLedger: Boolean(row.is_on_ledger),
    registeredOnLedgerAt: row.registered_on_ledger_at || null
  };
}

function getStudentByRollNumber(studentId) {
  if (!studentId) return null;
  const stmt = db.prepare('SELECT * FROM students WHERE student_id = ? COLLATE NOCASE');
  const row = stmt.get(studentId.trim());
  return formatStudentRecord(row);
}

function getStudentByDID(did) {
  if (!did) return null;
  const stmt = db.prepare('SELECT * FROM students WHERE did = ? COLLATE NOCASE');
  const row = stmt.get(did.trim());
  if (row) return formatStudentRecord(row);

  // Fallback match across all students
  const all = getAllSISStudents();
  return all.find(s => s.did === did.trim()) || null;
}

function getAllSISStudents() {
  const stmt = db.prepare('SELECT * FROM students ORDER BY student_id ASC');
  const rows = stmt.all();
  return rows.map(formatStudentRecord);
}

function getLedgerStudents() {
  const all = getAllSISStudents();
  return all.filter(s => s.isOnLedger);
}

function markStudentOnLedger(studentId, did) {
  if (!studentId) return null;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE students
    SET is_on_ledger = 1, registered_on_ledger_at = ?, did = COALESCE(?, did)
    WHERE student_id = ? COLLATE NOCASE
  `);
  stmt.run(now, did || null, studentId.trim());
  return getStudentByRollNumber(studentId.trim());
}

function isStudentOnLedger(studentId) {
  const student = getStudentByRollNumber(studentId);
  return Boolean(student && student.isOnLedger);
}

// Student Semester Registration Functions
function getStudentSemesterRegistration(studentId) {
  if (!studentId) return null;
  const stmt = db.prepare(`SELECT * FROM student_semester_registrations WHERE student_id = ? COLLATE NOCASE`);
  const row = stmt.get(studentId.trim());
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    department: row.department,
    branch: row.branch,
    semesterNumber: Number(row.semester_number),
    semesterLabel: row.semester_label,
    academicYear: row.academic_year,
    registeredCourses: JSON.parse(row.registered_courses_json || '[]'),
    status: row.status,
    createdAt: row.created_at
  };
}

function getAllSemesterRegistrations() {
  const stmt = db.prepare(`SELECT * FROM student_semester_registrations ORDER BY student_id ASC`);
  const rows = stmt.all();
  return rows.map(row => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    department: row.department,
    branch: row.branch,
    semesterNumber: Number(row.semester_number),
    semesterLabel: row.semester_label,
    academicYear: row.academic_year,
    registeredCourses: JSON.parse(row.registered_courses_json || '[]'),
    status: row.status,
    createdAt: row.created_at
  }));
}

function upsertStudentSemesterRegistration(data) {
  const studentId = (data.studentId || data.student_id || '').trim();
  const id = data.id || `REG_${studentId}_SEM5`;
  const student = getStudentByRollNumber(studentId);
  const studentName = data.studentName || data.name || student?.name || 'Student';
  const department = data.department || 'Department of Computer Science & Engineering';
  const branch = data.branch || 'Master of Computer Applications (MCA)';
  const semesterNumber = Number(data.semesterNumber || 5);
  const semesterLabel = data.semesterLabel || `Semester ${semesterNumber}`;
  const academicYear = data.academicYear || '2024-2025';
  const courses = Array.isArray(data.registeredCourses) ? data.registeredCourses : STANDARD_SEM5_COURSES;
  const status = data.status || 'ACTIVE';
  const createdAt = data.createdAt || new Date().toISOString();

  insertSemesterRegStmt.run(
    id, studentId, studentName, department, branch,
    semesterNumber, semesterLabel, academicYear,
    JSON.stringify(courses), status, createdAt
  );

  return getStudentSemesterRegistration(studentId);
}

function addOrUpdateStudent(data) {
  const studentId = (data.studentId || data.student_id || '').trim();
  const name = data.name || 'Student Name';
  const did = data.did || generateStudentDID(name, studentId);
  const isOnLedger = data.isOnLedger !== undefined ? (data.isOnLedger ? 1 : 0) : (data.is_on_ledger !== undefined ? (data.is_on_ledger ? 1 : 0) : 0);
  const regOnLedgerAt = data.registeredOnLedgerAt || data.registered_on_ledger_at || null;

  insertStudentStmt.run(
    studentId,
    did,
    name,
    data.email || `${studentId.toLowerCase()}@academic.edu`,
    data.department || 'Department of Computer Science & Engineering',
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
    data.libraryDues !== undefined ? Number(data.libraryDues) : 0.0,
    isOnLedger,
    regOnLedgerAt
  );

  // Auto-create semester registration if not exists
  if (!getStudentSemesterRegistration(studentId)) {
    upsertStudentSemesterRegistration({
      studentId,
      studentName: name,
      department: data.department || 'Department of Computer Science & Engineering',
      branch: data.branch || 'Master of Computer Applications (MCA)',
      semesterNumber: 5,
      semesterLabel: 'Semester 5',
      academicYear: '2024-2025'
    });
  }

  // Also auto-enroll in all 5 courses
  const courses = getAllCourses();
  for (const c of courses) {
    insertEnrollmentStmt.run(c.course_id, studentId, did, 'Semester 5');
    const markId = `${c.course_id}_${studentId}`;
    insertMarksStmt.run(
      markId,
      c.course_id,
      studentId,
      did,
      data.cieMarks !== undefined ? Number(data.cieMarks) : 40.0,
      22.0,
      data.attendance !== undefined ? Number(data.attendance) : 85.0,
      42.0,
      84.0,
      'A',
      0,
      null,
      c.faculty_id,
      'DRAFT',
      new Date().toISOString()
    );
  }

  return getStudentByRollNumber(studentId);
}

// Faculty Functions
function getAllFaculties() {
  const stmt = db.prepare('SELECT faculty_id, name, email, department, designation, course_id, course_name FROM faculties ORDER BY faculty_id ASC');
  return stmt.all();
}

function getFacultyById(facultyId) {
  const stmt = db.prepare('SELECT * FROM faculties WHERE faculty_id = ?');
  return stmt.get(facultyId);
}

function getFacultyByEmail(email) {
  const stmt = db.prepare('SELECT * FROM faculties WHERE LOWER(email) = LOWER(?)');
  return stmt.get(email.trim());
}

function registerFaculty(data) {
  const facultyId = data.facultyId || `FAC-00${getAllFaculties().length + 1}`;
  const courseId = data.courseId || `CS50${getAllFaculties().length + 1}`;
  insertFacultyStmt.run(
    facultyId,
    data.name,
    data.email,
    data.password || 'password123',
    data.department || 'Computer Science & Engineering',
    data.designation || 'Faculty Member',
    courseId,
    data.courseName || 'Advanced Computing',
    new Date().toISOString()
  );
  insertCourseStmt.run(
    courseId,
    data.courseName || 'Advanced Computing',
    data.department || 'Computer Science & Engineering',
    4,
    facultyId,
    'Semester 5'
  );
  return getFacultyById(facultyId);
}

// Courses & Marks Functions
function getAllCourses(semester = null) {
  if (semester) {
    return getCoursesBySemester(semester);
  }
  const stmt = db.prepare(`
    SELECT c.*, f.name as faculty_name, f.email as faculty_email 
    FROM courses c 
    JOIN faculties f ON c.faculty_id = f.faculty_id
    ORDER BY c.semester ASC, c.course_id ASC
  `);
  return stmt.all();
}

function getCoursesBySemester(semester) {
  const semStr = typeof semester === 'number' 
    ? `Semester ${semester}` 
    : (String(semester).startsWith('Semester') ? semester : `Semester ${semester}`);
  const stmt = db.prepare(`
    SELECT c.*, f.name as faculty_name, f.email as faculty_email 
    FROM courses c 
    JOIN faculties f ON c.faculty_id = f.faculty_id
    WHERE c.semester = ?
    ORDER BY c.course_id ASC
  `);
  return stmt.all(semStr);
}

function enrollStudentInSemesterCourses(studentId, did, semesterLabel, branch, selectedCourses) {
  const existingReg = getStudentSemesterRegistration(studentId);
  const semStr = semesterLabel
    ? (typeof semesterLabel === 'number' ? `Semester ${semesterLabel}` : (String(semesterLabel).startsWith('Semester') ? semesterLabel : `Semester ${semesterLabel}`))
    : (existingReg ? existingReg.semesterLabel : 'Semester 5');
  const semNum = parseInt(String(semStr).replace(/\D/g, '')) || 5;
  const targetBranch = branch || (existingReg ? existingReg.branch : 'Master of Computer Applications (MCA)');
  const student = getStudentByRollNumber(studentId);
  const studentName = student ? student.name : studentId;
  const department = student ? student.department : 'Department of Computer Science & Engineering';

  // Format courses list
  let coursesToEnroll = [];
  if (Array.isArray(selectedCourses) && selectedCourses.length > 0) {
    coursesToEnroll = selectedCourses.map(c => {
      if (typeof c === 'string') {
        const found = getCourseById(c);
        return found ? { course_id: found.course_id, course_name: found.course_name, credits: found.credits } : { course_id: c, course_name: c, credits: 4 };
      }
      return {
        course_id: c.course_id || c.courseId,
        course_name: c.course_name || c.courseName || c.course_id,
        credits: c.credits || 4
      };
    });
  } else if (existingReg && Array.isArray(existingReg.registeredCourses) && existingReg.registeredCourses.length > 0 && !semesterLabel) {
    coursesToEnroll = existingReg.registeredCourses;
  } else {
    coursesToEnroll = getCoursesBySemester(semStr);
  }

  // Upsert student semester registration
  const regId = `REG_${studentId}_SEM${semNum}`;
  const regStmt = db.prepare(`
    INSERT INTO student_semester_registrations (
      id, student_id, student_name, department, branch,
      semester_number, semester_label, academic_year,
      registered_courses_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    ON CONFLICT(student_id) DO UPDATE SET
      branch = excluded.branch,
      semester_number = excluded.semester_number,
      semester_label = excluded.semester_label,
      registered_courses_json = excluded.registered_courses_json,
      status = 'ACTIVE'
  `);

  regStmt.run(
    regId,
    studentId,
    studentName,
    department,
    targetBranch,
    semNum,
    semStr,
    '2024-2025',
    JSON.stringify(coursesToEnroll),
    new Date().toISOString()
  );

  // Enroll in each course and seed initial draft course_marks
  const enrollStmt = db.prepare(`
    INSERT OR REPLACE INTO course_enrollments (course_id, student_id, student_did, semester)
    VALUES (?, ?, ?, ?)
  `);

  const markStmt = db.prepare(`
    INSERT OR IGNORE INTO course_marks (
      id, course_id, student_id, student_did,
      cie_marks, lab_marks, attendance, endsem_marks, total_marks, grade,
      signed_by_faculty, faculty_signature, faculty_id, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const studentDID = did || student?.did || generateStudentDID(studentName, studentId);

  for (const c of coursesToEnroll) {
    const courseObj = getCourseById(c.course_id);
    const facultyId = courseObj ? courseObj.faculty_id : 'FAC-001';
    enrollStmt.run(c.course_id, studentId, studentDID, semStr);
    
    // Seed initial draft marks for newly enrolled student so faculty can view & submit
    const markId = `${c.course_id}_${studentId}`;
    markStmt.run(
      markId,
      c.course_id,
      studentId,
      studentDID,
      38.0, 20.0, 85.0, 40.0, 78.0, 'B',
      0, null, facultyId, 'DRAFT', new Date().toISOString()
    );
  }

  return getStudentSemesterRegistration(studentId);
}

function getCourseById(courseId) {
  const stmt = db.prepare(`
    SELECT c.*, f.name as faculty_name, f.email as faculty_email 
    FROM courses c 
    JOIN faculties f ON c.faculty_id = f.faculty_id
    WHERE c.course_id = ?
  `);
  return stmt.get(courseId);
}

function getStudentsEnrolledInCourse(courseId) {
  const stmt = db.prepare(`
    SELECT e.course_id, e.student_id, e.student_did, s.name, s.email, s.department,
           m.cie_marks, m.lab_marks, m.attendance, m.endsem_marks, m.total_marks, m.grade,
           m.signed_by_faculty, m.faculty_signature, m.status as marks_status, m.submitted_at
    FROM course_enrollments e
    JOIN students s ON e.student_id = s.student_id
    LEFT JOIN course_marks m ON e.course_id = m.course_id AND e.student_id = m.student_id
    WHERE e.course_id = ?
    ORDER BY e.student_id ASC
  `);
  return stmt.all(courseId);
}

function upsertCourseMarks(courseId, marksArray, facultyId, signature) {
  const updateStmt = db.prepare(`
    INSERT OR REPLACE INTO course_marks (
      id, course_id, student_id, student_did,
      cie_marks, lab_marks, attendance, endsem_marks, total_marks, grade,
      signed_by_faculty, faculty_signature, faculty_id, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const results = [];
  for (const item of marksArray) {
    const student = getStudentByRollNumber(item.studentId || item.student_id);
    const did = student ? student.did : generateStudentDID(item.name || 'Student', item.studentId);
    const markId = `${courseId}_${item.studentId || item.student_id}`;
    const cie = Number(item.cieMarks !== undefined ? item.cieMarks : (item.cie_marks || 0));
    const lab = Number(item.labMarks !== undefined ? item.labMarks : (item.lab_marks || 0));
    const att = Number(item.attendance !== undefined ? item.attendance : 0);
    const endsem = Number(item.endsemMarks !== undefined ? item.endsemMarks : (item.endsem_marks || 0));
    const total = cie + lab + endsem;
    const grade = total >= 90 ? 'EX' : (total >= 80 ? 'A' : (total >= 70 ? 'B' : (total >= 60 ? 'C' : (total >= 50 ? 'D' : 'F'))));

    const isSigned = signature ? 1 : (item.signed_by_faculty ? 1 : 0);
    const sig = signature || item.faculty_signature || null;
    const status = isSigned ? 'APPROVED_BY_FACULTY' : 'DRAFT';

    updateStmt.run(
      markId,
      courseId,
      item.studentId || item.student_id,
      did,
      cie,
      lab,
      att,
      endsem,
      total,
      grade,
      isSigned,
      sig,
      facultyId || item.faculty_id,
      status,
      new Date().toISOString()
    );
    results.push({ markId, courseId, studentId: item.studentId || item.student_id, total, grade, status });
  }
  return results;
}


/**
 * Automatically sign and approve eligible course marks for a student.
 * If attendance >= 75% and CIE >= 20 and total >= 50, signs with instructor authority key.
 */
function autoApproveAndSignEligibleCourseMarks(studentId) {
  if (!studentId) return [];
  const student = getStudentByRollNumber(studentId);
  if (!student) return [];

  const semReg = getStudentSemesterRegistration(student.studentId);
  let courses = [];
  if (semReg && Array.isArray(semReg.registeredCourses) && semReg.registeredCourses.length > 0) {
    courses = semReg.registeredCourses;
  } else {
    courses = getCoursesBySemester(student.semester_label || 'Semester 5');
  }

  const marksStmt = db.prepare(`SELECT * FROM course_marks WHERE student_id = ? COLLATE NOCASE`);
  const existingMarks = marksStmt.all(student.studentId);

  const updateStmt = db.prepare(`
    INSERT OR REPLACE INTO course_marks (
      id, course_id, student_id, student_did,
      cie_marks, lab_marks, attendance, endsem_marks, total_marks, grade,
      signed_by_faculty, faculty_signature, faculty_id, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const signedCourses = [];

  for (const c of courses) {
    const courseId = c.course_id || c.courseId;
    let m = existingMarks.find(x => x.course_id === courseId);
    const courseObj = getCourseById(courseId);
    const facultyId = courseObj ? courseObj.faculty_id : (m?.faculty_id || 'FAC-001');
    const markId = `${courseId}_${student.studentId}`;
    const att = m && m.attendance !== undefined && m.attendance !== null ? Number(m.attendance) : (Number(student.attendance) || 88.0);
    const cie = m && m.cie_marks !== undefined && m.cie_marks !== null ? Number(m.cie_marks) : (Number(student.cie_marks) || 40.0);
    const lab = m && m.lab_marks !== undefined && m.lab_marks !== null ? Number(m.lab_marks) : 22.0;
    const endsem = m && m.endsem_marks !== undefined && m.endsem_marks !== null ? Number(m.endsem_marks) : 42.0;
    const total = m && m.total_marks !== undefined && m.total_marks !== null ? Number(m.total_marks) : (cie + lab + endsem);
    const grade = m && m.grade ? m.grade : (total >= 90 ? 'EX' : (total >= 80 ? 'A' : (total >= 70 ? 'B' : (total >= 60 ? 'C' : (total >= 50 ? 'D' : 'F')))));

    // Only sign if attendance >= 75 and cie >= 20 and total >= 50
    if (att >= 75.0 && cie >= 20.0 && total >= 50.0) {
      const signature = `SIG_FACULTY_${facultyId}_HASH_${markId}`;
      updateStmt.run(
        markId,
        courseId,
        student.studentId,
        student.did || generateStudentDID(student.name, student.studentId),
        cie,
        lab,
        att,
        endsem,
        total,
        grade,
        1,
        signature,
        facultyId,
        'APPROVED_BY_FACULTY',
        new Date().toISOString()
      );
      signedCourses.push({ courseId, markId, status: 'APPROVED_BY_FACULTY' });
    }
  }

  return signedCourses;
}

// Comprehensive Student Audit for Faculty Advisor Gate
function getStudentComprehensiveAudit(studentId) {
  const student = getStudentByRollNumber(studentId);
  if (!student) return null;
  try { autoApproveAndSignEligibleCourseMarks(student.studentId); } catch (e) {}

  // Retrieve student's registered semester & enrolled courses
  const semReg = getStudentSemesterRegistration(studentId);
  let courses = [];
  if (semReg && Array.isArray(semReg.registeredCourses) && semReg.registeredCourses.length > 0) {
    courses = semReg.registeredCourses.map(rc => {
      const full = getCourseById(rc.course_id);
      return full || rc;
    });
  } else {
    courses = getCoursesBySemester(student.semester_label || 'Semester 5');
    if (!courses || courses.length === 0) {
      courses = getCoursesBySemester('Semester 5');
    }
  }

  const marksStmt = db.prepare(`SELECT * FROM course_marks WHERE student_id = ? COLLATE NOCASE`);
  const marks = marksStmt.all(studentId);

  const courseAudits = [];
  let allCoursesCompleted = true;
  let allCoursesPassed = true;
  let allFacultiesSigned = true;
  let lowAttendanceCourses = [];
  let lowCieCourses = [];
  let totalGradePoints = 0;
  let gradedCredits = 0;

  for (const c of courses) {
    const m = marks.find(x => x.course_id === c.course_id);
    if (!m || m.status !== 'APPROVED_BY_FACULTY') {
      allCoursesCompleted = false;
      allFacultiesSigned = false;
    }

    const att = m ? Number(m.attendance) : 0;
    const cie = m ? Number(m.cie_marks) : 0;
    const total = m ? Number(m.total_marks) : 0;
    const passed = att >= 75.0 && cie >= 20.0 && total >= 50.0;

    if (att < 75.0) lowAttendanceCourses.push({ courseId: c.course_id, courseName: c.course_name, attendance: att });
    if (cie < 20.0) lowCieCourses.push({ courseId: c.course_id, courseName: c.course_name, cieMarks: cie });
    if (!passed) allCoursesPassed = false;

    // Grade points mapping
    let gp = 0;
    if (m?.grade === 'EX') gp = 10;
    else if (m?.grade === 'A') gp = 9;
    else if (m?.grade === 'B') gp = 8;
    else if (m?.grade === 'C') gp = 7;
    else if (m?.grade === 'D') gp = 6;
    totalGradePoints += gp * (c.credits || 4);
    gradedCredits += (c.credits || 4);

    courseAudits.push({
      courseId: c.course_id,
      courseName: c.course_name,
      facultyName: c.faculty_name,
      facultyEmail: c.faculty_email,
      credits: c.credits,
      marks: m ? {
        cie: Number(m.cie_marks),
        lab: Number(m.lab_marks),
        attendance: Number(m.attendance),
        endsem: Number(m.endsem_marks),
        total: Number(m.total_marks),
        grade: m.grade,
        status: m.status,
        signed: Boolean(m.signed_by_faculty)
      } : null,
      passed,
      facultyApproved: m?.status === 'APPROVED_BY_FACULTY'
    });
  }

  const computedSgpa = gradedCredits > 0 ? Number((totalGradePoints / gradedCredits).toFixed(2)) : 0;

  // Dynamic Backlog Evaluation:
  // If the student has completed and passed all semester subjects, active backlogs are 0.
  const failedCourses = courseAudits.filter(c => !c.passed);
  const activeBacklogs = failedCourses.length;
  const effectiveBacklogs = allCoursesPassed ? 0 : Math.max(student.backlogs || 0, activeBacklogs);

  if (effectiveBacklogs !== student.backlogs) {
    db.prepare(`UPDATE students SET backlogs = ? WHERE student_id = ? COLLATE NOCASE`).run(effectiveBacklogs, studentId);
    student.backlogs = effectiveBacklogs;
  }

  const isEligible = allCoursesCompleted && allCoursesPassed && allFacultiesSigned && (effectiveBacklogs === 0);

  const deficitReasons = [];
  if (!allFacultiesSigned) deficitReasons.push('Pending marks submission or signature from one or more faculties');
  if (lowAttendanceCourses.length > 0) deficitReasons.push(`Attendance below 75% in: ${lowAttendanceCourses.map(x => `${x.courseId} (${x.attendance}%)`).join(', ')}`);
  if (lowCieCourses.length > 0) deficitReasons.push(`CIE score below 20.0/50 in: ${lowCieCourses.map(x => `${x.courseId} (${x.cieMarks}/50)`).join(', ')}`);
  if (effectiveBacklogs > 0) deficitReasons.push(`Active backlogs: ${effectiveBacklogs}`);

  const latestReq = getLatestCertificateRequestForStudent(studentId);
  const faApprovedStages = ['FA_APPROVED', 'HOD_APPROVED', 'DAC_APPROVED', 'EXAM_LOCKED', 'DEAN_APPROVED', 'ADMIN_FINALIZED', 'CERTIFICATE_ISSUED'];
  const isFaApproved = latestReq && faApprovedStages.includes(latestReq.status);

  return {
    studentId: student.studentId,
    did: student.did,
    name: student.name,
    email: student.email,
    department: student.department,
    semester: semReg?.semesterLabel || 'Semester 5',
    branch: semReg?.branch || 'Computer Science & Engineering',
    coursesTotal: courses.length,
    coursesSubmitted: courseAudits.filter(x => x.marks && x.marks.signed).length,
    courseAudits,
    computedSgpa,
    allCoursesCompleted,
    allCoursesPassed,
    allFacultiesSigned,
    isEligible,
    deficitReasons,
    requestId: latestReq ? latestReq.requestId : null,
    requestStatus: latestReq ? latestReq.status : null,
    faSigned: Boolean(isFaApproved),
    faSignature: latestReq?.details?.faSignature || null
  };
}

// Multi-Sig Votes
function recordMultiSigVote(requestId, stage, voterId, voterName, voterRole, decision, signature, comments) {
  const voteId = `VOTE_${stage}_${requestId}_${voterId}`;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO multisig_votes (
      vote_id, request_id, stage, voter_id, voter_name, voter_role, decision, signature, comments, voted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(voteId, requestId, stage, voterId, voterName, voterRole, decision, signature, comments || '', new Date().toISOString());
  return getMultiSigStatus(requestId, stage);
}

function getMultiSigStatus(requestId, stage) {
  const isDac = String(stage).toUpperCase().includes('DAC');
  const isDean = String(stage).toUpperCase().includes('DEAN');
  let votes;
  if (isDac) {
    const stmt = db.prepare(`SELECT * FROM multisig_votes WHERE request_id = ? COLLATE NOCASE AND (stage = 'DAC' OR stage = 'DAC_COMMITTEE' OR stage = 'DAC_MULTISIG')`);
    votes = stmt.all(requestId);
  } else if (isDean) {
    const stmt = db.prepare(`SELECT * FROM multisig_votes WHERE request_id = ? COLLATE NOCASE AND (stage = 'DEAN' OR stage = 'DEAN_COUNCIL' OR stage = 'DEAN_MULTISIG')`);
    votes = stmt.all(requestId);
  } else {
    const stmt = db.prepare(`SELECT * FROM multisig_votes WHERE request_id = ? COLLATE NOCASE AND stage = ? COLLATE NOCASE`);
    votes = stmt.all(requestId, stage);
  }

  const approvals = votes.filter(v => v.decision === 'APPROVE');
  const rejections = votes.filter(v => v.decision === 'REJECT');
  const requiredQuorum = 2; // Majority 2 of 3
  const isMajorityPassed = approvals.length >= requiredQuorum;

  return {
    requestId,
    stage,
    totalVotes: votes.length,
    approvalCount: approvals.length,
    rejectionCount: rejections.length,
    requiredQuorum,
    isMajorityPassed,
    votes
  };
}

// Certificate Requests Store in SQLite (Consortium Fallback & State Persistence)
function saveCertificateRequest(data) {
  const requestId = (data.requestId || data.request_id || '').trim();
  const studentId = (data.studentId || data.student_id || '').trim();
  const student = getStudentByRollNumber(studentId);
  const studentDid = data.studentDid || data.student_did || student?.did || generateStudentDID(data.studentName || 'Student', studentId);
  const studentName = data.studentName || data.student_name || student?.name || 'Student';
  const certType = data.certType || data.cert_type || 'Master of Computer Applications (MCA)';
  const department = data.department || student?.department || 'Department of Computer Science & Engineering';
  const status = data.status || 'SUBMITTED';
  const details = data.details || {};
  const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO certificate_requests (
      request_id, student_id, student_did, student_name,
      cert_type, department, status, details_json, submitted_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(request_id) DO UPDATE SET
      student_id = excluded.student_id,
      student_did = excluded.student_did,
      student_name = excluded.student_name,
      cert_type = excluded.cert_type,
      department = excluded.department,
      status = excluded.status,
      details_json = excluded.details_json,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    requestId, studentId, studentDid, studentName,
    certType, department, status, detailsJson,
    data.submittedAt || data.submitted_at || now, now
  );

  return getCertificateRequest(requestId);
}

function getCertificateRequest(requestId) {
  if (!requestId) return null;
  const stmt = db.prepare(`SELECT * FROM certificate_requests WHERE request_id = ? COLLATE NOCASE`);
  const row = stmt.get(requestId.trim());
  if (!row) return null;
  let details = {};
  try {
    details = JSON.parse(row.details_json || '{}');
  } catch (e) {
    details = {};
  }
  return {
    requestId: row.request_id,
    studentId: row.student_id,
    studentDid: row.student_did,
    studentName: row.student_name,
    certType: row.cert_type,
    department: row.department,
    status: row.status,
    details,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function getLatestCertificateRequestForStudent(studentId) {
  if (!studentId) return null;
  const stmt = db.prepare(`SELECT * FROM certificate_requests WHERE student_id = ? COLLATE NOCASE ORDER BY submitted_at DESC LIMIT 1`);
  const row = stmt.get(studentId.trim());
  if (!row) return null;
  let details = {};
  try {
    details = JSON.parse(row.details_json || '{}');
  } catch (e) {
    details = {};
  }
  return {
    requestId: row.request_id,
    studentId: row.student_id,
    studentDid: row.student_did,
    studentName: row.student_name,
    certType: row.cert_type,
    department: row.department,
    status: row.status,
    details,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function getCertificateRequestByCertId(certId) {
  if (!certId) return null;
  const all = getAllCertificateRequests();
  return all.find(r => r.details?.certId === certId || r.details?.certificateId === certId || r.requestId === certId) || null;
}

function getAllCertificateRequests() {
  const stmt = db.prepare(`SELECT * FROM certificate_requests ORDER BY submitted_at DESC`);
  const rows = stmt.all();
  return rows.map(row => {
    let details = {};
    try {
      details = JSON.parse(row.details_json || '{}');
    } catch (e) {
      details = {};
    }
    return {
      requestId: row.request_id,
      studentId: row.student_id,
      studentDid: row.student_did,
      studentName: row.student_name,
      certType: row.cert_type,
      department: row.department,
      status: row.status,
      details,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at
    };
  });
}

function updateCertificateRequestStatus(requestId, newStatus, detailsUpdate = {}) {
  const existing = getCertificateRequest(requestId);
  if (!existing) return null;
  const mergedDetails = { ...(existing.details || {}), ...detailsUpdate };
  const stmt = db.prepare(`
    UPDATE certificate_requests
    SET status = ?, details_json = ?, updated_at = ?
    WHERE request_id = ? COLLATE NOCASE
  `);
  stmt.run(newStatus, JSON.stringify(mergedDetails), new Date().toISOString(), existing.requestId);
  return getCertificateRequest(requestId);
}

function autoCreateRequestForStudent(studentId, customRequestId = null) {
  const student = getStudentByRollNumber(studentId);
  if (!student) return null;
  const semReg = getStudentSemesterRegistration(student.studentId);
  
  let requestId = customRequestId ? customRequestId.trim() : null;
  if (!requestId || /^STU-/i.test(requestId)) {
    requestId = `REQ-${student.studentId.replace(/^STU-/i, '')}`;
  }

  // If request already exists, return existing without reverting status to SUBMITTED
  const existing = getCertificateRequest(requestId);
  if (existing) return existing;

  const did = student.did || generateStudentDID(student.name, student.studentId);
  const certType = semReg?.branch || 'Master of Computer Applications (MCA)';
  const department = semReg?.department || student.department || 'Department of Computer Science & Engineering';

  const details = {
    ...student,
    did,
    department,
    branch: certType,
    semesterNumber: semReg?.semesterNumber || 5,
    registeredCourses: semReg?.registeredCourses || []
  };

  return saveCertificateRequest({
    requestId,
    studentId: student.studentId,
    studentDid: did,
    studentName: student.name,
    certType,
    department,
    status: 'SUBMITTED',
    details
  });
}


function saveCertificate(cert) {
  if (!cert || !cert.certId) return null;
  const stmt = db.prepare(`
    INSERT INTO certificates (
      cert_id, request_id, student_id, student_name, student_did,
      department, cert_type, ipfs_hash, r2_uri, doc_hash, issue_date, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cert_id) DO UPDATE SET
      request_id = COALESCE(NULLIF(excluded.request_id, ''), certificates.request_id),
      student_name = COALESCE(NULLIF(excluded.student_name, ''), certificates.student_name),
      student_did = COALESCE(NULLIF(excluded.student_did, ''), certificates.student_did),
      department = COALESCE(NULLIF(excluded.department, ''), certificates.department),
      cert_type = COALESCE(NULLIF(excluded.cert_type, ''), certificates.cert_type),
      ipfs_hash = CASE WHEN excluded.ipfs_hash != '' THEN excluded.ipfs_hash ELSE certificates.ipfs_hash END,
      r2_uri = CASE WHEN excluded.r2_uri != '' THEN excluded.r2_uri ELSE certificates.r2_uri END,
      doc_hash = CASE WHEN excluded.doc_hash != '' THEN excluded.doc_hash ELSE certificates.doc_hash END,
      issue_date = COALESCE(NULLIF(excluded.issue_date, ''), certificates.issue_date),
      status = COALESCE(NULLIF(excluded.status, ''), certificates.status)
  `);

  const ipfsHash = cert.ipfsHash || cert.ipfsCid || '';
  const r2Uri = cert.r2Uri || cert.storageUri || (cert.certId ? `r2://academic-certificates/certificates/${cert.certId}.pdf` : '');
  const docHash = cert.docHash || cert.sha256Hash || '';

  stmt.run(
    cert.certId,
    cert.requestId || '',
    cert.studentId,
    cert.studentName || '',
    cert.studentDid || '',
    cert.department || '',
    cert.certType || 'Degree Certificate',
    ipfsHash,
    r2Uri,
    docHash,
    cert.issueDate || new Date().toISOString().substring(0, 10),
    cert.status || 'ISSUED',
    cert.createdAt || new Date().toISOString()
  );

  return getCertificate(cert.certId);
}

function getCertificate(certId) {
  if (!certId) return null;
  const stmt = db.prepare(`SELECT * FROM certificates WHERE cert_id = ? COLLATE NOCASE`);
  const row = stmt.get(certId.trim());
  if (!row) return null;
  return {
    certId: row.cert_id,
    requestId: row.request_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentDid: row.student_did,
    department: row.department,
    certType: row.cert_type,
    ipfsHash: row.ipfs_hash,
    ipfsCid: row.ipfs_hash,
    r2Uri: row.r2_uri || `r2://academic-certificates/certificates/${row.cert_id}.pdf`,
    docHash: row.doc_hash,
    sha256Hash: row.doc_hash,
    issueDate: row.issue_date,
    status: row.status,
    createdAt: row.created_at
  };
}

function getCertificateByRequestId(requestId) {
  if (!requestId) return null;
  const stmt = db.prepare(`SELECT * FROM certificates WHERE request_id = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get(requestId.trim());
  if (!row) return null;
  return {
    certId: row.cert_id,
    requestId: row.request_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentDid: row.student_did,
    department: row.department,
    certType: row.cert_type,
    ipfsHash: row.ipfs_hash,
    ipfsCid: row.ipfs_hash,
    r2Uri: row.r2_uri || `r2://academic-certificates/certificates/${row.cert_id}.pdf`,
    docHash: row.doc_hash,
    sha256Hash: row.doc_hash,
    issueDate: row.issue_date,
    status: row.status,
    createdAt: row.created_at
  };
}

function getAllCertificates() {
  const stmt = db.prepare(`SELECT * FROM certificates ORDER BY created_at DESC`);
  const rows = stmt.all();
  return rows.map(row => ({
    certId: row.cert_id,
    requestId: row.request_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentDid: row.student_did,
    department: row.department,
    certType: row.cert_type,
    ipfsHash: row.ipfs_hash,
    ipfsCid: row.ipfs_hash,
    r2Uri: row.r2_uri || `r2://academic-certificates/certificates/${row.cert_id}.pdf`,
    docHash: row.doc_hash,
    sha256Hash: row.doc_hash,
    issueDate: row.issue_date,
    status: row.status,
    createdAt: row.created_at
  }));
}

function getCertificateByHash(docHash) {
  if (!docHash) return null;
  const clean = docHash.trim().toLowerCase();

  // 1. Direct query on certificates table by doc_hash or cert_id
  const stmt = db.prepare(`SELECT * FROM certificates WHERE LOWER(doc_hash) = ? OR LOWER(cert_id) = ? LIMIT 1`);
  const row = stmt.get(clean, clean);
  if (row) {
    return {
      certId: row.cert_id,
      requestId: row.request_id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentDid: row.student_did,
      department: row.department,
      certType: row.cert_type,
      ipfsHash: row.ipfs_hash,
      ipfsCid: row.ipfs_hash,
      r2Uri: row.r2_uri || `r2://academic-certificates/certificates/${row.cert_id}.pdf`,
      docHash: row.doc_hash,
      sha256Hash: row.doc_hash,
      issueDate: row.issue_date,
      status: row.status,
      createdAt: row.created_at
    };
  }

  // 2. Search in certificate_requests table
  const allReqs = getAllCertificateRequests();
  const matchedReq = allReqs.find(r => 
    (r.details?.sha256Hash && r.details.sha256Hash.toLowerCase() === clean) ||
    (r.details?.docHash && r.details.docHash.toLowerCase() === clean) ||
    (r.details?.certId && r.details.certId.toLowerCase() === clean) ||
    (r.requestId && r.requestId.toLowerCase() === clean)
  );

  if (matchedReq) {
    const cId = matchedReq.details?.certId || matchedReq.requestId.replace('REQ-', 'CERT-');
    const docVal = matchedReq.details?.sha256Hash || matchedReq.details?.docHash || clean;
    const ipfsVal = matchedReq.details?.ipfsCid || matchedReq.details?.ipfsHash || `Qm${docVal.substring(0, 44)}`;
    return {
      certId: cId,
      requestId: matchedReq.requestId,
      studentId: matchedReq.studentId,
      studentName: matchedReq.studentName,
      studentDid: matchedReq.studentDid,
      department: matchedReq.department,
      certType: matchedReq.certType,
      ipfsHash: ipfsVal,
      ipfsCid: ipfsVal,
      r2Uri: matchedReq.details?.r2Uri || `r2://academic-certificates/certificates/${cId}.pdf`,
      docHash: docVal,
      sha256Hash: docVal,
      issueDate: matchedReq.updatedAt ? matchedReq.updatedAt.substring(0, 10) : new Date().toISOString().substring(0, 10),
      status: matchedReq.status === 'REVOKED' ? 'REVOKED' : 'ISSUED',
      createdAt: matchedReq.submittedAt
    };
  }

  return null;
}

function getCertificateByStudentDID(did) {
  if (!did) return null;
  const clean = did.trim().toLowerCase();
  const stmt = db.prepare(`SELECT * FROM certificates WHERE LOWER(student_did) = ? ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.get(clean);
  if (row) {
    return {
      certId: row.cert_id,
      requestId: row.request_id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentDid: row.student_did,
      department: row.department,
      certType: row.cert_type,
      ipfsHash: row.ipfs_hash,
      ipfsCid: row.ipfs_hash,
      r2Uri: row.r2_uri || `r2://academic-certificates/certificates/${row.cert_id}.pdf`,
      docHash: row.doc_hash,
      sha256Hash: row.doc_hash,
      issueDate: row.issue_date,
      status: row.status,
      createdAt: row.created_at
    };
  }

  const allReqs = getAllCertificateRequests();
  const matchedReq = allReqs.find(r => r.studentDid && r.studentDid.toLowerCase() === clean);
  if (matchedReq) {
    const cId = matchedReq.details?.certId || matchedReq.requestId.replace('REQ-', 'CERT-');
    const docVal = matchedReq.details?.sha256Hash || matchedReq.details?.docHash || '';
    const ipfsVal = matchedReq.details?.ipfsCid || matchedReq.details?.ipfsHash || (docVal ? `Qm${docVal.substring(0, 44)}` : '');
    return {
      certId: cId,
      requestId: matchedReq.requestId,
      studentId: matchedReq.studentId,
      studentName: matchedReq.studentName,
      studentDid: matchedReq.studentDid,
      department: matchedReq.department,
      certType: matchedReq.certType,
      ipfsHash: ipfsVal,
      ipfsCid: ipfsVal,
      r2Uri: matchedReq.details?.r2Uri || `r2://academic-certificates/certificates/${cId}.pdf`,
      docHash: docVal,
      sha256Hash: docVal,
      issueDate: matchedReq.updatedAt ? matchedReq.updatedAt.substring(0, 10) : new Date().toISOString().substring(0, 10),
      status: matchedReq.status === 'REVOKED' ? 'REVOKED' : 'ISSUED',
      createdAt: matchedReq.submittedAt
    };
  }

  return null;
}


function seedAllCoreData() {
  const now = new Date().toISOString();

  // 1. Seed faculties & courses
  for (const f of SEED_FACULTIES) {
    insertFacultyStmt.run(
      f.faculty_id, f.name, f.email, f.password, f.department, f.designation, f.course_id, f.course_name, now
    );
  }

  for (const [semName, semCourses] of Object.entries(SEMESTER_COURSES_CATALOG)) {
    for (const c of semCourses) {
      insertCourseStmt.run(
        c.course_id, c.course_name, 'Department of Computer Science & Engineering', c.credits, c.faculty_id, semName
      );
    }
  }

  // 2. Seed students
  for (const s of SEED_STUDENTS) {
    const did = generateStudentDID(s.name, s.student_id);
    insertStudentStmt.run(
      s.student_id, did, s.name, s.email, s.department, s.enrollment_year,
      s.attendance, s.cie_marks, s.prerequisites_met, s.total_credits, s.required_credits,
      s.disciplinary_clearance, s.capstone_score, s.originality_report,
      s.cgpa, s.backlogs, s.residency_met, s.institutional_clearance, s.fee_dues, s.library_dues,
      s.is_on_ledger ? 1 : 0, s.is_on_ledger ? now : null
    );
  }

  // 3. Seed semester registrations
  for (const reg of SEED_SEMESTER_REGISTRATIONS) {
    insertSemesterRegStmt.run(
      `REG_${reg.student_id}_SEM5`,
      reg.student_id,
      reg.student_name,
      reg.department,
      reg.branch,
      reg.semester_number,
      reg.semester_label,
      reg.academic_year,
      JSON.stringify(STANDARD_SEM5_COURSES),
      'ACTIVE',
      now
    );
  }

  // 4. Enrollments and marks
  for (const student of SEED_STUDENTS) {
    const did = generateStudentDID(student.name, student.student_id);
    for (const course of SEED_FACULTIES) {
      insertEnrollmentStmt.run(course.course_id, student.student_id, did, 'Semester 5');
      const markId = `${course.course_id}_${student.student_id}`;

      let cie = student.cie_marks || 42.0;
      let lab = 23.0;
      let att = student.attendance || 88.0;
      let endsem = 44.0;
      let signed = 1;
      let status = 'APPROVED_BY_FACULTY';

      if (student.student_id === 'STU-2024-004') {
        if (course.course_id === 'CS503') {
          cie = 12.0;
          lab = 10.0;
          att = 76.0;
          endsem = 16.0;
          signed = 0;
          status = 'DRAFT';
        } else {
          cie = 32.0;
          lab = 20.0;
          att = 80.0;
          endsem = 34.0;
        }
      } else if (student.student_id === 'STU-2024-005') {
        if (course.course_id === 'CS501') {
          cie = 16.0;
          lab = 12.0;
          att = 62.0;
          endsem = 20.0;
          signed = 0;
          status = 'DRAFT';
        } else if (course.course_id === 'CS502') {
          cie = 15.0;
          lab = 10.0;
          att = 59.0;
          endsem = 20.0;
          signed = 0;
          status = 'DRAFT';
        } else {
          cie = 24.0;
          lab = 18.0;
          att = 76.0;
          endsem = 28.0;
        }
      } else if (student.student_id === 'STU-2024-DEFICIT') {
        cie = 16.0;
        lab = 12.0;
        att = 60.0;
        endsem = 20.0;
        signed = 0;
        status = 'DRAFT';
      }

      const total = cie + lab + endsem;
      const grade = total >= 90 ? 'EX' : (total >= 80 ? 'A' : (total >= 70 ? 'B' : (total >= 60 ? 'C' : (total >= 50 ? 'D' : 'F'))));

      insertMarksStmt.run(
        markId,
        course.course_id,
        student.student_id,
        did,
        cie,
        lab,
        att,
        endsem,
        total,
        grade,
        signed,
        signed ? `SIG_FACULTY_${course.faculty_id}_HASH_${markId}` : null,
        course.faculty_id,
        status,
        now
      );
    }
  }

  // 5. Pre-seed standard demonstration requests
  autoCreateRequestForStudent('STU-2024-001', 'REQ-2024-001');

  const req2 = autoCreateRequestForStudent('STU-2024-002', 'REQ-2024-002');
  if (req2) {
    updateCertificateRequestStatus('REQ-2024-002', 'ADMIN_FINALIZED', {
      preEndorsed: true,
      approvalNote: 'All institutional clearances complete. Ready for Module 4 certificate minting.'
    });
    recordMultiSigVote('REQ-2024-002', 'DAC_COMMITTEE', 'VOTER-1', 'Dr. Rajesh Kumar', 'HOD', 'APPROVE', 'SIG_DAC_1', 'Academic coursework approved');
    recordMultiSigVote('REQ-2024-002', 'DAC_COMMITTEE', 'VOTER-2', 'Dr. Sunita Rao', 'DAC Member', 'APPROVE', 'SIG_DAC_2', 'Degree criteria satisfied');
    recordMultiSigVote('REQ-2024-002', 'DEAN_COUNCIL', 'VOTER-3', 'Dr. Vikram Malhotra', 'Dean Academic', 'APPROVE', 'SIG_DEAN_1', 'Curricular integrity validated');
    recordMultiSigVote('REQ-2024-002', 'DEAN_COUNCIL', 'VOTER-4', 'Dr. Anand Patel', 'Dean Research', 'APPROVE', 'SIG_DEAN_2', 'Institutional approval granted');
  }

  const req3 = autoCreateRequestForStudent('STU-2024-003', 'REQ-2024-003');
  if (req3) {
    updateCertificateRequestStatus('REQ-2024-003', 'DEAN_APPROVED', {
      preEndorsed: true,
      approvalNote: 'Approved up to Dean. Pending Registrar clearance of statutory fees/library dues.'
    });
  }

  autoCreateRequestForStudent('STU-2024-004', 'REQ-2024-004');
  autoCreateRequestForStudent('STU-2024-005', 'REQ-2024-005');

  const req6 = autoCreateRequestForStudent('STU-2024-006', 'REQ-2024-006');
  if (req6) {
    updateCertificateRequestStatus('REQ-2024-006', 'CERTIFICATE_ISSUED', {
      certId: 'CERT-2024-006',
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      docHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    });
    saveCertificate({
      certId: 'CERT-2024-006',
      requestId: 'REQ-2024-006',
      studentId: 'STU-2024-006',
      studentName: 'Vikram Malhotra',
      studentDid: generateStudentDID('Vikram Malhotra', 'STU-2024-006'),
      department: 'Department of Computer Science & Engineering',
      certType: 'Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)',
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      docHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      issueDate: '2024-11-15T10:00:00.000Z',
      status: 'ISSUED'
    });
  }

  autoCreateRequestForStudent('STU-2020-013', 'REQ-2020-013');
}

function cleanAndReseedDatabase() {
  db.exec(`
    DELETE FROM multisig_votes;
    DELETE FROM certificates;
    DELETE FROM certificate_requests;
    DELETE FROM course_marks;
    DELETE FROM course_enrollments;
    DELETE FROM student_semester_registrations;
    DELETE FROM students;
  `);

  seedAllCoreData();
  return { success: true, message: 'Database successfully cleaned and re-seeded with realistic demonstration personas.' };
}

try {
  seedAllCoreData();
} catch (e) {
  console.error('[SIS DB] Initial seed warning:', e.message);
}

module.exports = {
  db,
  DB_PATH,
  SEMESTER_COURSES_CATALOG,
  getStudentByRollNumber,
  getStudentByDID,
  getAllSISStudents,
  addOrUpdateStudent,
  getAllFaculties,
  getFacultyById,
  getFacultyByEmail,
  registerFaculty,
  getAllCourses,
  getCoursesBySemester,
  enrollStudentInSemesterCourses,
  getCourseById,
  getStudentsEnrolledInCourse,
  upsertCourseMarks,
  getStudentComprehensiveAudit,
  recordMultiSigVote,
  getMultiSigStatus,
  markStudentOnLedger,
  isStudentOnLedger,
  getLedgerStudents,
  getStudentSemesterRegistration,
  getAllSemesterRegistrations,
  upsertStudentSemesterRegistration,
  saveCertificateRequest,
  getCertificateRequest,
  getLatestCertificateRequestForStudent,
  getCertificateRequestByCertId,
  getAllCertificateRequests,
  updateCertificateRequestStatus,
  autoCreateRequestForStudent,
  saveCertificate,
  getCertificate,
  getCertificateByRequestId,
  getCertificateByHash,
  getCertificateByStudentDID,
  getAllCertificates,
  autoApproveAndSignEligibleCourseMarks,
  seedAllCoreData,
  cleanAndReseedDatabase
};
