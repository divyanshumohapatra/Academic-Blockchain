import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Award, FileText, Globe, CheckCircle2, KeyRound } from 'lucide-react';

export default function IssuanceModule({ trackedRequest, onCertificateIssued }) {
  const { API_BASE } = useNetwork();
  const [certId, setCertId] = useState('CERT-2024-001');
  const [issuing, setIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (trackedRequest?.requestId) {
      setCertId(`CERT-${trackedRequest.requestId.replace('REQ-', '')}`);
    }
  }, [trackedRequest]);

  const handleIssue = async () => {
    if (!certId) {
      alert('Please enter a Certificate ID.');
      return;
    }

    if (!trackedRequest || (trackedRequest.status !== 'ADMIN_FINALIZED' && trackedRequest.status !== 'CERTIFICATE_ISSUED')) {
      alert('Certificate issuance requires an ADMIN_FINALIZED request.');
      return;
    }

    setIssuing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/certificates/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certId,
          requestId: trackedRequest.requestId,
          studentId: trackedRequest.studentId,
          certType: trackedRequest.certType || 'Master of Computer Applications (MCA)',
          studentName: trackedRequest.details?.name || trackedRequest.studentName || '',
          department: trackedRequest.details?.department || 'Computer Science & Engineering'
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

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-title">
        <h3>3. PDF Generation → IPFS Upload → Verifiable SHA-256 → Fabric Anchoring</h3>
        <span className="step-num">Step 3</span>
      </div>
      <p className="subtitle">
        Once a request reaches <code>ADMIN_FINALIZED</code>, Org 3 generates the official certificate PDF with embedded Student DID and multi-sig endorsements, pins it to IPFS, computes the verifiable SHA-256 digest, and anchors it to the Hyperledger Fabric ledger.
      </p>

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
            className="btn-success full-width"
            onClick={handleIssue}
            disabled={issuing || !trackedRequest || trackedRequest.status !== 'ADMIN_FINALIZED'}
          >
            <Award size={18} />
            {issuing ? 'Generating & Anchoring...' : '🚀 Issue Certificate & Anchor to Blockchain'}
          </button>
        </div>

        <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '1.25rem', border: '1px solid var(--border)' }}>
          {issueResult ? (
            <div style={{ borderLeft: '4px solid var(--success)', paddingLeft: '1rem' }}>
              <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={18} />
                🎉 Certificate Successfully Issued & Anchored!
              </h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>Certificate ID:</strong> <code>{issueResult.certId}</code></p>
              {issueResult.studentDid && (
                <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>Student DID:</strong> <code>{issueResult.studentDid}</code></p>
              )}
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>IPFS Content CID:</strong> <code>{issueResult.ipfsCid}</code></p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.85rem' }}><strong>Verifiable SHA-256 Digest:</strong> <code style={{ wordBreak: 'break-all' }}>{issueResult.sha256Hash}</code></p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href={`${API_BASE}/certificates/${issueResult.certId}/pdf`} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                  <FileText size={14} /> View Official PDF
                </a>
                <a href={`http://localhost:8080/ipfs/${issueResult.ipfsCid}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                  <Globe size={14} /> View on IPFS Gateway
                </a>
              </div>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>❌ Issuance Error: {error}</div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Awaiting request finalization. Complete all Multi-Sig stages to unlock issuance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
