import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { UserPlus, RefreshCw, CheckCircle, AlertCircle, Database, ArrowRight } from 'lucide-react';

export default function StudentModule() {
  const { API_BASE } = useNetwork();
  const [students, setStudents] = useState([]);
  const [sisStudents, setSisStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    name: '',
    email: '',
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024'
  });
  const [feedback, setFeedback] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const [ledgerRes, sisRes] = await Promise.all([
        fetch(`${API_BASE}/students`),
        fetch(`${API_BASE}/sis/students`)
      ]);
      const ledgerData = await ledgerRes.json();
      const sisData = await sisRes.json();
      setStudents(Array.isArray(ledgerData) ? ledgerData : []);
      setSisStudents(Array.isArray(sisData) ? sisData : []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: 'loading', message: 'Submitting transaction to Org1MSP...' });
    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `✅ Student ${form.studentId} registered on Fabric ledger!` });
        setForm({
          studentId: '',
          name: '',
          email: '',
          department: 'Computer Science & Engineering',
          enrollmentYear: '2024'
        });
        fetchStudents();
      } else {
        setFeedback({ type: 'error', message: `❌ Registration failed: ${data.error}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `❌ Network error: ${err.message}` });
    }
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <div className="card-title">
          <h3>Register New Student</h3>
          <span className="step-num">Module 1</span>
        </div>

        {feedback && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="stuId">Student Registration ID:</label>
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
              placeholder="e.g. Divyanshu Sharma"
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

          <div className="form-group">
            <label htmlFor="stuDept">Academic Department:</label>
            <input 
              type="text" 
              id="stuDept"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="stuYear">Enrollment Year:</label>
            <input 
              type="text" 
              id="stuYear"
              value={form.enrollmentYear}
              onChange={(e) => setForm({ ...form, enrollmentYear: e.target.value })}
            />
          </div>

          <button type="submit" className="btn-primary full-width">
            <UserPlus size={16} />
            Register Student on Ledger (Org 1)
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Registered on Ledger (Fabric)</h3>
          <button className="btn-secondary btn-sm" onClick={fetchStudents}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="empty-hint">Loading registered students...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan="5" className="empty-hint">No students registered yet on ledger.</td></tr>
              ) : (
                students.map((s) => (
                  <tr key={s.studentId}>
                    <td><code>{s.studentId}</code></td>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.email}</td>
                    <td>{s.department}</td>
                    <td>{s.enrollmentYear}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* University SIS Database Reference Card */}
      <div className="card full-width-card" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} style={{ color: '#38bdf8' }} />
            <h3>Authoritative University SIS Database (SQLite: <code>university_sis.db</code>)</h3>
          </div>
          <span className="step-num" style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)' }}>
            Authoritative SIS Records
          </span>
        </div>
        <p className="subtitle" style={{ marginBottom: '1rem' }}>
          Official academic records stored in the University ERP/SIS database. Only students enrolled here can register on the blockchain. When a certificate is requested, these marks and clearance metrics are automatically verified by the autonomous AI agents.
        </p>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Department</th>
                <th>Attendance</th>
                <th>CIE Score</th>
                <th>CGPA</th>
                <th>Backlogs</th>
                <th>Capstone</th>
                <th>Dues</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sisStudents.length === 0 ? (
                <tr><td colSpan="10" className="empty-hint">Loading SIS database records...</td></tr>
              ) : (
                sisStudents.map((sis) => {
                  const isEligible = sis.attendance >= 75 && sis.cieMarks >= 20 && sis.backlogs === 0 && (sis.feeDues + sis.libraryDues === 0) && sis.capstoneScore >= 60;
                  return (
                    <tr key={sis.studentId} style={{ background: isEligible ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                      <td><code>{sis.studentId}</code></td>
                      <td>
                        <strong>{sis.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: isEligible ? '#34d399' : '#f87171' }}>
                          {isEligible ? '✓ Eligible Graduate' : '⚠️ Has Deficit / Hold'}
                        </div>
                      </td>
                      <td>{sis.department}</td>
                      <td>
                        <span style={{ color: sis.attendance >= 75 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {sis.attendance}%
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sis.cieMarks >= 20 ? '#34d399' : '#f87171' }}>
                          {sis.cieMarks}/50
                        </span>
                      </td>
                      <td><strong>{sis.cgpa.toFixed(2)}</strong></td>
                      <td>
                        <span style={{ color: sis.backlogs === 0 ? '#34d399' : '#f87171', fontWeight: sis.backlogs > 0 ? 700 : 400 }}>
                          {sis.backlogs}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sis.capstoneScore >= 60 ? '#34d399' : '#f87171' }}>
                          {sis.capstoneScore}/100
                        </span>
                      </td>
                      <td>
                        <span style={{ color: (sis.feeDues + sis.libraryDues) === 0 ? '#34d399' : '#f87171' }}>
                          ₹{sis.feeDues + sis.libraryDues}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            setForm({
                              studentId: sis.studentId,
                              name: sis.name,
                              email: sis.email,
                              department: sis.department,
                              enrollmentYear: sis.enrollmentYear
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Quick-Fill
                        </button>
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
  );
}
