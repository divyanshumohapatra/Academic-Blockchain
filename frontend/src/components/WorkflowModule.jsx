import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Send, Search, FastForward, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

const STAGES = [
  'SUBMITTED',
  'FACULTY_APPROVED',
  'HOD_APPROVED',
  'DAC_APPROVED',
  'EXAM_LOCKED',
  'DEAN_APPROVED',
  'ADMIN_FINALIZED'
];

export default function WorkflowModule({ onReadyToIssue, activeRequestId, setActiveRequestId }) {
  const { API_BASE } = useNetwork();
  const [reqForm, setReqForm] = useState({
    requestId: 'REQ-2024-001',
    studentId: 'STU-2024-001',
    certType: 'Master of Computer Applications (MCA)'
  });
  const [trackedRequest, setTrackedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const generateRandomReqId = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setReqForm((prev) => ({ ...prev, requestId: `REQ-2024-${rand}` }));
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: 'loading', message: 'Submitting certificate request to ledger...' });
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqForm)
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `✅ Request ${reqForm.requestId} submitted on ledger!` });
        setActiveRequestId(reqForm.requestId);
        trackRequest(reqForm.requestId);
      } else {
        setFeedback({ type: 'error', message: `❌ Submission failed: ${data.error}` });
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
    } catch (err) {
      console.error('Error tracking request:', err);
    }
  };

  const advanceStage = async (endpoint, comments) => {
    if (!trackedRequest) return;
    try {
      const res = await fetch(`${API_BASE}/workflow/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: trackedRequest.requestId, comments })
      });
      const data = await res.json();
      if (res.ok) {
        trackRequest(trackedRequest.requestId);
      } else {
        alert(`Approval error: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const autoAdvance = async () => {
    if (!trackedRequest) {
      alert('Please track or submit a request first.');
      return;
    }

    const flow = [
      { endpoint: 'faculty-approve', from: 'SUBMITTED', comments: 'Faculty credit audit complete' },
      { endpoint: 'hod-approve', from: 'FACULTY_APPROVED', comments: 'HOD departmental clearance' },
      { endpoint: 'dac-approve', from: 'HOD_APPROVED', comments: 'DAC compliance confirmed' },
      { endpoint: 'exam-lock', from: 'DAC_APPROVED', comments: 'Exam grades locked' },
      { endpoint: 'dean-approve', from: 'EXAM_LOCKED', comments: 'Dean academic sanction' },
      { endpoint: 'admin-finalize', from: 'DEAN_APPROVED', comments: 'Administrative final clearance' }
    ];

    for (const step of flow) {
      const res = await fetch(`${API_BASE}/requests/${trackedRequest.requestId}`);
      const req = await res.json();
      if (req.status === step.from) {
        await fetch(`${API_BASE}/workflow/${step.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: trackedRequest.requestId, comments: step.comments })
        });
      }
    }

    await trackRequest(trackedRequest.requestId);
  };

  const currentIndex = trackedRequest ? STAGES.indexOf(trackedRequest.status) : -1;

  return (
    <div className="panel-grid">
      {/* 1. Request Submission */}
      <div className="card">
        <div className="card-title">
          <h3>1. Submit Certificate Request</h3>
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

        <form onSubmit={submitRequest}>
          <div className="form-group">
            <label htmlFor="reqIdInput">Request ID:</label>
            <div className="input-with-action">
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
            <label htmlFor="reqStudentId">Registered Student ID:</label>
            <input 
              type="text" 
              id="reqStudentId"
              required 
              placeholder="e.g. STU-2024-001"
              value={reqForm.studentId}
              onChange={(e) => setReqForm({ ...reqForm, studentId: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reqCertType">Degree / Certificate Type (CSE Dept):</label>
            <select 
              id="reqCertType"
              value={reqForm.certType}
              onChange={(e) => setReqForm({ ...reqForm, certType: e.target.value })}
            >
              <option value="Master of Computer Applications (MCA)">Master of Computer Applications (MCA)</option>
              <option value="Bachelor of Technology in Computer Science & Engineering">Bachelor of Technology in Computer Science & Engineering</option>
              <option value="Master of Technology in Computer Science & Engineering">Master of Technology in Computer Science & Engineering</option>
              <option value="Master of Science in Data Science">Master of Science in Data Science</option>
              <option value="Doctor of Philosophy (Ph.D.) in Computer Science">Doctor of Philosophy (Ph.D.) in Computer Science</option>
              <option value="Executive Post Graduate Diploma">Executive Post Graduate Diploma</option>
            </select>
          </div>

          <button type="submit" className="btn-primary full-width" disabled={loading}>
            <Send size={16} />
            Submit Certificate Request
          </button>
        </form>
      </div>

      {/* 2. 7-Stage Stepper & Workflow Progression */}
      <div className="card">
        <div className="card-title">
          <h3>2. 7-Stage State Machine Progression</h3>
          <span className="step-num">Module 2</span>
        </div>

        <div className="form-group">
          <label htmlFor="activeReq">Track Request by ID:</label>
          <div className="input-with-action">
            <input 
              type="text" 
              id="activeReq"
              placeholder="Enter REQ-ID..."
              value={activeRequestId}
              onChange={(e) => setActiveRequestId(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={() => trackRequest(activeRequestId)}>
              <Search size={14} /> Track
            </button>
            <button type="button" className="btn-secondary" onClick={autoAdvance} title="Fast forward all 7 stages">
              <FastForward size={14} /> Auto-Advance
            </button>
          </div>
        </div>

        {/* Stepper Display */}
        <div className="stepper-container">
          {STAGES.map((stage, idx) => {
            const isCompleted = currentIndex > idx || trackedRequest?.status === 'CERTIFICATE_ISSUED';
            const isActive = currentIndex === idx && trackedRequest?.status !== 'CERTIFICATE_ISSUED';
            return (
              <React.Fragment key={stage}>
                <div className={`step-node ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                  <div className="step-circle">
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span className="step-label">{stage.replace('_APPROVED', '').replace('_FINALIZED', '')}</span>
                </div>
                {idx < STAGES.length - 1 && (
                  <div className={`step-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Action Controls based on current stage */}
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#0f172a', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Next Required Action:</h4>
          {trackedRequest ? (
            <div>
              {trackedRequest.status === 'SUBMITTED' && (
                <button className="btn-primary" onClick={() => advanceStage('faculty-approve', 'Faculty review & credits verified')}>
                  ✍️ Org 1: Approve as Faculty Advisor
                </button>
              )}
              {trackedRequest.status === 'FACULTY_APPROVED' && (
                <button className="btn-primary" onClick={() => advanceStage('hod-approve', 'HOD approval confirmed')}>
                  ✍️ Org 1: Approve as HOD (CSE)
                </button>
              )}
              {trackedRequest.status === 'HOD_APPROVED' && (
                <button className="btn-primary" onClick={() => advanceStage('dac-approve', 'Department Academic Committee approval granted')}>
                  ✍️ Org 1: Approve as DAC Committee
                </button>
              )}
              {trackedRequest.status === 'DAC_APPROVED' && (
                <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={() => advanceStage('exam-lock', 'Grades locked by Exam Controller')}>
                  🔒 Org 2: Lock Exam Grades & Transcripts
                </button>
              )}
              {trackedRequest.status === 'EXAM_LOCKED' && (
                <button className="btn-primary" style={{ background: '#10b981' }} onClick={() => advanceStage('dean-approve', 'Dean Academic clearance granted')}>
                  ✍️ Org 3: Sanction by Dean
                </button>
              )}
              {trackedRequest.status === 'DEAN_APPROVED' && (
                <button className="btn-primary" style={{ background: '#10b981' }} onClick={() => advanceStage('admin-finalize', 'Final Administrative clearance')}>
                  🏛️ Org 3: Finalize by Central Administration
                </button>
              )}
              {trackedRequest.status === 'ADMIN_FINALIZED' && (
                <p style={{ color: '#34d399', fontWeight: 600 }}>
                  🎉 Request is ADMIN_FINALIZED! Proceed to Module 3 below to issue & anchor on ledger.
                </p>
              )}
              {trackedRequest.status === 'CERTIFICATE_ISSUED' && (
                <p style={{ color: '#38bdf8', fontWeight: 600 }}>
                  🎓 Certificate Issued on Ledger! Cert ID: <code>{trackedRequest.certificateId || 'N/A'}</code>
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No active request loaded. Track an existing request or submit a new one.</p>
          )}
        </div>

        {/* Transition History */}
        <div className="history-box">
          <h4>Ledger Transition History:</h4>
          <ul className="history-list">
            {!trackedRequest?.history || trackedRequest.history.length === 0 ? (
              <li className="empty-hint">No transition history</li>
            ) : (
              trackedRequest.history.map((h, i) => (
                <li key={i}>
                  <span><strong>{h.stage}</strong> by <code>{h.updatedBy || 'Authority'}</code></span>
                  <span style={{ color: '#94a3b8' }}>{h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : ''} - {h.comments || ''}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
