import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Award, FileText, Globe, CheckCircle2 } from 'lucide-react';

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
        <h3>3. PDF Generation → IPFS Upload → SHA-256 → Fabric Anchoring</h3>
        <span className="step-num">Module 3 & 4</span>
      </div>
      <p className="subtitle">
        Once a request reaches <code>ADMIN_FINALIZED</code>, Org 3 generates the official PDF, pins it to IPFS, computes the SHA-256 hash, and anchors the certificate on the Hyperledger Fabric ledger.
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

        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '1.25rem', border: '1px solid var(--border)' }}>
          {issueResult ? (
            <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem' }}>
              <h4 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={18} />
                🎉 Certificate Successfully Issued & Anchored!
              </h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>Certificate ID:</strong> <code>{issueResult.certId}</code></p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}><strong>IPFS Content CID:</strong> <code>{issueResult.ipfsCid}</code></p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.85rem' }}><strong>SHA-256 Digest:</strong> <code style={{ wordBreak: 'break-all' }}>{issueResult.sha256Hash}</code></p>
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
            <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>❌ Issuance Error: {error}</div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
              Issued certificate details, IPFS CID, and cryptographic SHA-256 anchor will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
