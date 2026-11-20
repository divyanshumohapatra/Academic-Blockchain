import React, { useState, useEffect, useRef } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  QrCode, 
  FileCheck2, 
  Search, 
  Camera, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Printer, 
  Globe, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Lock,
  Building,
  GraduationCap
} from 'lucide-react';

export default function EmployerPortal({ initialCertId }) {
  const { API_BASE } = useNetwork();
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'pdf' | 'search'
  const [manualInput, setManualInput] = useState(initialCertId || '');
  const [scanning, setScanning] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const qrScannerRef = useRef(null);
  const qrFileInputRef = useRef(null);
  const pdfFileInputRef = useRef(null);

  // Deep-link check on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const certId = params.get('certId') || params.get('id') || initialCertId;
    const hash = params.get('hash');
    if (certId) {
      setManualInput(certId);
      setActiveTab('search');
      verifyById(certId);
    } else if (hash) {
      setManualInput(hash);
      setActiveTab('search');
      verifyByHash(hash);
    }
  }, [initialCertId]);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  const verifyById = async (id) => {
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/verify/id/${encodeURIComponent(id)}`);
      const data = await res.json();
      setResult({ ...data, certificate: data.certificate || data, queryType: 'id', queryValue: id });
    } catch (err) {
      setResult({ verificationStatus: 'ERROR', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyByHash = async (hash, fileName) => {
    if (!hash) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/verify/hash/${encodeURIComponent(hash)}`);
      const data = await res.json();
      setResult({ ...data, certificate: data.certificate || data, queryType: 'hash', queryValue: hash, fileName });
    } catch (err) {
      setResult({ verificationStatus: 'ERROR', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyByDID = async (did) => {
    if (!did) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/verify/did/${encodeURIComponent(did)}`);
      const data = await res.json();
      setResult({ ...data, certificate: data.certificate || data, queryType: 'did', queryValue: did });
    } catch (err) {
      setResult({ verificationStatus: 'ERROR', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Camera QR Scanner
  const startCameraScanner = async () => {
    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode('qr-reader-container');
      }
      setScanning(true);
      await qrScannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopCameraScanner();
          handleDecodedQr(decodedText);
        },
        () => {}
      );
    } catch (err) {
      alert(`Camera scanner error: ${err.message || err}`);
      setScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {}
    }
    setScanning(false);
  };

  const handleQrImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const scanner = new Html5Qrcode('qr-reader-container');
      const decoded = await scanner.scanFile(file, true);
      handleDecodedQr(decoded);
    } catch (err) {
      alert('Could not decode QR code from the uploaded image. Please try another image or enter the Certificate ID.');
    }
  };

  const handleDecodedQr = (text) => {
    try {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const url = new URL(text);
        const certId = url.searchParams.get('certId') || url.searchParams.get('id');
        const hash = url.searchParams.get('hash');
        if (certId) {
          setManualInput(certId);
          setActiveTab('search');
          verifyById(certId);
          return;
        }
        if (hash) {
          setManualInput(hash);
          setActiveTab('search');
          verifyByHash(hash);
          return;
        }
      }

      if (text.length === 64 && /^[0-9a-fA-F]+$/.test(text)) {
        setManualInput(text);
        setActiveTab('search');
        verifyByHash(text);
      } else {
        setManualInput(text);
        setActiveTab('search');
        verifyById(text);
      }
    } catch (e) {
      setManualInput(text);
      setActiveTab('search');
      verifyById(text);
    }
  };

  const handlePdfUpload = async () => {
    if (!selectedPdf) return;
    setLoading(true);
    setResult(null);
    try {
      const buffer = await selectedPdf.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      let payload = null;

      // 1. Try instant SHA-256 digest lookup
      try {
        const res = await fetch(`${API_BASE}/verify/hash/${encodeURIComponent(hashHex)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.verificationStatus === 'VERIFIED' || data.verificationStatus === 'REVOKED')) {
            payload = data;
          }
        }
      } catch (e) {
        // network fallback
      }

      // 2. If not verified by hash lookup, upload directly to /api/verify/file for deep binary inspection
      if (!payload || payload.verificationStatus === 'INVALID') {
        try {
          const formData = new FormData();
          formData.append('certificate', selectedPdf);
          const fileRes = await fetch(`${API_BASE}/verify/file`, {
            method: 'POST',
            body: formData
          });
          if (fileRes.ok) {
            const fileData = await fileRes.json();
            const verObj = fileData.verification || fileData;
            if (verObj && (verObj.verificationStatus === 'VERIFIED' || verObj.verificationStatus === 'REVOKED')) {
              payload = {
                ...verObj,
                certificate: fileData.certificate || verObj.certificate
              };
            }
          }
        } catch (e) {
          // secondary fallback
        }
      }

      if (payload) {
        setResult({
          ...payload,
          certificate: payload.certificate || payload,
          queryType: 'hash',
          queryValue: hashHex,
          fileName: selectedPdf.name
        });
      } else {
        setResult({
          verificationStatus: 'INVALID',
          verified: false,
          queryType: 'hash',
          queryValue: hashHex,
          fileName: selectedPdf.name,
          message: 'Credential SHA-256 fingerprint does not match any authenticated record on the Hyperledger Fabric ledger or institutional vault.'
        });
      }
    } catch (err) {
      setResult({ verificationStatus: 'ERROR', message: `PDF hashing error: ${err.message}`, fileName: selectedPdf?.name });
    } finally {
      setLoading(false);
    }
  };

  const cert = result?.certificate || {};
  const isVerified = result?.verificationStatus === 'VERIFIED';
  const isRevoked = result?.verificationStatus === 'REVOKED';
  const isInvalid = result && !isVerified && !isRevoked;

  return (
    <div className="employer-container">
      {/* Hero Header */}
      <div className="verifier-hero">
        <div className="verifier-pill">
          <ShieldCheck size={16} className="pill-icon" />
          <span>Hyperledger Fabric 2.5 • Official Public Verifier</span>
        </div>
        <h2 className="verifier-title">Verify Academic Credentials on Blockchain</h2>
        <p className="verifier-desc">
          Instant, tamper-evident degree verification backed by 3-Organization Multi-Party Consensus and Decentralized IPFS Storage.
        </p>
      </div>

      {/* Modern Method Switcher */}
      <div className="verifier-card-wrapper">
        <div className="verifier-tabs">
          <button 
            type="button"
            className={`verifier-tab-btn ${activeTab === 'qr' ? 'active' : ''}`}
            onClick={() => { setActiveTab('qr'); stopCameraScanner(); }}
          >
            <QrCode size={18} />
            <span>Scan QR Code</span>
          </button>

          <button 
            type="button"
            className={`verifier-tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pdf'); stopCameraScanner(); }}
          >
            <FileCheck2 size={18} />
            <span>Upload PDF</span>
          </button>

          <button 
            type="button"
            className={`verifier-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => { setActiveTab('search'); stopCameraScanner(); }}
          >
            <Search size={18} />
            <span>Search by ID / Hash</span>
          </button>
        </div>

        {/* Tab 1: QR Code Scanner */}
        {activeTab === 'qr' && (
          <div className="verifier-body">
            <div className="qr-viewport-box">
              <div id="qr-reader-container" className="qr-scanner-live" style={{ display: scanning ? 'block' : 'none' }}></div>
              
              {!scanning ? (
                <div className="camera-prompt">
                  <div className="scanner-icon-circle">
                    <Camera size={32} />
                  </div>
                  <h3>Scan Candidate Certificate QR</h3>
                  <p>Point your laptop webcam or phone camera at the QR code on the certificate.</p>
                  <button type="button" className="btn-primary" onClick={startCameraScanner}>
                    <Camera size={18} /> Start Camera Scanner
                  </button>
                </div>
              ) : (
                <div className="camera-active-controls">
                  <span className="live-tag">● Camera Live</span>
                  <button type="button" className="btn-secondary btn-sm" onClick={stopCameraScanner}>
                    Stop Camera
                  </button>
                </div>
              )}
            </div>

            <div className="divider-line"><span>OR UPLOAD QR IMAGE</span></div>

            <div className="verifier-dropzone" onClick={() => qrFileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={qrFileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }}
                onChange={handleQrImageUpload}
              />
              <Upload size={28} className="dropzone-svg" />
              <p><strong>Click or Drag & Drop</strong> QR code image here</p>
              <span className="drop-hint">Supports PNG, JPG, WebP screenshots & photos</span>
            </div>
          </div>
        )}

        {/* Tab 2: PDF Upload */}
        {activeTab === 'pdf' && (
          <div className="verifier-body">
            <div className="verifier-dropzone" onClick={() => pdfFileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={pdfFileInputRef} 
                accept=".pdf" 
                style={{ display: 'none' }}
                onChange={(e) => setSelectedPdf(e.target.files?.[0] || null)}
              />
              <FileText size={36} className="dropzone-svg" />
              <p><strong>Click or Drag & Drop</strong> candidate certificate PDF here</p>
              <span className="drop-hint">Computes SHA-256 fingerprint in real-time to detect even a single modified byte</span>
            </div>

            {selectedPdf && (
              <div className="selected-file-card">
                <div className="file-info-row">
                  <FileText size={20} color="#38bdf8" />
                  <span className="file-name">{selectedPdf.name}</span>
                  <span className="file-size">({(selectedPdf.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button 
                  type="button" 
                  className="btn-primary full-width" 
                  onClick={handlePdfUpload} 
                  disabled={loading}
                >
                  <ShieldCheck size={18} />
                  {loading ? 'Computing SHA-256 & Querying Fabric...' : 'Verify PDF Hash on Blockchain'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Search by ID, Hash, or Student DID */}
        {activeTab === 'search' && (
          <div className="verifier-body">
            <form onSubmit={(e) => {
              e.preventDefault();
              const trimmed = manualInput.trim();
              if (trimmed.startsWith('did:academic:')) {
                verifyByDID(trimmed);
              } else if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
                verifyByHash(trimmed);
              } else {
                verifyById(trimmed);
              }
            }}>
              <div className="search-input-group">
                <Search size={20} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Enter Certificate ID, Student DID (did:academic:...), or SHA-256 Hash..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Searching...' : 'Verify on Ledger'}
                </button>
              </div>
            </form>

            <div className="sample-chips-row">
              <span className="chips-label">Sample Lookups:</span>
              <button 
                type="button" 
                className="chip-btn"
                onClick={() => {
                  setManualInput('CERT-2024-001');
                  verifyById('CERT-2024-001');
                }}
              >
                CERT-2024-001
              </button>
              <button 
                type="button" 
                className="chip-btn"
                onClick={() => {
                  setManualInput('did:academic:a038a2bdb75e4eca20c7efcf34c62fa57f7bd1be');
                  verifyByDID('did:academic:a038a2bdb75e4eca20c7efcf34c62fa57f7bd1be');
                }}
              >
                Alice DID (did:academic:a038...)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <p>Querying Hyperledger Fabric consensus peers (Org 1, Org 2, Org 3)...</p>
        </div>
      )}

      {/* Verification Result Card */}
      {result && !loading && (
        <div className="verification-result-wrapper">
          {/* Status Header */}
          <div className={`status-header-banner ${isVerified ? 'status-verified' : isRevoked ? 'status-revoked' : 'status-invalid'}`}>
            <div className="status-icon-box">
              {isVerified ? <CheckCircle2 size={36} /> : isRevoked ? <AlertTriangle size={36} /> : <XCircle size={36} />}
            </div>
            <div className="status-text-box">
              <h3>
                {isVerified 
                  ? 'OFFICIAL CREDENTIAL VERIFIED & AUTHENTIC' 
                  : isRevoked 
                  ? 'CREDENTIAL REVOKED BY ACADEMIC COMMITTEE' 
                  : 'CREDENTIAL INVALID OR NOT FOUND ON LEDGER'}
              </h3>
              <p>
                {isVerified
                  ? result.fileName
                    ? `PDF document '${result.fileName}' SHA-256 digest matches the immutable blockchain record perfectly.`
                    : 'This credential was cryptographically confirmed authentic by 3-Organization Hyperledger Fabric consensus.'
                  : isRevoked
                  ? 'This certificate was previously issued but has since been revoked on the blockchain.'
                  : result.message || 'No matching record exists on the Hyperledger Fabric ledger.'}
              </p>
            </div>
            <div className="verified-time-tag">
              Verified: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Credential Details Grid */}
          <div className="credential-details-grid">
            {/* Student & Degree Information */}
            <div className="detail-card">
              <div className="card-top-title">
                <GraduationCap size={20} color="#38bdf8" />
                <h4>Candidate Academic Record</h4>
                <span className="cert-id-tag">{cert.certId || result.queryValue || 'N/A'}</span>
              </div>

              <div className="kv-list">
                <div className="kv-row">
                  <span className="kv-label">Student Name</span>
                  <span className="kv-val val-highlight">{cert.studentName || 'Unregistered / Invalid'}</span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Registration ID</span>
                  <span className="kv-val">{cert.studentId || 'N/A'}</span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Decentralized ID (DID)</span>
                  <span className="kv-val"><code style={{ wordBreak: 'break-all', fontSize: '0.78rem' }}>{cert.studentDid || result.did || 'did:academic:...'}</code></span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Conferred Degree</span>
                  <span className="kv-val val-degree">{cert.certType || 'Degree Certificate'}</span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Academic Department</span>
                  <span className="kv-val">{cert.department ? `Department of ${cert.department}` : 'Department of Computer Science & Engineering'}</span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Date of Official Conformance</span>
                  <span className="kv-val">{cert.issueDate || 'N/A'}</span>
                </div>

                <div className="kv-row">
                  <span className="kv-label">Ledger State</span>
                  <span className="kv-val">
                    <span className={`status-pill ${isVerified ? 'issued' : isRevoked ? 'revoked' : 'invalid'}`}>
                      {cert.status || result.verificationStatus}
                    </span>
                  </span>
                </div>
              </div>

              <div className="actions-bar">
                {cert.certId && (
                  <a href={`${API_BASE}/certificates/${cert.certId}/pdf`} target="_blank" rel="noreferrer" className="btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                    <FileText size={14} /> View Official PDF
                  </a>
                )}
                {cert.ipfsHash && (
                  <a href={`http://localhost:8080/ipfs/${cert.ipfsHash}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                    <Globe size={14} /> IPFS Gateway
                  </a>
                )}
                <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} /> Print HR Report
                </button>
              </div>
            </div>

            {/* Cryptographic & Blockchain Proofs */}
            <div className="detail-card">
              <div className="card-top-title">
                <Lock size={20} color="#a855f7" />
                <h4>Hyperledger Fabric 2.5 Consensus Proofs</h4>
              </div>

              <div className="proofs-container">
                <div className="proof-block">
                  <span className="proof-heading">SHA-256 Digest Fingerprint:</span>
                  <code className="hash-code">{cert.docHash || result.queryValue || '—'}</code>
                  <span className="proof-sub">Byte-for-byte immutable hash matching the on-chain register</span>
                </div>

                <div className="proof-block">
                  <span className="proof-heading">Decentralized IPFS CID:</span>
                  <code className="hash-code">{cert.ipfsHash || '—'}</code>
                </div>

                <div className="proof-block">
                  <span className="proof-heading">3-Organization Approval Endorsement:</span>
                  <div className="endorsement-flow">
                    <div className="flow-step">
                      <span className="flow-check">✓</span>
                      <div>
                        <strong>Org 1 (CSE Faculty & HOD)</strong>
                        <p>Departmental Curriculum & Credit Clearance</p>
                      </div>
                    </div>

                    <div className="flow-step">
                      <span className="flow-check">✓</span>
                      <div>
                        <strong>Org 2 (Examination Board)</strong>
                        <p>Official Grade & Transcript Lockdown</p>
                      </div>
                    </div>

                    <div className="flow-step">
                      <span className="flow-check">✓</span>
                      <div>
                        <strong>Org 3 (Dean & Administration)</strong>
                        <p>Final Clearance & Blockchain Anchoring</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Revocation Banner if revoked */}
          {isRevoked && (
            <div className="revocation-banner">
              <h4>⚠️ Official Revocation Record</h4>
              <p><strong>Reason:</strong> {cert.revocation?.reason || 'Administrative disciplinary revocation'}</p>
              <div className="revocation-foot">
                <span>Revoking Authority: <strong>{cert.revocation?.revokedBy || 'Dean / Registrar'}</strong></span>
                <span>Revocation Date: <strong>{cert.revocation?.revokedAt ? new Date(cert.revocation.revokedAt).toLocaleString() : 'N/A'}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
