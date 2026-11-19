import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  UserPlus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  KeyRound, 
  Copy, 
  Layers, 
  Zap, 
  BookOpen, 
  GraduationCap, 
  Building2 
} from 'lucide-react';

export default function StudentModule() {
  const { API_BASE } = useNetwork();
  const [students, setStudents] = useState([]);
  const [sisStudents, setSisStudents] = useState([]);
  const [semesterRegs, setSemesterRegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedDid, setCopiedDid] = useState(null);
  const [activeTab, setActiveTab] = useState('database'); // 'database' | 'ledger' | 'registrations'

  const [form, setForm] = useState({
    studentId: '',
    name: '',
    email: '',
    department: 'Department of Computer Science & Engineering',
    branch: 'Master of Computer Applications (MCA)',
    semester: 'Semester 5',
    enrollmentYear: '2024'
  });
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Fetch courses whenever selected semester changes
  useEffect(() => {
    const fetchSemesterCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await fetch(`${API_BASE}/courses?semester=${encodeURIComponent(form.semester)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setAvailableCourses(data);
          // By default, select all courses for that semester
          setSelectedCourseIds(data.map(c => c.course_id));
        }
      } catch (err) {
        console.error('Error fetching semester courses:', err);
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchSemesterCourses();
  }, [form.semester, API_BASE]);

  const toggleCourseSelection = (courseId) => {
    setSelectedCourseIds(prev => 
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSelectAllCourses = () => {
    if (selectedCourseIds.length === availableCourses.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(availableCourses.map(c => c.course_id));
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ledgerRes, sisRes, semRes] = await Promise.all([
        fetch(`${API_BASE}/students`),
        fetch(`${API_BASE}/sis/students`),
        fetch(`${API_BASE}/semester-registrations`)
      ]);
      const ledgerData = await ledgerRes.json();
      const sisData = await sisRes.json();
      const semData = await semRes.json();
      setStudents(Array.isArray(ledgerData) ? ledgerData : []);
      setSisStudents(Array.isArray(sisData) ? sisData : []);
      setSemesterRegs(Array.isArray(semData) ? semData : []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCourseIds.length === 0) {
      setFeedback({ type: 'error', message: '⚠️ Please select at least one registered course for this semester.' });
      return;
    }

    const coursesPayload = availableCourses.filter(c => selectedCourseIds.includes(c.course_id));
    const semNumber = parseInt(form.semester.replace(/\D/g, '')) || 5;

    setFeedback({ type: 'loading', message: `Deriving DID (SHA-256 + RIPEMD-160), enrolling in ${form.semester} subjects, and registering on ledger...` });
    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          semesterNumber: semNumber,
          semesterLabel: form.semester,
          courses: coursesPayload
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: `✅ Student ${form.studentId} (${form.name}) registered with DID ${data.did} in ${form.semester} (${coursesPayload.length} subjects enrolled) on Fabric ledger!` 
        });
        setForm({
          studentId: '',
          name: '',
          email: '',
          department: 'Department of Computer Science & Engineering',
          branch: 'Master of Computer Applications (MCA)',
          semester: 'Semester 5',
          enrollmentYear: '2024'
        });
        fetchAllData();
      } else {
        setFeedback({ type: 'error', message: `❌ Registration failed: ${data.error}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `❌ Network error: ${err.message}` });
    }
  };

  const handleRegisterOnLedger = async (student) => {
    setActionLoading(student.studentId);
    setFeedback({ type: 'loading', message: `Deriving DID and registering ${student.name} (${student.studentId}) on blockchain ledger...` });
    try {
      const reg = semesterRegs.find(r => r.studentId === student.studentId);
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          department: student.department,
          enrollmentYear: student.enrollmentYear,
          branch: reg?.branch,
          semesterLabel: reg?.semesterLabel || 'Semester 5',
          courses: reg?.registeredCourses
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: `🎉 Student ${student.name} (${student.studentId}) is now officially registered on the blockchain ledger with DID: ${data.did}!` 
        });
        fetchAllData();
      } else {
        setFeedback({ type: 'error', message: `Registration failed: ${data.error}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `Network error: ${err.message}` });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(text);
    setTimeout(() => setCopiedDid(null), 2500);
  };

  const totalSelectedCredits = availableCourses
    .filter(c => selectedCourseIds.includes(c.course_id))
    .reduce((sum, c) => sum + (c.credits || 4), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Registration & Status Overview Cards */}
      <div className="panel-grid">
        {/* Step 1: Register Form Card */}
        <div className="card">
          <div className="card-title">
            <h3>Register Student on Blockchain Ledger</h3>
            <span className="step-num">Step 1</span>
          </div>

          <p className="subtitle">
            Derives a cryptographic Decentralized Identifier (DID: <code>SHA-256 + RIPEMD-160</code>) using the student's legal name and roll number, enrolls them into semester-wise academic courses, and anchors them onto the Hyperledger Fabric ledger.
          </p>

          {feedback && (
            <div className={`alert-feedback ${feedback.type === 'success' ? 'alert-success' : feedback.type === 'loading' ? 'alert-info' : 'alert-error'}`}>
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span style={{ wordBreak: 'break-all' }}>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="stuId">Student Registration ID (Roll Number):</label>
              <input 
                type="text" 
                id="stuId"
                required 
                placeholder="e.g. STU-2024-001"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="stuName">Full Legal Name:</label>
              <input 
                type="text" 
                id="stuName"
                required 
                placeholder="e.g. Alice Johnson"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="stuEmail">Institutional Email:</label>
              <input 
                type="email" 
                id="stuEmail"
                required 
                placeholder="e.g. student@academic.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label htmlFor="stuBranch">Registered Degree / Branch:</label>
                <select
                  id="stuBranch"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="Master of Computer Applications (MCA)">MCA (Master of Computer Applications)</option>
                  <option value="Master of Technology in Computer Science & Engineering (M.Tech CSE)">M.Tech CSE</option>
                  <option value="Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)">B.Tech CSE</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="stuSemester">Academic Semester:</label>
                <select
                  id="stuSemester"
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5 (Default Demo)</option>
                  <option value="Semester 6">Semester 6</option>
                </select>
              </div>
            </div>

            {/* Dynamic Semester Subjects Selection */}
            <div className="form-group" style={{ marginTop: '0.5rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--heading)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <BookOpen size={15} color="var(--primary)" />
                  {form.semester} Subjects ({selectedCourseIds.length} Selected • {totalSelectedCredits} Credits)
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllCourses}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  {selectedCourseIds.length === availableCourses.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {coursesLoading ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                  Loading {form.semester} curriculum subjects...
                </div>
              ) : availableCourses.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  No subjects found for this semester.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {availableCourses.map((c) => {
                    const isChecked = selectedCourseIds.includes(c.course_id);
                    return (
                      <label 
                        key={c.course_id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          padding: '0.35rem 0.5rem', 
                          borderRadius: '6px', 
                          background: isChecked ? '#ffffff' : 'transparent',
                          border: isChecked ? '1px solid var(--primary-border)' : '1px solid transparent',
                          cursor: 'pointer',
                          fontSize: '0.78rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCourseSelection(c.course_id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <code style={{ fontSize: '0.74rem', padding: '1px 4px' }}>{c.course_id}</code>
                        <span style={{ flex: 1, fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--heading)' : 'var(--text-muted)' }}>
                          {c.course_name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {c.credits || 4} Cr • {c.faculty_name || 'Faculty'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="stuYear">Enrollment Year:</label>
              <input 
                type="text" 
                id="stuYear"
                value={form.enrollmentYear}
                onChange={(e) => setForm({ ...form, enrollmentYear: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary full-width" disabled={actionLoading || coursesLoading}>
              <UserPlus size={16} /> Derive DID & Register on Blockchain Ledger
            </button>
          </form>
        </div>

        {/* Blockchain Ledger State Card */}
        <div className="card">
          <div className="card-title">
            <div>
              <h3>Active on Blockchain Ledger ({students.length})</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Only students who have been registered on-chain appear here with valid DIDs.
              </p>
            </div>
            <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }} onClick={fetchAllData}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  <th>Ledger DID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading ledger state...</td></tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        ⚪ No students registered on the blockchain ledger yet.
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        All students currently reside in the University SIS Database off-chain. Click <strong>"Register on Ledger"</strong> in the table below to anchor a student on-chain!
                      </p>
                    </td>
                  </tr>
                ) : (
                  students.map((s) => {
                    const studentId = s.studentId || s.id;
                    const studentName = s.name || s.studentName || 'Student';
                    const studentDid = s.did || s.studentDid || (studentId ? `did:academic:...` : 'N/A');
                    return (
                      <tr key={studentId}>
                        <td><code>{studentId}</code></td>
                        <td><strong>{studentName}</strong></td>
                        <td>
                          <span 
                            className="did-tag" 
                            title={studentDid}
                            onClick={() => copyToClipboard(studentDid)}
                          >
                            <KeyRound size={12} />
                            {studentDid ? `${studentDid.substring(0, 16)}...` : 'did:academic:...'}
                            <Copy size={12} />
                          </span>
                          {copiedDid === studentDid && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'block' }}>Copied!</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} /> On-Chain
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabs for SIS Database Records and Semester Registrations */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button 
            className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Database size={16} /> University SIS Database ({sisStudents.length} Students)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BookOpen size={16} /> Academic Semester Registrations ({semesterRegs.length} Cohorts)
          </button>
        </div>

        {activeTab === 'database' && (
          <div>
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>University SIS Database (Authoritative Off-Chain System of Record)</h3>
              </div>
              <span className="badge badge-info">SQLite: <code>university_sis.db</code></span>
            </div>
            <p className="subtitle">
              Students exist in the university database upon enrollment. Notice the <strong>Ledger Status</strong> column: students are NOT on the blockchain ledger until registered. Use the 1-click action button to anchor them on-chain.
            </p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Decentralized ID (DID)</th>
                    <th>Department</th>
                    <th>Ledger Status</th>
                    <th>Attendance</th>
                    <th>CIE</th>
                    <th>Backlogs</th>
                    <th style={{ textAlign: 'center' }}>Blockchain Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sisStudents.map((sis) => {
                    const isEligible = sis.attendance >= 75 && sis.cieMarks >= 20 && sis.backlogs === 0;
                    return (
                      <tr key={sis.studentId} style={{ background: sis.isOnLedger ? '#fdfdfb' : '#ffffff' }}>
                        <td><code>{sis.studentId}</code></td>
                        <td>
                          <strong>{sis.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: isEligible ? 'var(--success)' : 'var(--danger)' }}>
                            {isEligible ? '✓ Statutory Requirements Met' : '⚠️ Has Deficit'}
                          </div>
                        </td>
                        <td>
                          <span 
                            className="did-tag" 
                            title={sis.did}
                            onClick={() => copyToClipboard(sis.did)}
                          >
                            <KeyRound size={12} />
                            {sis.did ? `${sis.did.substring(0, 16)}...` : 'N/A'}
                            <Copy size={12} />
                          </span>
                        </td>
                        <td>{sis.department}</td>
                        <td>
                          {sis.isOnLedger ? (
                            <span className="badge badge-success" title={`Registered: ${sis.registeredOnLedgerAt}`}>
                              <CheckCircle2 size={12} /> On Ledger
                            </span>
                          ) : (
                            <span className="badge badge-warning" title="Enrolled in University Database only, not yet on ledger">
                              ⚪ DB Only
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ color: sis.attendance >= 75 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                            {sis.attendance}%
                          </span>
                        </td>
                        <td>
                          <span style={{ color: sis.cieMarks >= 20 ? 'var(--success)' : 'var(--danger)' }}>
                            {sis.cieMarks}/50
                          </span>
                        </td>
                        <td>
                          <span style={{ color: sis.backlogs === 0 ? 'var(--success)' : 'var(--danger)', fontWeight: sis.backlogs > 0 ? 700 : 400 }}>
                            {sis.backlogs}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {sis.isOnLedger ? (
                            <span style={{ fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>
                              ✓ Ledger Synced
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={actionLoading === sis.studentId}
                              style={{ padding: '5px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                              onClick={() => handleRegisterOnLedger(sis)}
                            >
                              <Zap size={12} /> Register on Ledger
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'registrations' && (
          <div>
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Student Academic Semester & Course Registrations</h3>
              </div>
              <span className="badge badge-info">Table: <code>student_semester_registrations</code></span>
            </div>
            <p className="subtitle">
              All degrees (MCA, M.Tech CSE, B.Tech CSE) are administered under the <strong>Department of Computer Science & Engineering</strong>. When submitting certificate requests, students must specify their exact registered Department and Branch.
            </p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Department</th>
                    <th>Registered Branch / Degree</th>
                    <th>Semester</th>
                    <th>Registered Courses</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {semesterRegs.map((reg) => (
                    <tr key={reg.id}>
                      <td><code>{reg.studentId}</code></td>
                      <td><strong>{reg.studentName}</strong></td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--heading)' }}>
                          {reg.department}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 600 }}>
                          {reg.branch}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{reg.semesterLabel}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{reg.academicYear}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxWidth: '380px' }}>
                          {reg.registeredCourses && reg.registeredCourses.map((c) => (
                            <span 
                              key={c.course_id} 
                              className="did-tag" 
                              style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                              title={`${c.course_name} (${c.credits} Credits)`}
                            >
                              <code>{c.course_id}</code>: {c.course_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success">
                          {reg.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
