import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  UserCheck, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  KeyRound, 
  Copy, 
  Send, 
  FileText,
  Filter,
  Award
} from 'lucide-react';

export default function FacultyAdvisorModule() {
  const { API_BASE } = useNetwork();
  const [cohortData, setCohortData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'eligible' | 'deficit'
  const [feedback, setFeedback] = useState(null);
  const [copiedDid, setCopiedDid] = useState(null);
  const [signingStudent, setSigningStudent] = useState(null);

  const fetchCohort = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/faculty-advisor/students`);
      const data = await res.json();
      if (res.ok) {
        setCohortData(Array.isArray(data.cohort) ? data.cohort : []);
      }
    } catch (err) {
      console.error('Error fetching FA cohort:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohort();
  }, []);

  const handleSignAndForward = async (student) => {
    if (!student.isEligible) {
      alert(`Student ${student.studentId} is ineligible due to: ${student.deficitReasons.join('; ')}`);
      return;
    }

    setSigningStudent(student.studentId);
    setFeedback(null);
    try {
      const realRequestId = student.requestId || `REQ-${student.studentId.replace('STU-', '')}`;
      const res = await fetch(`${API_BASE}/faculty-advisor/sign-eligible`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          requestId: realRequestId,
          comments: 'Faculty Advisor verified coursework completeness and certified prerequisites'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `✅ Student ${student.name} (${student.studentId}) successfully endorsed and signed by Faculty Advisor! Forwarded to HOD & DAC Committee for Request ${data.requestId}. (Signature: ${data.faSignature ? data.faSignature.substring(0, 18) : 'Verified'}...)`
        });
        await fetchCohort();
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to sign' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSigningStudent(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(text);
    setTimeout(() => setCopiedDid(null), 2500);
  };

  const filteredCohort = cohortData.filter(student => {
    if (filterMode === 'eligible') return student.isEligible;
    if (filterMode === 'deficit') return !student.isEligible;
    return true;
  });

  const eligibleCount = cohortData.filter(s => s.isEligible).length;
  const deficitCount = cohortData.filter(s => !s.isEligible).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #faf8f5 100%)', borderColor: 'var(--success-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--heading)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <UserCheck size={28} color="var(--success)" />
              Faculty Advisor Comprehensive Audit Gate
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Audits marks submissions across all 5 courses from each faculty member, verifies prerequisite fulfillment, and forwards ONLY eligible students to the HOD & DAC Committee with an FA cryptographic digital signature.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ background: '#ffffff', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--success)' }}>{eligibleCount}</p>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Eligible Candidates</p>
            </div>
            <div style={{ background: '#ffffff', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <p style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--danger)' }}>{deficitCount}</p>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Ineligible / Deficit</p>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`alert-feedback ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Cohort Matrix Table */}
      <div className="card">
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3>Comprehensive Cross-Faculty Course Matrix</h3>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button 
                className={`tab-btn ${filterMode === 'all' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                onClick={() => setFilterMode('all')}
              >
                All ({cohortData.length})
              </button>
              <button 
                className={`tab-btn ${filterMode === 'eligible' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                onClick={() => setFilterMode('eligible')}
              >
                Eligible Only ({eligibleCount})
              </button>
              <button 
                className={`tab-btn ${filterMode === 'deficit' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                onClick={() => setFilterMode('deficit')}
              >
                Deficit Only ({deficitCount})
              </button>
            </div>
          </div>

          <button className="btn-secondary" onClick={fetchCohort} disabled={loading}>
            <RefreshCw size={14} /> Refresh Audit
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student Roll & Name</th>
                <th>Student DID</th>
                <th>Semester & Branch</th>
                <th style={{ minWidth: '300px' }}>Enrolled Course Audits & Grades</th>
                <th>SGPA</th>
                <th>Eligibility</th>
                <th>Faculty Advisor Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCohort.map((student) => {
                return (
                  <tr key={student.studentId} style={{ background: student.isEligible ? '#ffffff' : '#fffcf7' }}>
                    <td>
                      <strong>{student.studentId}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{student.name}</div>
                    </td>
                    <td>
                      <span 
                        className="did-tag" 
                        title={student.did}
                        onClick={() => copyToClipboard(student.did)}
                      >
                        <KeyRound size={12} />
                        {student.did ? `${student.did.substring(0, 16)}...` : 'N/A'}
                        <Copy size={12} />
                      </span>
                      {copiedDid === student.did && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'block' }}>Copied!</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontWeight: 600 }}>{student.semester || 'Semester 5'}</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', maxWidth: '160px' }}>
                        {student.branch || student.department}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {student.courseAudits && student.courseAudits.map(ca => {
                          let statClass = 'badge-neutral';
                          let statText = `${ca.courseId}: Pending`;
                          if (!ca.marks) {
                            statText = `${ca.courseId}: Not Graded`;
                            statClass = 'badge-neutral';
                          } else if (!ca.facultyApproved) {
                            statText = `${ca.courseId}: Unsigned (${ca.marks.total}/100)`;
                            statClass = 'badge-warning';
                          } else if (ca.passed) {
                            statText = `${ca.courseId}: ${ca.marks.total}/100 (${ca.marks.attendance}%)`;
                            statClass = 'badge-success';
                          } else {
                            statText = `${ca.courseId}: Fail (${ca.marks.total}/100)`;
                            statClass = 'badge-danger';
                          }
                          return (
                            <span 
                              key={ca.courseId} 
                              className={`badge ${statClass}`} 
                              style={{ fontSize: '0.73rem', padding: '2px 6px' }}
                              title={`${ca.courseName} | Instructor: ${ca.facultyName || 'Faculty'}`}
                            >
                              {statText}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td><strong>{student.computedSgpa || 'N/A'}</strong></td>
                    <td>
                      {student.isEligible ? (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} /> All Requirements Met
                        </span>
                      ) : (
                        <div>
                          <span className="badge badge-danger">
                            <XCircle size={12} /> Ineligible
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '0.2rem', maxWidth: '180px' }}>
                            {student.deficitReasons?.[0] || 'Requirements incomplete'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {student.faSigned ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="badge badge-success" style={{ fontWeight: 600, padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <CheckCircle2 size={13} /> Endorsed & Forwarded
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Req: {student.requestId || 'REQ-' + student.studentId.replace('STU-', '')}
                          </span>
                        </div>
                      ) : student.isEligible ? (
                        <button 
                          className="btn-success" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                          onClick={() => handleSignAndForward(student)}
                          disabled={signingStudent === student.studentId}
                        >
                          <ShieldCheck size={14} /> ✍️ Sign & Forward to HOD
                        </button>
                      ) : (
                        <button className="btn-secondary" disabled style={{ opacity: 0.6, fontSize: '0.75rem' }}>
                          Blocked (Deficit)
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
    </div>
  );
}
