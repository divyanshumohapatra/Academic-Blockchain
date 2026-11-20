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
import FacultyPortal from './components/FacultyPortal';
import FacultyAdvisorModule from './components/FacultyAdvisorModule';
import ChatbotPortal from './components/ChatbotPortal';
import ChatbotWidget from './components/ChatbotWidget';
import TelemetryDashboard from './components/TelemetryDashboard';
import ZKPassportSuite from './components/ZKPassportSuite';
import { 
  ClipboardList, 
  UserCheck, 
  Search, 
  ShieldAlert, 
  Database,
  Building2,
  Bot,
  GraduationCap,
  Users,
  MessageSquare,
  Activity,
  ShieldCheck
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('consortium'); // 'consortium' | 'employer'
  const [activeTab, setActiveTab] = useState('workflow'); // 'workflow', 'faculty', 'advisor', 'agents', 'chatbot', 'students', 'revoke', 'ledger'
  const [activeRequestId, setActiveRequestId] = useState('REQ-2024-001');
  const [readyRequest, setReadyRequest] = useState(null);

  useEffect(() => {
    // Check if user landed on /verify or has verify query params
    if (window.location.pathname.includes('verify') || window.location.search.includes('certId') || window.location.search.includes('did')) {
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
                Lifecycle & Multi-Sig
              </button>

              {/* Group 1 Feature Tab - Positioned prominent at Tab 2 */}
              <button 
                className={`tab-btn ${activeTab === 'passport' ? 'active' : ''}`}
                onClick={() => setActiveTab('passport')}
                style={{
                  background: activeTab === 'passport' ? 'linear-gradient(135deg, #312e81, #7c3aed)' : 'rgba(124, 58, 237, 0.12)',
                  borderColor: 'rgba(124, 58, 237, 0.4)',
                  color: activeTab === 'passport' ? '#ffffff' : '#7c3aed',
                  fontWeight: '700',
                  boxShadow: activeTab === 'passport' ? '0 2px 8px rgba(124, 58, 237, 0.3)' : 'none'
                }}
              >
                <ShieldCheck size={16} />
                🛡️ Group 1: ZK-Passport & Privacy
              </button>

              <button 
                className={`tab-btn ${activeTab === 'faculty' ? 'active' : ''}`}
                onClick={() => setActiveTab('faculty')}
              >
                <GraduationCap size={16} />
                Faculty Grading & Auth
              </button>

              <button 
                className={`tab-btn ${activeTab === 'advisor' ? 'active' : ''}`}
                onClick={() => setActiveTab('advisor')}
              >
                <Users size={16} />
                Faculty Advisor Gate
              </button>

              <button 
                className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
                onClick={() => setActiveTab('agents')}
                style={{
                  background: activeTab === 'agents' ? 'var(--primary)' : 'rgba(30, 58, 138, 0.08)',
                  borderColor: 'var(--primary-border)',
                  color: activeTab === 'agents' ? '#ffffff' : 'var(--primary)',
                  fontWeight: '600'
                }}
              >
                <Bot size={16} />
                🤖 Autonomous Multi-Agent AI
              </button>

              {/* Chatbot Tab - Clean, No Group 5 mention */}
              <button 
                className={`tab-btn ${activeTab === 'chatbot' ? 'active' : ''}`}
                onClick={() => setActiveTab('chatbot')}
                style={{
                  background: activeTab === 'chatbot' ? 'linear-gradient(135deg, #4f46e5, #0284c7)' : 'rgba(79, 70, 229, 0.08)',
                  borderColor: 'rgba(79, 70, 229, 0.3)',
                  color: activeTab === 'chatbot' ? '#ffffff' : '#4f46e5',
                  fontWeight: '700'
                }}
              >
                <MessageSquare size={16} />
                Chatbot
              </button>

              <button 
                className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <UserCheck size={16} />
                Student Registration & DID
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

              <button 
                className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                <Activity size={16} />
                Health & Telemetry (6.2)
              </button>
            </nav>

            {/* Tab Contents */}
            {activeTab === 'workflow' && (
              <>
                {/* Group 1 Quick Access Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  marginBottom: '20px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 12px rgba(49, 46, 129, 0.25)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '26px' }}>🛡️</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#c7d2fe' }}>
                        Group 1 Suite: Cryptographic Academic Passport & ZK-Privacy
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9, color: '#e0e7ff' }}>
                        1.1 Academic Passport & QR • 1.2 ZK Range-Proof Engine • 1.3 Autonomous Verifier Agent
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('passport')}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#fff',
                      border: 'none',
                      padding: '9px 20px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      transition: 'transform 0.15s'
                    }}
                  >
                    Open Group 1 ZK-Passport Tab →
                  </button>
                </div>

                <WorkflowModule 
                  activeRequestId={activeRequestId}
                  setActiveRequestId={setActiveRequestId}
                  onReadyToIssue={(req) => setReadyRequest(req)}
                  onSwitchToAgents={() => setActiveTab('agents')}
                />
                <IssuanceModule 
                  activeRequestId={activeRequestId}
                  setActiveRequestId={setActiveRequestId}
                  trackedRequest={readyRequest}
                  onCertificateIssued={() => setActiveTab('ledger')}
                />
              </>
            )}

            {activeTab === 'faculty' && <FacultyPortal />}

            {activeTab === 'advisor' && <FacultyAdvisorModule />}

            {activeTab === 'agents' && (
              <AgenticModule 
                activeRequestId={activeRequestId}
                setActiveRequestId={setActiveRequestId}
                onGoToLedger={() => setActiveTab('ledger')}
              />
            )}

            {/* Chatbot Tab with continuous state persistence across tab switches */}
            <div style={{ display: activeTab === 'chatbot' ? 'block' : 'none' }}>
              <ChatbotPortal />
            </div>

            {activeTab === 'students' && <StudentModule />}

            {activeTab === 'revoke' && (
              <RevocationModule onRevoked={() => setActiveTab('ledger')} />
            )}

            {activeTab === 'ledger' && <LedgerExplorer />}

            {activeTab === 'passport' && <ZKPassportSuite />}

            {activeTab === 'telemetry' && <TelemetryDashboard />}
          </>
        )}
      </main>

      {/* Floating Chatbot Widget Available Across All Modules */}
      <ChatbotWidget />

      <footer className="footer">
        <p>National Institute of Technology Warangal • Academic Blockchain Consortium • Hyperledger Fabric 2.5 (Org1, Org2, Org3) • IPFS Decentralized Storage • Autonomous Multi-Agent AI</p>
      </footer>
    </div>
  );
}
