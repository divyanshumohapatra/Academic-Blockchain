import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  Send, 
  Search, 
  CheckCircle2, 
  Clock, 
  KeyRound, 
  Copy, 
  Bot, 
  Vote, 
  ShieldCheck, 
  AlertCircle,
  FileCheck2,
  Users
} from 'lucide-react';

const STAGES = [
  'SUBMITTED',
  'FACULTY_APPROVED',
  'FA_APPROVED',
  'DAC_APPROVED',
  'EXAM_LOCKED',
  'DEAN_APPROVED',
  'ADMIN_FINALIZED'
];

export default function WorkflowModule({ onReadyToIssue, activeRequestId, setActiveRequestId, onSwitchToAgents }) {
  const { API_BASE } = useNetwork();
  const [reqForm, setReqForm] = useState({
    requestId: 'REQ-2024-001',
    studentId: 'STU-2024-001',
    certType: 'Master of Computer Applications (MCA)',
    department: 'Department of Computer Science & Engineering'
  });
  const [trackedRequest, setTrackedRequest] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [copiedDid, setCopiedDid] = useState(null);
  const [dacStatus, setDacStatus] = useState(null);
  const [deanStatus, setDeanStatus] = useState(null);
  const [ledgerStudents, setLedgerStudents] = useState([]);

  // Fetch all registered ledger students on mount for auto-suggestion
  useEffect(() => {
    const fetchLedgerStudents = async () => {
      try {
        const res = await fetch(`${API_BASE}/students`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setLedgerStudents(data);
        }
      } catch (e) {}
    };
    fetchLedgerStudents();
  }, [API_BASE]);

  // Fetch student academic registration and on-ledger status when studentId changes
  const checkStudent = async () => {
    if (!reqForm.studentId) {
      setStudentProfile(null);
      return;
    }
    try {
      const [semRes, stuRes] = await Promise.all([
        fetch(`${API_BASE}/students/${encodeURIComponent(reqForm.studentId.trim())}/semester-registration`),
        fetch(`${API_BASE}/students/${encodeURIComponent(reqForm.studentId.trim())}`)
      ]);
      const semData = semRes.ok ? await semRes.json() : null;
      const stuData = stuRes.ok ? await stuRes.json() : null;
      if (semData || stuData) {
        const isOnLedger = Boolean(
          stuData?.isOnLedger || 
          stuData?.registeredOnLedgerAt || 
          stuData?.registeredAt || 
          stuData?.docType === 'student'
        );
        setStudentProfile({
          studentId: reqForm.studentId,
          name: stuData?.name || semData?.studentName || '',
          department: semData?.department || stuData?.department || 'Department of Computer Science & Engineering',
          branch: semData?.branch || 'Master of Computer Applications (MCA)',
          semester: semData?.semesterLabel || 'Semester 5',
          isOnLedger,
          did: stuData?.did || null
        });
      } else {
        setStudentProfile(null);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    checkStudent();
  }, [reqForm.studentId, API_BASE]);

  const generateRandomReqId = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setReqForm((prev) => ({ ...prev, requestId: `REQ-2024-${rand}` }));
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: 'loading', message: 'Verifying credentials and submitting certificate request to ledger...' });
    try {
      const payload = {
        requestId: reqForm.requestId,
        studentId: reqForm.studentId,
        certType: reqForm.certType,
        department: studentProfile?.department || 'Department of Computer Science & Engineering',
        branch: reqForm.certType
      };

      const res = await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ 
          type: 'success', 
          message: `✅ Request ${reqForm.requestId} verified & submitted on ledger! (DID: ${data.did ? data.did.substring(0, 18) + '...' : ''})` 
        });
        setActiveRequestId(reqForm.requestId);
        trackRequest(reqForm.requestId);
      } else {
        setFeedback({ type: 'error', message: `❌ Submission blocked: ${data.error}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: `❌ Network error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const trackRequest = async (idToTrack) => {
    const reqId = idToTrack || activeRequestId;
    if (!reqId) return;
    try {
      const res = await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`);
      if (!res.ok) {
        alert(`Request ${reqId} not found.`);
        return;
      }
      const data = await res.json();
      setTrackedRequest(data);
      if (onReadyToIssue && (data.status === 'ADMIN_FINALIZED' || data.status === 'CERTIFICATE_ISSUED')) {
        onReadyToIssue(data);
      }
      // Also fetch multi-sig statuses
      fetchMultiSigStatuses(reqId);
    } catch (err) {
      console.error('Error tracking request:', err);
    }
  };

  const fetchMultiSigStatuses = async (reqId) => {
    try {
      const [dacRes, deanRes] = await Promise.all([
        fetch(`${API_BASE}/workflow/dac-multisig/status/${encodeURIComponent(reqId)}`),
        fetch(`${API_BASE}/workflow/dean-multisig/status/${encodeURIComponent(reqId)}`)
      ]);
      const dacData = await dacRes.json();
      const deanData = await deanRes.json();
      setDacStatus(dacData);
      setDeanStatus(deanData);
    } catch (e) {
      // fallback
    }
  };

  const advanceStage = async (endpoint, payload = {}) => {
    if (!trackedRequest) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workflow/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: trackedRequest.requestId, ...payload })
      });
      const data = await res.json();
      if (res.ok) {
        trackRequest(trackedRequest.requestId);
        if (setActiveRequestId) setActiveRequestId(trackedRequest.requestId);
      } else {
        alert(`Approval error: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cast manual vote in DAC Multi-Sig
  const handleDACVote = async (memberId, memberName, memberRole) => {
    if (!trackedRequest) return;
    advanceStage('dac-multisig/vote', {
      memberId,
      memberName,
      memberRole,
      decision: 'APPROVE',
      comments: `${memberRole} reviewed and confirmed compliance`
    });
  };

  // Cast manual vote in Dean Board Multi-Sig
  const handleDeanVote = async (boardMemberId, boardMemberName, boardMemberRole) => {
    if (!trackedRequest) return;
    advanceStage('dean-multisig/vote', {
      boardMemberId,
      boardMemberName,
      boardMemberRole,
      decision: 'APPROVE',
      comments: `${boardMemberRole} sanctioned degree conferral`
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDid(text);
    setTimeout(() => setCopiedDid(null), 2500);
  };

  const currentIndex = trackedRequest ? STAGES.indexOf(trackedRequest.status) : -1;

  return (
    <div className="panel-grid">
      {/* 1. Request Submission */}
      <div className="card">
        <div className="card-title">
          <h3>1. Submit Certificate Request (Anchors Student DID)</h3>
          <span className="step-num">Step 1</span>
        </div>

        {feedback && (
          <div className={`alert-feedback ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={submitRequest}>
          <div className="form-group">
            <label htmlFor="reqIdInput">Request ID:</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                id="reqIdInput"
                required 
                value={reqForm.requestId}
                onChange={(e) => setReqForm({ ...reqForm, requestId: e.target.value })}
              />
              <button type="button" className="btn-secondary" onClick={generateRandomReqId}>
                Auto
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reqStudentId">Registered Student ID (Roll Number):</label>
            <input 
              type="text" 
              id="reqStudentId"
              list="ledgerStudentsList"
              required 
              placeholder="e.g. STU-2024-001"
              value={reqForm.studentId}
              onChange={(e) => setReqForm({ ...reqForm, studentId: e.target.value })}
            />
            <datalist id="ledgerStudentsList">
              {ledgerStudents.map(s => (
                <option key={s.studentId} value={s.studentId}>{s.name} ({s.department})</option>
              ))}
            </datalist>
          </div>

          {/* Live Student Academic Registration Status Card */}
          {studentProfile && (
            <div style={{ background: studentProfile.isOnLedger ? '#fdfcf9' : '#fff9f0', border: '1px solid ' + (studentProfile.isOnLedger ? 'var(--border)' : 'var(--accent-gold-border)'), borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--heading)' }}>
                  👤 {studentProfile.name} (<code>{studentProfile.studentId}</code>)
                </strong>
                {studentProfile.isOnLedger ? (
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                    <CheckCircle2 size={12} /> On-Chain Ledger
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                    ⚪ DB Only (Not on Ledger)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong>Dept:</strong> {studentProfile.department}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                <strong>Registered Branch:</strong> <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{studentProfile.branch}</span> ({studentProfile.semester})
              </div>

              {!studentProfile.isOnLedger && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertCircle size={14} /> Student is in database only. Must be registered on ledger to request.
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const res = await fetch(`${API_BASE}/students`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            studentId: studentProfile.studentId,
                            name: studentProfile.name,
                            department: studentProfile.department,
                            branch: studentProfile.branch
                          })
                        });
                        if (res.ok) {
                          checkStudent();
                          fetch(`${API_BASE}/students`).then(r => r.json()).then(data => Array.isArray(data) && setLedgerStudents(data)).catch(() => {});
                        }
                      } catch (e) {
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    ⚡ Register on Ledger Now
                  </button>
                </div>
              )}

              {studentProfile.branch !== reqForm.certType && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-gold)' }}>
                    ⚠️ Degree requested differs from registered branch
                  </span>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                    onClick={() => setReqForm({ ...reqForm, certType: studentProfile.branch })}
                  >
                    Set to {studentProfile.branch.includes('MCA') ? 'MCA' : studentProfile.branch.includes('M.Tech') ? 'M.Tech CSE' : 'B.Tech CSE'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reqDept">Academic Department (All CSE Branches):</label>
            <input 
              type="text" 
              id="reqDept"
              readOnly
              value={studentProfile?.department || 'Department of Computer Science & Engineering'}
              style={{ background: '#f8f6f0', color: 'var(--text-muted)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reqCertType">Degree / Branch Requested:</label>
            <select 
              id="reqCertType"
              value={reqForm.certType}
              onChange={(e) => setReqForm({ ...reqForm, certType: e.target.value })}
            >
              <option value="Master of Computer Applications (MCA)">Master of Computer Applications (MCA)</option>
              <option value="Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)">Bachelor of Technology in Computer Science & Engineering (B.Tech CSE)</option>
              <option value="Master of Technology in Computer Science & Engineering (M.Tech CSE)">Master of Technology in Computer Science & Engineering (M.Tech CSE)</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn-primary full-width" 
            disabled={loading || (studentProfile && !studentProfile.isOnLedger)}
          >
            <Send size={16} /> Submit Certificate Request
          </button>
        </form>
      </div>

      {/* 2. State Machine Progression & Multi-Sig */}
      <div className="card">
        <div className="card-title">
          <h3>2. Multi-Sig Governance State Machine Progression</h3>
          <span className="step-num">Step 2</span>
        </div>

        <div className="form-group">
          <label htmlFor="activeReq">Track Request by ID:</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              id="activeReq"
              placeholder="Enter REQ-ID..."
              value={activeRequestId}
              onChange={(e) => setActiveRequestId(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            />
            <button type="button" className="btn-primary" onClick={() => trackRequest(activeRequestId)}>
              <Search size={14} /> Track
            </button>
            {onSwitchToAgents && (
              <button 
                type="button" 
                className="btn-success" 
                onClick={onSwitchToAgents}
                title="Execute via Autonomous Multi-Agent AI"
              >
                <Bot size={14} /> 🤖 1-Click Multi-Agent Pipeline
              </button>
            )}
          </div>
        </div>

        {/* Student DID Badge if Request Loaded */}
        {trackedRequest && (
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student ID: <strong>{trackedRequest.studentId}</strong></span>
              <div style={{ fontSize: '0.78rem', color: 'var(--heading)', fontWeight: 600 }}>{trackedRequest.studentName || trackedRequest.details?.name || 'Student'}</div>
            </div>
            <div>
              <span 
                className="did-tag" 
                title={trackedRequest.studentDid || trackedRequest.details?.did}
                onClick={() => copyToClipboard(trackedRequest.studentDid || trackedRequest.details?.did)}
              >
                <KeyRound size={12} />
                {(trackedRequest.studentDid || trackedRequest.details?.did) ? `${(trackedRequest.studentDid || trackedRequest.details?.did).substring(0, 18)}...` : 'Generating DID...'}
                <Copy size={12} />
              </span>
              {copiedDid && <span style={{ fontSize: '0.7rem', color: 'var(--success)', marginLeft: '0.3rem' }}>Copied!</span>}
            </div>
          </div>
        )}

        {/* Stepper Display */}
        <div className="stepper-container">
          <div className={`stepper-item ${currentIndex >= 0 ? 'completed' : ''}`}>
            <div className="step-icon">1</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Submission & DID Registration</h4>
                <span className="step-badge">{currentIndex >= 0 ? 'Completed' : 'Pending'}</span>
              </div>
              <p className="step-desc">Student request created and DID derived with SHA-256 + RIPEMD-160.</p>
            </div>
          </div>

          <div className={`stepper-item ${currentIndex >= 1 ? 'completed' : (currentIndex === 0 ? 'current' : '')}`}>
            <div className="step-icon">2</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Faculty Course Grading & Signatures</h4>
                <span className="step-badge">{currentIndex >= 1 ? 'Completed' : 'Pending'}</span>
              </div>
              <p className="step-desc">Instructors enter marks and sign with their private keys.</p>
              {trackedRequest?.status === 'SUBMITTED' && (
                <button 
                  className="btn-primary" 
                  style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} 
                  disabled={loading}
                  onClick={() => advanceStage('faculty-approve', { comments: 'Faculty marks verified' })}
                >
                  <ShieldCheck size={14} />
                  {loading ? 'Processing...' : '✍️ Endorse Faculty Coursework'}
                </button>
              )}
            </div>
          </div>

          <div className={`stepper-item ${currentIndex >= 2 ? 'completed' : (currentIndex === 1 ? 'current' : '')}`}>
            <div className="step-icon">3</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Faculty Advisor (FA) Comprehensive Gate</h4>
                <span className="step-badge">{currentIndex >= 2 ? 'Completed' : 'Pending'}</span>
              </div>
              <p className="step-desc">FA checks all 5 subjects, filters eligible candidates, and signs.</p>
              {(trackedRequest?.status === 'FACULTY_APPROVED' || trackedRequest?.status === 'SUBMITTED') && (
                <button 
                  className="btn-primary" 
                  style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} 
                  disabled={loading}
                  onClick={() => advanceStage('faculty-advisor-approve', { comments: 'All 5 courses satisfied. FA endorsed.' })}
                >
                  <ShieldCheck size={14} />
                  {loading ? 'Processing...' : '✍️ FA Sign & Endorse Eligible Candidate'}
                </button>
              )}
            </div>
          </div>

          {/* DAC Majority Multi-Sig Box */}
          <div className={`stepper-item ${currentIndex >= 3 ? 'completed' : (currentIndex === 2 ? 'current' : '')}`}>
            <div className="step-icon">4</div>
            <div className="step-content">
              <div className="step-header">
                <h4>HOD + DAC Committee (Majority Multi-Sig &ge; 2/3)</h4>
                <span className={`quorum-badge ${dacStatus?.isMajorityPassed || currentIndex >= 3 ? 'passed' : ''}`}>
                  {dacStatus ? `${dacStatus.approvalCount}/3 Signatures (${dacStatus.isMajorityPassed ? 'Quorum Met' : 'Voting Active'})` : 'Quorum &ge; 2/3'}
                </span>
              </div>
              <p className="step-desc">Department Academic Committee majority multi-sig approval based on credits & thesis.</p>

              {(trackedRequest?.status === 'FA_APPROVED' || trackedRequest?.status === 'HOD_APPROVED') && (
                <div className="multisig-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>DAC Multi-Sig Voting Panel:</span>
                    <button 
                      className="btn-success" 
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => advanceStage('dac-multisig/agent-vote')}
                    >
                      <Bot size={13} /> 🤖 Auto-Vote DAC Agents
                    </button>
                  </div>

                  <div className="member-card-grid">
                    <div className="member-card">
                      <strong>Prof. K. V. Rao</strong>
                      <div className="member-role">HOD & DAC Chair</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDACVote('DAC-MEMBER-HOD', 'Prof. K. V. Rao', 'HOD & Chair')}
                      >
                        ✍️ Sign as HOD
                      </button>
                    </div>

                    <div className="member-card">
                      <strong>Dr. Sunita Rao</strong>
                      <div className="member-role">Curriculum Lead</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDACVote('DAC-MEMBER-CURRICULUM', 'Dr. Sunita Rao', 'Curriculum Lead')}
                      >
                        ✍️ Sign as DAC Member 1
                      </button>
                    </div>

                    <div className="member-card">
                      <strong>Dr. Anand Patel</strong>
                      <div className="member-role">Research & Capstone Lead</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDACVote('DAC-MEMBER-CAPSTONE', 'Dr. Anand Patel', 'Capstone Lead')}
                      >
                        ✍️ Sign as DAC Member 2
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`stepper-item ${currentIndex >= 4 ? 'completed' : (currentIndex === 3 ? 'current' : '')}`}>
            <div className="step-icon">5</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Examination Board Grade Lockdown (Org 2)</h4>
                <span className="step-badge">{currentIndex >= 4 ? 'Locked' : 'Pending'}</span>
              </div>
              <p className="step-desc">Asserts 0 backlogs and commits SHA-256 Merkle digest.</p>
              {trackedRequest?.status === 'DAC_APPROVED' && (
                <button className="btn-primary" style={{ background: '#d97706', marginTop: '0.5rem', fontSize: '0.8rem' }} onClick={() => advanceStage('exam-lock', { comments: 'Exam grades verified and locked' })}>
                  🔒 Lock Grades & Compute Merkle Hash
                </button>
              )}
            </div>
          </div>

          {/* Dean Senate Board Majority Multi-Sig Box */}
          <div className={`stepper-item ${currentIndex >= 5 ? 'completed' : (currentIndex === 4 ? 'current' : '')}`}>
            <div className="step-icon">6</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Dean Academics & Senate Board (Majority Multi-Sig &ge; 2/3)</h4>
                <span className={`quorum-badge ${deanStatus?.isMajorityPassed || currentIndex >= 5 ? 'passed' : ''}`}>
                  {deanStatus ? `${deanStatus.approvalCount}/3 Signatures (${deanStatus.isMajorityPassed ? 'Quorum Met' : 'Voting Active'})` : 'Quorum &ge; 2/3'}
                </span>
              </div>
              <p className="step-desc">Dean Senate Board majority multi-sig approval based on residency and degree conferral.</p>

              {trackedRequest?.status === 'EXAM_LOCKED' && (
                <div className="multisig-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Dean Senate Multi-Sig Voting Panel:</span>
                    <button 
                      className="btn-success" 
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      onClick={() => advanceStage('dean-multisig/agent-vote')}
                    >
                      <Bot size={13} /> 🤖 Auto-Vote Dean Agents
                    </button>
                  </div>

                  <div className="member-card-grid">
                    <div className="member-card">
                      <strong>Prof. P. Chandrasekhar</strong>
                      <div className="member-role">Dean of Academic Affairs</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDeanVote('DEAN-OFFICE-CHAIR', 'Prof. P. Chandrasekhar', 'Dean Academics')}
                      >
                        ✍️ Sign as Dean
                      </button>
                    </div>

                    <div className="member-card">
                      <strong>Prof. S. R. Murthy</strong>
                      <div className="member-role">Associate Dean (Curriculum)</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDeanVote('DEAN-OFFICE-ASSOC', 'Prof. S. R. Murthy', 'Associate Dean')}
                      >
                        ✍️ Sign as Associate Dean
                      </button>
                    </div>

                    <div className="member-card">
                      <strong>Prof. M. V. Ramana</strong>
                      <div className="member-role">Academic Senate Member</div>
                      <button 
                        className="btn-secondary" 
                        style={{ marginTop: '0.4rem', width: '100%', fontSize: '0.75rem', padding: '0.3rem' }}
                        onClick={() => handleDeanVote('SENATE-BOARD-EXT', 'Prof. M. V. Ramana', 'Senate Representative')}
                      >
                        ✍️ Sign as Senate Member
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`stepper-item ${currentIndex >= 6 ? 'completed' : (currentIndex === 5 ? 'current' : '')}`}>
            <div className="step-icon">7</div>
            <div className="step-content">
              <div className="step-header">
                <h4>Administration Final Clearance</h4>
                <span className="step-badge">{currentIndex >= 6 ? 'Finalized' : 'Pending'}</span>
              </div>
              <p className="step-desc">Zero dues clearance verified and authorized for minting.</p>
              {trackedRequest?.status === 'DEAN_APPROVED' && (
                <button className="btn-success" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }} onClick={() => advanceStage('admin-finalize', { comments: 'Dues cleared' })}>
                  🏛️ Finalize Administrative Clearance
                </button>
              )}
              {(trackedRequest?.status === 'ADMIN_FINALIZED' || trackedRequest?.status === 'CERTIFICATE_ISSUED') && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--success-bg)',
                  border: '1px solid var(--success-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.6rem'
                }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--success)', display: 'block' }}>
                      ✅ Administration Cleared for {trackedRequest.studentName || trackedRequest.details?.name || trackedRequest.studentId}!
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Roll No: <strong>{trackedRequest.studentId}</strong> • {trackedRequest.certType || 'Degree Certificate'} — Ready for Module 4 Minting below.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => {
                      const mintTarget = document.getElementById('module4-minting-section') || document.getElementById('selectTargetReq');
                      if (mintTarget) mintTarget.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    💎 Mint Certificate in Module 4 ↓
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
