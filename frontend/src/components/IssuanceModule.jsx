import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Award, FileText, Globe, CheckCircle2, ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Lock } from 'lucide-react';

export default function IssuanceModule({ trackedRequest, onCertificateIssued }) {
  const { API_BASE } = useNetwork();
  const [certId, setCertId] = useState('CERT-2024-001');
  const [issuing, setIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState(null);
  const [error, setError] = useState(null);

  // AI Fraud Sentinel Gatekeeper State
  const [activeProfile, setActiveProfile] = useState('verified'); // 'verified' | 'tampered_gpa' | 'prereq_violation'
  const [auditLoading, setAuditLoading] = useState(false);
  const [gatekeeperAudit, setGatekeeperAudit] = useState(null);

  const auditProfiles = {
    verified: {
      label: 'Verified Academic Profile (Normal Delta)',
      transcript: {
        previousGPA: 8.4,
        recentSemesterGPA: 8.7,
        totalCreditsEarned: 160,
        requiredCredits: 160,
        completedCourses: ['CS101', 'CS201', 'CS301', 'CS401', 'CS405', 'MATH201']
      }
    },
    tampered_gpa: {
      label: 'Anomalous Velocity Profile (+4.8 CGPA Jump)',
      transcript: {
        previousGPA: 5.1,
        recentSemesterGPA: 9.9,
        totalCreditsEarned: 160,
        requiredCredits: 160,
        completedCourses: ['CS101', 'CS201', 'CS301']
      }
    },
    prereq_violation: {
      label: 'Curriculum Violation Profile (Missing Prereqs)',
      transcript: {
        previousGPA: 7.2,
        recentSemesterGPA: 7.5,
        totalCreditsEarned: 135,
        requiredCredits: 160,
        completedCourses: ['CS401', 'CS405'] // missing CS201 and CS301
      }
    }
  };

  useEffect(() => {
    if (trackedRequest?.requestId) {
      setCertId(`CERT-${trackedRequest.requestId.replace('REQ-', '')}`);
    }
  }, [trackedRequest]);

  // Run automated Sentinel preflight audit whenever trackedRequest or activeProfile changes
  useEffect(() => {
    if (trackedRequest?.studentId) {
      runSentinelPreflight(activeProfile);
    }
  }, [trackedRequest?.studentId, trackedRequest?.requestId, activeProfile]);

  const runSentinelPreflight = async (profileKey) => {
    setAuditLoading(true);
    try {
      const selected = auditProfiles[profileKey] || auditProfiles.verified;
      const res = await fetch(`${API_BASE}/fraud/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: trackedRequest?.studentId || 'STU-AUDIT',
          requestId: trackedRequest?.requestId || 'REQ-AUDIT',
          transcript: selected.transcript
        })
      });
      const data = await res.json();
      if (data.success && data.inspection) {
        setGatekeeperAudit(data.inspection);
      }
    } catch (err) {
      console.warn('Sentinel preflight audit check failed:', err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!certId) {
      alert('Please enter a Certificate ID.');
      return;
    }

    if (!trackedRequest || (trackedRequest.status !== 'ADMIN_FINALIZED' && trackedRequest.status !== 'CERTIFICATE_ISSUED')) {
      alert('Certificate issuance requires an ADMIN_FINALIZED request.');
      return;
    }

    // Client-side barrier check
    if (gatekeeperAudit?.shouldQuarantine) {
      alert('Action Blocked: Cannot issue certificate while AI Fraud Sentinel quarantine is active.');
      return;
    }

    setIssuing(true);
    setError(null);
    try {
      const selectedProfile = auditProfiles[activeProfile] || auditProfiles.verified;
      const res = await fetch(`${API_BASE}/certificates/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certId,
          requestId: trackedRequest.requestId,
          studentId: trackedRequest.studentId,
          certType: trackedRequest.certType,
          studentName: trackedRequest.details?.name || 'Academic Student',
          department: trackedRequest.details?.department || 'Computer Science & Engineering',
          transcript: selectedProfile.transcript
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIssueResult(data);
        if (onCertificateIssued) onCertificateIssued(data);
      } else {
        setError(data.error || 'Issuance failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIssuing(false);
    }
  };

  const isQuarantined = gatekeeperAudit?.shouldQuarantine === true;

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-title">
        <h3>3. AI Sentinel Gatekeeper → PDF Generation → IPFS Upload → Fabric Anchoring</h3>
        <span className="step-num">Module 3 & 4</span>
      </div>
      <p className="subtitle">
        Once a request reaches <code>ADMIN_FINALIZED</code>, the <strong>Autonomous Fraud Sentinel Gatekeeper</strong> audits the academic records and ledger invariants. Only records that pass risk scoring are cleared for IPFS pinning and Hyperledger Fabric anchoring.
      </p>

      {/* Inline AI Fraud Sentinel Gatekeeper Component */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1.25rem',
        borderRadius: '10px',
        background: isQuarantined ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
        border: `1px solid ${isQuarantined ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="#38bdf8" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
              Inline Sentinel Gatekeeper Pre-Flight Check:
            </span>
          </div>

          {/* Test Profile Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>AUDIT PROFILE:</span>
            <select
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
              value={activeProfile}
              onChange={(e) => setActiveProfile(e.target.value)}
            >
              <option value="verified">🟢 Verified Academic Record (Standard)</option>
              <option value="tampered_gpa">🔴 Anomalous Grade Velocity (+4.8 CGPA)</option>
              <option value="prereq_violation">🛑 Curriculum Violation (Missing Prereqs)</option>
            </select>
          </div>
        </div>

        {/* Audit Status Display */}
        {auditLoading ? (
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', padding: '6px 0' }}>
            AI Sentinel Agent auditing student record invariants...
          </div>
        ) : gatekeeperAudit ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isQuarantined ? (
                  <ShieldAlert size={22} color="#ef4444" />
                ) : (
                  <ShieldCheck size={22} color="#10b981" />
                )}
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: isQuarantined ? '#ef4444' : '#10b981' }}>
                  {isQuarantined ? 'QUARANTINE ACTIVE — ISSUANCE INTERCEPTED' : 'SENTINEL CLEARED — RECORD PASSED INTEGRITY AUDIT'}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isQuarantined ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                  color: isQuarantined ? '#fca5a5' : '#6ee7b7',
                  fontWeight: 700
                }}>
                  Risk Score: {gatekeeperAudit.riskScore} / 100 [{gatekeeperAudit.riskLevel}]
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '6px' }}>
              {gatekeeperAudit.recommendation}
            </div>

            {gatekeeperAudit.flags && gatekeeperAudit.flags.length > 0 && (
              <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, marginBottom: '4px' }}>
                  SECURITY VIOLATIONS DETECTED:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: '#fca5a5' }}>
                  {gatekeeperAudit.flags.map((flag, idx) => (
                    <li key={idx}><strong>[{flag.severity}]</strong> {flag.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        <div>
          <div className="form-group">
            <label htmlFor="issueCertId">Assign Certificate ID:</label>
            <input 
              type="text" 
              id="issueCertId"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder="e.g. CERT-2024-001"
            />
          </div>

          <button 
            type="button" 
            className={`full-width ${isQuarantined ? 'btn-danger' : 'btn-success'}`}
            onClick={handleIssue}
            disabled={issuing || !trackedRequest || trackedRequest.status !== 'ADMIN_FINALIZED' || isQuarantined}
            style={{
              cursor: isQuarantined ? 'not-allowed' : 'pointer',
              opacity: isQuarantined ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isQuarantined ? (
              <>
                <Lock size={18} />
                <span>Blocked: Resolve Sentinel Quarantine</span>
              </>
            ) : issuing ? (
              <>
                <Award size={18} />
                <span>Generating & Anchoring...</span>
              </>
            ) : (
              <>
                <Award size={18} />
                <span>🚀 Issue Certificate & Anchor to Blockchain</span>
              </>
            )}
          </button>
        </div>

        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '1.25rem', border: '1px solid var(--border)' }}>
          {issueResult ? (
            <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem' }}>
              <h4 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={18} />
                🎉 Certificate Successfully Issued & Anchored!
              </h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>Certificate ID:</strong> <code>{issueResult.certId}</code></p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>IPFS Content CID:</strong> <code>{issueResult.ipfsCid}</code></p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>SHA-256 Digest:</strong> <code style={{ wordBreak: 'break-all' }}>{issueResult.sha256Hash}</code></p>
              {issueResult.sentinelAudit && (
                <p style={{ fontSize: '0.85rem', marginBottom: '0.85rem', color: '#38bdf8' }}>
                  <strong>🛡️ Sentinel Security Audit:</strong> Cleared (Risk Score: {issueResult.sentinelAudit.riskScore}/100)
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href={`${API_BASE}/certificates/${issueResult.certId}/pdf`} target="_blank" rel="noreferrer" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <FileText size={14} /> View Generated PDF
                </a>
                <a href={`http://localhost:8080/ipfs/${issueResult.ipfsCid}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                  <Globe size={14} /> View on IPFS Gateway
                </a>
              </div>
            </div>
          ) : error ? (
            <div style={{ color: '#ef4444', fontSize: '0.9rem', borderLeft: '3px solid #ef4444', paddingLeft: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>❌ Issuance Intercepted by Gatekeeper:</div>
              <div>{error}</div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Issued certificate details, IPFS CID, and cryptographic SHA-256 anchor will appear here once cleared by the Sentinel Gatekeeper.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
