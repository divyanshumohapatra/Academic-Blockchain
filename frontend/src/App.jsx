import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ConsortiumBar from './components/ConsortiumBar';
import StudentModule from './components/StudentModule';
import WorkflowModule from './components/WorkflowModule';
import IssuanceModule from './components/IssuanceModule';
import EmployerPortal from './components/EmployerPortal';
import RevocationModule from './components/RevocationModule';
import LedgerExplorer from './components/LedgerExplorer';
import AgenticModule from './components/AgenticModule';
import { 
  ClipboardList, 
  UserCheck, 
  Search, 
  ShieldAlert, 
  Database,
  Building2,
  Bot
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('consortium'); // 'consortium' | 'employer'
  const [activeTab, setActiveTab] = useState('workflow'); // 'workflow', 'students', 'verify', 'revoke', 'ledger'
  const [activeRequestId, setActiveRequestId] = useState('REQ-2024-001');
  const [readyRequest, setReadyRequest] = useState(null);

  useEffect(() => {
    // Check if user landed on /verify or has verify query params
    if (window.location.pathname.includes('verify') || window.location.search.includes('certId')) {
      setCurrentView('employer');
    }
  }, []);

  return (
    <div className="app-container">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="main-content">
        {currentView === 'employer' ? (
          <EmployerPortal />
        ) : (
          <>
            <ConsortiumBar />

            {/* Consortium Navigation Tabs */}
            <nav className="tabs-nav">
              <button 
                className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
                onClick={() => setActiveTab('workflow')}
              >
                <ClipboardList size={16} />
                Lifecycle & Workflow
              </button>

              <button 
                className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
                onClick={() => setActiveTab('agents')}
                style={{
                  background: activeTab === 'agents' ? 'linear-gradient(135deg, #4f46e5, #0284c7)' : 'rgba(79, 70, 229, 0.12)',
                  borderColor: '#6366f1',
                  color: '#fff',
                  fontWeight: '600'
                }}
              >
                <Bot size={16} />
                🤖 Autonomous Agentic Engine
              </button>

              <button 
                className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <UserCheck size={16} />
                Student Registration
              </button>

              <button 
                className={`tab-btn ${activeTab === 'revoke' ? 'active' : ''}`}
                onClick={() => setActiveTab('revoke')}
              >
                <ShieldAlert size={16} />
                Revocation
              </button>

              <button 
                className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
              >
                <Database size={16} />
                Ledger Explorer
              </button>
            </nav>

            {/* Tab Contents */}
            {activeTab === 'workflow' && (
              <>
                <WorkflowModule 
                  activeRequestId={activeRequestId}
                  setActiveRequestId={setActiveRequestId}
                  onReadyToIssue={(req) => setReadyRequest(req)}
                  onSwitchToAgents={() => setActiveTab('agents')}
                />
                <IssuanceModule 
                  trackedRequest={readyRequest}
                  onCertificateIssued={() => setActiveTab('ledger')}
                />
              </>
            )}

            {activeTab === 'agents' && (
              <AgenticModule 
                activeRequestId={activeRequestId}
                setActiveRequestId={setActiveRequestId}
                onGoToLedger={() => setActiveTab('ledger')}
              />
            )}

            {activeTab === 'students' && <StudentModule />}

            {activeTab === 'revoke' && (
              <RevocationModule onRevoked={() => setActiveTab('ledger')} />
            )}

            {activeTab === 'ledger' && <LedgerExplorer />}
          </>
        )}
      </main>

      <footer className="footer">
        <p>Academic Blockchain Consortium • Hyperledger Fabric 2.5 Multi-Org Network (Org1, Org2, Org3) • Autonomous Multi-Agent AI</p>
      </footer>
    </div>
  );
}
