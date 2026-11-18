import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  GraduationCap, 
  LogIn, 
  UserPlus, 
  BookOpen, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Copy, 
  FileSpreadsheet, 
  Send,
  Users,
  ShieldCheck,
  RefreshCw,
  Award
} from 'lucide-react';

export default function FacultyPortal() {
  const { API_BASE } = useNetwork();
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('login'); // 'login' | 'register'
  const [marksMode, setMarksMode] = useState('manual'); // 'manual' | 'upload'
  const [uploadFile, setUploadFile] = useState(null);
  const [copiedDid, setCopiedDid] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('rajesh.kumar@academic.edu');
  const [loginPassword, setLoginPassword] = useState('password123');

  // Register form state
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: 'password123',
    department: 'Computer Science & Engineering',
    designation: 'Associate Professor',
    courseId: '',
    courseName: ''
  });

  // Fetch faculties and courses on load
  const loadConsortiumData = async () => {
    try {
      const [facRes, courseRes] = await Promise.all([
        fetch(`${API_BASE}/faculty/list`),
        fetch(`${API_BASE}/faculty/courses`)
      ]);
      const facData = await facRes.json();
      const courseData = await courseRes.json();
      setFaculties(Array.isArray(facData) ? facData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
    } catch (err) {
      console.error('Error fetching consortium data:', err);
    }
  };

  useEffect(() => {
    loadConsortiumData();
  }, []);

  // Quick switch faculty for demonstration
  const handleQuickSwitch = async (facultyId) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/faculty/quick-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId })
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setActiveSession(data.session);
        loadCourseStudents(data.session.courseId);
        setFeedback({ type: 'success', message: `✅ Switched to ${data.session.name} (${data.session.courseId})` });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Quick login failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Standard login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/faculty/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setActiveSession(data.session);
        loadCourseStudents(data.session.courseId);
        setFeedback({ type: 'success', message: `✅ Welcome back, ${data.session.name}!` });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Login failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Self-service registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/faculty/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setActiveSession(data.session);
        loadConsortiumData();
        loadCourseStudents(data.session.courseId);
        setFeedback({ type: 'success', message: `🎉 Faculty account provisioned for ${data.session.name}!` });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Registration failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Load students for a course
  const loadCourseStudents = async (courseId) => {
    if (!courseId) return;
    try {
      const res = await fetch(`${API_BASE}/faculty/courses/${encodeURIComponent(courseId)}/students`);
      const data = await res.json();
      if (res.ok) {
        setSelectedCourse(data.course);
        setEnrolledStudents(Array.isArray(data.students) ? data.students : []);
      }
    } catch (err) {
      console.error('Error fetching enrolled students:', err);
    }
  };

  // Update a student mark in state
  const handleMarkChange = (studentId, field, value) => {
    setEnrolledStudents(prev => prev.map(s => {
      if (s.student_id === studentId) {
        const updated = { ...s, [field]: Number(value) };
        const cie = Number(field === 'cie_marks' ? value : (s.cie_marks || 0));
        const lab = Number(field === 'lab_marks' ? value : (s.lab_marks || 0));
        const endsem = Number(field === 'endsem_marks' ? value : (s.endsem_marks || 0));
        const total = cie + lab + endsem;
        const grade = total >= 90 ? 'EX' : (total >= 80 ? 'A' : (total >= 70 ? 'B' : (total >= 60 ? 'C' : (total >= 50 ? 'D' : 'F'))));
        return { ...updated, total_marks: total, grade };
      }
      return s;
    }));
  };

  // Save draft marks
  const handleSaveDraft = async () => {
    if (!selectedCourse || !activeSession) return;
    setLoading(true);
    try {
      const payload = enrolledStudents.map(s => ({
        studentId: s.student_id,
        cieMarks: s.cie_marks,
        labMarks: s.lab_marks,
        attendance: s.attendance,
        endsemMarks: s.endsem_marks,
        faculty_id: activeSession.facultyId
      }));

      const res = await fetch(`${API_BASE}/faculty/courses/${selectedCourse.course_id}/marks/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: activeSession.facultyId,
          marks: payload
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: '💾 Marks draft saved successfully!' });
        loadCourseStudents(selectedCourse.course_id);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to save marks' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Approve & cryptographically sign marksheet
  const handleApproveAndSign = async () => {
    if (!selectedCourse || !activeSession) return;
    setLoading(true);
    setFeedback(null);
    try {
      // First save current marks
      await handleSaveDraft();

      const res = await fetch(`${API_BASE}/faculty/courses/${selectedCourse.course_id}/approve-and-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId: activeSession.facultyId })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `✍️ Course marks cryptographically signed by ${activeSession.name} and forwarded to Faculty Advisor! (Signature: ${data.signature.substring(0, 16)}...)`
        });
        loadCourseStudents(selectedCourse.course_id);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Approval failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Upload Spreadsheet (CSV)
  const handleUploadMarks = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedCourse || !activeSession) {
      alert('Please select a file to upload');
      return;
    }

    setLoading(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('facultyId', activeSession.facultyId);

    try {
      const res = await fetch(`${API_BASE}/faculty/courses/${selectedCourse.course_id}/marks/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `📊 Uploaded ${data.importedCount} student marks from ${data.filename}!` });
        loadCourseStudents(selectedCourse.course_id);
        setUploadFile(null);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Upload failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(text);
    setTimeout(() => setCopiedDid(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #faf8f5 100%)', borderColor: 'var(--primary-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--heading)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <GraduationCap size={28} color="var(--primary)" />
              Faculty Course Grading & Authentication Pipeline
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Dedicated authentication for academic instructors to enter marks manually or via spreadsheet, sign with private keys, and forward to the Faculty Advisor.
            </p>
          </div>

          {activeSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--heading)' }}>{activeSession.name}</p>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{activeSession.designation} • <code>{activeSession.courseId}</code></p>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
                onClick={() => { setActiveSession(null); setSelectedCourse(null); }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`alert-feedback ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* When NOT logged in: Provisioning & Login Sub-View */}
      {!activeSession ? (
        <div className="panel-grid">
          {/* Quick Demo Switcher Card */}
          <div className="card">
            <div className="card-title">
              <h3>⚡ Quick Demo Switcher (5 Pre-Seeded Faculties & Subjects)</h3>
              <span className="badge badge-info">1-Click Login</span>
            </div>
            <p className="subtitle">
              Select any of the 5 authorized course professors to immediately access their marksheet:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {faculties.map((f) => (
                <div 
                  key={f.faculty_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.9rem',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleQuickSwitch(f.faculty_id)}
                >
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--heading)' }}>{f.name}</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.designation} • {f.department}</p>
                    <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="badge badge-info"><code>{f.course_id}</code></span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text)' }}>{f.course_name}</span>
                    </div>
                  </div>
                  <button className="btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                    <LogIn size={14} /> Enter Portal
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dedicated Account Provisioning & Login Form Card */}
          <div className="card">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <button 
                className={`tab-btn ${activeSubTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('login')}
              >
                <LogIn size={16} /> Faculty Sign In
              </button>
              <button 
                className={`tab-btn ${activeSubTab === 'register' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('register')}
              >
                <UserPlus size={16} /> Register New Faculty Account
              </button>
            </div>

            {activeSubTab === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Institutional Faculty Email:</label>
                  <input 
                    type="email" 
                    required 
                    value={loginEmail} 
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. rajesh.kumar@academic.edu"
                  />
                </div>
                <div className="form-group">
                  <label>Security Password:</label>
                  <input 
                    type="password" 
                    required 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="password123"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={loading}>
                  <LogIn size={16} /> Authenticate & Access Assigned Course
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label>Faculty Full Name:</label>
                  <input 
                    type="text" 
                    required 
                    value={regForm.name} 
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    placeholder="e.g. Dr. Priya Sharma"
                  />
                </div>
                <div className="form-group">
                  <label>Faculty Email:</label>
                  <input 
                    type="email" 
                    required 
                    value={regForm.email} 
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="priya.sharma@academic.edu"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Course Code:</label>
                    <input 
                      type="text" 
                      required 
                      value={regForm.courseId} 
                      onChange={(e) => setRegForm({ ...regForm, courseId: e.target.value })}
                      placeholder="e.g. CS506"
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation:</label>
                    <input 
                      type="text" 
                      required 
                      value={regForm.designation} 
                      onChange={(e) => setRegForm({ ...regForm, designation: e.target.value })}
                      placeholder="Associate Professor"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Course Subject Name:</label>
                  <input 
                    type="text" 
                    required 
                    value={regForm.courseName} 
                    onChange={(e) => setRegForm({ ...regForm, courseName: e.target.value })}
                    placeholder="e.g. Quantum Computing & Quantum Cryptography"
                  />
                </div>
                <button type="submit" className="btn-success full-width" disabled={loading}>
                  <UserPlus size={16} /> Provision Faculty Account & Register Course
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        /* Logged In Dashboard */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Course Details Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: '0.4rem' }}>Assigned Course Roster</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--heading)' }}>
                  <code>{selectedCourse?.course_id}</code>: {selectedCourse?.course_name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Department: {selectedCourse?.department} • Credits: {selectedCourse?.credits || 4} • {selectedCourse?.semester || 'Semester 5'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--primary)' }}>Switch Course:</label>
                    <select 
                      value={selectedCourse?.course_id || ''} 
                      onChange={(e) => loadCourseStudents(e.target.value)}
                      style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.78rem', background: '#fff', color: 'var(--heading)', fontWeight: 600 }}
                    >
                      {courses.map(c => (
                        <option key={c.course_id} value={c.course_id}>
                          [{c.semester || 'Sem 5'}] {c.course_id}: {c.course_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mode Switcher */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className={`btn-secondary ${marksMode === 'manual' ? 'active' : ''}`}
                  style={{ background: marksMode === 'manual' ? 'var(--primary-light)' : '#ffffff', borderColor: marksMode === 'manual' ? 'var(--primary)' : 'var(--border)' }}
                  onClick={() => setMarksMode('manual')}
                >
                  <BookOpen size={16} /> Manual Entry Grid
                </button>
                <button 
                  className={`btn-secondary ${marksMode === 'upload' ? 'active' : ''}`}
                  style={{ background: marksMode === 'upload' ? 'var(--primary-light)' : '#ffffff', borderColor: marksMode === 'upload' ? 'var(--primary)' : 'var(--border)' }}
                  onClick={() => setMarksMode('upload')}
                >
                  <Upload size={16} /> Upload Excel / CSV
                </button>
                <a 
                  href={`${API_BASE}/faculty/courses/${selectedCourse?.course_id}/template`} 
                  className="btn-secondary" 
                  download
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={16} /> Download Template
                </a>
              </div>
            </div>
          </div>

          {/* Spreadsheet Upload Box if Mode is 'upload' */}
          {marksMode === 'upload' && (
            <div className="card" style={{ background: '#fdfbf7', border: '2px dashed var(--accent-gold-border)' }}>
              <div className="card-title">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet size={20} color="var(--accent-gold)" />
                  Batch Upload Course Spreadsheet (Excel / CSV)
                </h3>
              </div>
              <p className="subtitle">
                Upload a <code>.csv</code> spreadsheet containing student marks. The system will automatically map <code>StudentID</code>, <code>CIEMarks</code>, <code>LabMarks</code>, <code>Attendance</code>, and <code>EndsemMarks</code>.
              </p>

              <form onSubmit={handleUploadMarks} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <input 
                  type="file" 
                  accept=".csv,.txt,.xlsx,.xls" 
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  style={{ padding: '0.5rem' }}
                />
                <button type="submit" className="btn-primary" disabled={loading || !uploadFile}>
                  <Upload size={16} /> Parse & Ingest Marks
                </button>
              </form>
            </div>
          )}

          {/* Student Marks Table */}
          <div className="card">
            <div className="card-title">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Users size={20} color="var(--primary)" />
                  Simultaneous Scoring Grid ({enrolledStudents.length} Enrolled Students)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', marginBottom: 0 }}>
                  You have full concurrent access to all enrolled students for <strong>{selectedCourse?.course_id}</strong>. Edit scores simultaneously in the table or upload an Excel/CSV sheet, then save all concurrently.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={() => loadCourseStudents(selectedCourse?.course_id)}>
                  <RefreshCw size={14} /> Refresh Roster
                </button>
                <button className="btn-primary" onClick={handleSaveDraft} disabled={loading} title="Save scores for all enrolled students concurrently">
                  💾 Save All Scores Simultaneously
                </button>
                <button className="btn-success" onClick={handleApproveAndSign} disabled={loading}>
                  <ShieldCheck size={16} /> ✍️ Sign & Submit to Faculty Advisor
                </button>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Decentralized ID (DID)</th>
                    <th style={{ width: 100 }}>CIE (50)</th>
                    <th style={{ width: 100 }}>Lab (25)</th>
                    <th style={{ width: 110 }}>Attendance %</th>
                    <th style={{ width: 100 }}>Endsem (50)</th>
                    <th>Total (100)</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((s) => {
                    const isPassed = (s.attendance || 0) >= 75 && (s.cie_marks || 0) >= 20;
                    return (
                      <tr key={s.student_id}>
                        <td><strong>{s.student_id}</strong></td>
                        <td>{s.name}</td>
                        <td>
                          <span 
                            className="did-tag" 
                            title={s.student_did}
                            onClick={() => copyToClipboard(s.student_did)}
                          >
                            <KeyRound size={12} />
                            {s.student_did ? `${s.student_did.substring(0, 18)}...` : 'N/A'}
                            <Copy size={12} />
                          </span>
                          {copiedDid === s.student_did && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--success)', marginLeft: '0.3rem' }}>Copied!</span>
                          )}
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="0" 
                            max="50" 
                            value={s.cie_marks || 0}
                            onChange={(e) => handleMarkChange(s.student_id, 'cie_marks', e.target.value)}
                            style={{ width: '75px', padding: '0.35rem' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="0" 
                            max="25" 
                            value={s.lab_marks || 0}
                            onChange={(e) => handleMarkChange(s.student_id, 'lab_marks', e.target.value)}
                            style={{ width: '75px', padding: '0.35rem' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={s.attendance || 0}
                            onChange={(e) => handleMarkChange(s.student_id, 'attendance', e.target.value)}
                            style={{ 
                              width: '80px', 
                              padding: '0.35rem', 
                              borderColor: (s.attendance || 0) < 75 ? 'var(--danger)' : 'var(--border)' 
                            }}
                          />
                          {(s.attendance || 0) < 75 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--danger)', display: 'block' }}>&lt; 75%</span>
                          )}
                        </td>
                        <td>
                          <input 
                            type="number" 
                            min="0" 
                            max="50" 
                            value={s.endsem_marks || 0}
                            onChange={(e) => handleMarkChange(s.student_id, 'endsem_marks', e.target.value)}
                            style={{ width: '75px', padding: '0.35rem' }}
                          />
                        </td>
                        <td><strong>{s.total_marks || 0}/100</strong></td>
                        <td>
                          <span className={`badge ${s.grade === 'F' ? 'badge-danger' : 'badge-success'}`}>
                            {s.grade || 'PENDING'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${s.marks_status === 'APPROVED_BY_FACULTY' ? 'badge-success' : 'badge-warning'}`}>
                            {s.marks_status === 'APPROVED_BY_FACULTY' ? 'Signed & Forwarded' : 'Draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signing Stamp Card */}
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--heading)' }}>
                  🔐 Cryptographic Faculty Signature Status
                </p>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Instructor Key: <code>{activeSession.facultyId}</code> • Algorithm: HMAC SHA-256 with Fabric consortium endorsement.
                </p>
              </div>

              <button className="btn-success" onClick={handleApproveAndSign} disabled={loading}>
                <ShieldCheck size={18} /> Approve, Sign & Forward Marksheet to Faculty Advisor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
