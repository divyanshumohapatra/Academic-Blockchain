import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { RefreshCw, FileText, Globe } from 'lucide-react';

export default function LedgerExplorer() {
  const { API_BASE } = useNetwork();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/certificates`);
      const data = await res.json();
      setCerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  return (
    <div className="card">
      <div className="card-title">
        <h3>Immutable Ledger Certificates</h3>
        <button className="btn-secondary btn-sm" onClick={fetchCerts}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Ledger
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Cert ID</th>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Degree Title</th>
              <th>Status</th>
              <th>IPFS CID</th>
              <th>SHA-256 Digest</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="empty-hint">Querying ledger records...</td></tr>
            ) : certs.length === 0 ? (
              <tr><td colSpan="8" className="empty-hint">No certificates on ledger yet.</td></tr>
            ) : (
              certs.map((c) => (
                <tr key={c.certId}>
                  <td><code>{c.certId}</code></td>
                  <td><code>{c.studentId}</code></td>
                  <td><strong>{c.studentName || 'Student'}</strong></td>
                  <td>{c.certType}</td>
                  <td>
                    <span className={`status-pill ${c.status === 'ISSUED' ? 'issued' : 'revoked'}`}>
                      {c.status || 'ISSUED'}
                    </span>
                  </td>
                  <td>
                    {c.ipfsHash ? (
                      <a href={`http://localhost:8080/ipfs/${c.ipfsHash}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>
                        {c.ipfsHash.substring(0, 10)}...
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>
                      {c.docHash ? `${c.docHash.substring(0, 14)}...` : '—'}
                    </code>
                  </td>
                  <td>
                    <a href={`${API_BASE}/certificates/${c.certId}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FileText size={12} /> View PDF
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
