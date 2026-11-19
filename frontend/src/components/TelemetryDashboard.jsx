import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  ShieldCheck, 
  Zap, 
  Layers
} from 'lucide-react';

export default function TelemetryDashboard() {
  const { API_BASE } = useNetwork();
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/agent/health/telemetry`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setTelemetry(data);
    } catch (err) {
      console.error('Telemetry probe failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, [API_BASE]);

  const summary = telemetry?.summary || {};
  const parity = telemetry?.syncParity || {};
  const nodes = telemetry?.nodes || [];
  const advice = telemetry?.selfHealingAdvice || [];

  return (
    <div className="card full-width-card" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #e6dfd5)' }}>
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--heading, #0f172a)' }}>
            <Activity size={20} color="#059669" />
            Autonomous Consortium Health & Consensus Telemetry
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', margin: '0.25rem 0 0 0' }}>
            Contributor 6.2 Deliverable: gRPC Port Probing, Cross-Peer Sync Parity & Self-Healing Sentinel
          </p>
        </div>
        <button 
          className="btn-primary btn-sm" 
          onClick={fetchTelemetry} 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Probing...' : 'Run Live Diagnostic Probe'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg, #fef2f2)', border: '1px solid var(--danger-border, #fecaca)', color: 'var(--danger, #dc2626)', padding: '0.75rem', borderRadius: '6px', margin: '1rem 0' }}>
          <strong>Sentinel Probe Error:</strong> {error}
        </div>
      )}

      {/* Top Telemetry KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginTop: '1.25rem'
      }}>
        <div style={{ background: 'var(--bg-subtle, #f5f1ea)', border: '1px solid var(--border, #e6dfd5)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>System Health</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: telemetry?.status === 'OPTIMAL' ? '#059669' : '#d97706', fontFamily: 'monospace' }}>
            {telemetry?.status || 'PROBING...'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{summary.healthyContainers || '0/9'} Containers Active</span>
        </div>

        <div style={{ background: 'var(--bg-subtle, #f5f1ea)', border: '1px solid var(--border, #e6dfd5)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Consensus Protocol</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>etcdraft</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Raft Crash Fault-Tolerant</span>
        </div>

        <div style={{ background: 'var(--bg-subtle, #f5f1ea)', border: '1px solid var(--border, #e6dfd5)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Ledger Block Height</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'monospace' }}>
            {summary.blockHeight !== undefined ? `#${summary.blockHeight}` : '--'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Channel: academicchannel</span>
        </div>

        <div style={{ background: 'var(--bg-subtle, #f5f1ea)', border: '1px solid var(--border, #e6dfd5)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Cross-Peer Sync Parity</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: summary.inSync ? '#059669' : '#dc2626', fontFamily: 'monospace' }}>
            {summary.inSync ? '100% IN SYNC' : 'DRIFT DETECTED'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Zero block drift across 3 Orgs</span>
        </div>

        <div style={{ background: 'var(--bg-subtle, #f5f1ea)', border: '1px solid var(--border, #e6dfd5)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>Probe Latency</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--heading, #0f172a)', fontFamily: 'monospace' }}>
            {summary.diagnosticLatencyMs !== undefined ? `${summary.diagnosticLatencyMs} ms` : '--'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Real-time Sentinel Response</span>
        </div>
      </div>

      {/* Section 1: Cross-Peer Block Height Parity Table */}
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--heading, #0f172a)', marginBottom: '0.75rem' }}>
          <ShieldCheck size={18} color="#0284c7" />
          Cross-Peer Block Height Synchronization Parity (Fabric Ledger)
        </h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Peer Address & Port</th>
                <th>Membership (MSP)</th>
                <th>Block Height</th>
                <th>Current Block Hash</th>
                <th>Parity Drift</th>
                <th>Sync Status</th>
              </tr>
            </thead>
            <tbody>
              {parity.peers && parity.peers.length > 0 ? (
                parity.peers.map((p, idx) => (
                  <tr key={idx}>
                    <td><strong>{p.org}</strong></td>
                    <td><code>{p.peer}:{p.port}</code></td>
                    <td><code>{p.msp}</code></td>
                    <td><span style={{ fontWeight: 700, color: '#0284c7' }}>#{p.height !== null ? p.height : 'N/A'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      {p.currentBlockHash || 'N/A'}
                    </td>
                    <td>
                      <span style={{ color: p.parityDrift === 0 ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {p.parityDrift === 0 ? '0 blocks (0.00%)' : `+${p.parityDrift} blocks`}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: p.syncStatus === 'SYNCHRONIZED' ? 'var(--success-bg, #ecfdf5)' : 'var(--danger-bg, #fef2f2)',
                        color: p.syncStatus === 'SYNCHRONIZED' ? 'var(--success, #059669)' : 'var(--danger, #dc2626)',
                        border: `1px solid ${p.syncStatus === 'SYNCHRONIZED' ? 'var(--success-border, #a7f3d0)' : 'var(--danger-border, #fecaca)'}`,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {p.syncStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="empty-hint">Loading peer parity telemetry...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Infrastructure & Container Health */}
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--heading, #0f172a)', marginBottom: '0.75rem' }}>
          <Server size={18} color="#7c3aed" />
          Consortium Infrastructure Nodes & Container Health
        </h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Container Name</th>
                <th>Consortium Role</th>
                <th>Network Port</th>
                <th>Status</th>
                <th>Container Uptime Detail</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length > 0 ? (
                nodes.map((n, idx) => (
                  <tr key={idx}>
                    <td><code>{n.name}</code></td>
                    <td>{n.role}</td>
                    <td><code>{n.port ? `${n.port}` : 'Internal'}</code></td>
                    <td>
                      <span style={{
                        background: n.status === 'HEALTHY' ? 'var(--success-bg, #ecfdf5)' : 'var(--danger-bg, #fef2f2)',
                        color: n.status === 'HEALTHY' ? 'var(--success, #059669)' : 'var(--danger, #dc2626)',
                        border: `1px solid ${n.status === 'HEALTHY' ? 'var(--success-border, #a7f3d0)' : 'var(--danger-border, #fecaca)'}`,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {n.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>{n.detail}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="empty-hint">Probing consortium infrastructure...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Autonomous Sentinel & Self-Healing Advice */}
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--heading, #0f172a)', marginBottom: '0.75rem' }}>
          <Zap size={18} color="#d97706" />
          Autonomous Sentinel: Self-Healing & Remediation Advice
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {advice.map((adv, idx) => {
            const isOptimal = adv.severity === 'OPTIMAL';
            const color = isOptimal ? '#059669' : (adv.severity === 'HIGH' ? '#d97706' : '#dc2626');
            const bg = isOptimal ? 'var(--success-bg, #ecfdf5)' : 'var(--warning-bg, #fffbeb)';
            const border = isOptimal ? 'var(--success-border, #a7f3d0)' : 'var(--warning-border, #fde68a)';

            return (
              <div 
                key={idx} 
                style={{
                  borderLeft: `4px solid ${color}`,
                  background: bg,
                  border: `1px solid ${border}`,
                  borderLeftWidth: '4px',
                  borderLeftColor: color,
                  padding: '1rem',
                  borderRadius: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {adv.severity}
                  </span>
                  <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.8rem' }}>Component: <code>{adv.component}</code></span>
                </div>
                <div style={{ color: 'var(--heading, #0f172a)', fontWeight: 600, margin: '0.4rem 0' }}>{adv.issue}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text, #1c1917)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                  💡 {adv.action}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
