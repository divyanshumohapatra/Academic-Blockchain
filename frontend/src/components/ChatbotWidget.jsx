import React, { useState, useRef, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { MessageSquare, X, Send, Bot, Sparkles, CornerDownLeft } from 'lucide-react';

export default function ChatbotWidget() {
  const { API_BASE } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '👋 Hello! I am your **Academic Blockchain AI Assistant**. You can ask me to verify certificates, inspect request IDs, check 3-Org consortium health, or trace on-chain audit history.'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendQuery = async (queryText) => {
    const textToSend = queryText || inputVal;
    if (!textToSend.trim()) return;

    const userMessage = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInputVal('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'bot', text: `⚠️ Error querying ledger: ${data.error}` }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: `❌ Network error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt) => {
    sendQuery(prompt);
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    // Format bold, code, and newlines for clean rendering
    const formatted = text
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; font-family: monospace; color: #38bdf8;">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="chatbot-container">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button 
          className="chatbot-toggle-btn"
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            padding: '0.75rem 1.3rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
            cursor: 'pointer'
          }}
        >
          <Bot size={20} />
          <span>Ledger AI Assistant</span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div 
          className="chatbot-modal"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '400px',
            maxWidth: '92vw',
            height: '540px',
            maxHeight: '82vh',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.2rem',
            background: '#0f172a',
            borderBottom: '1px solid #334155',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sparkles size={18} color="#38bdf8" />
              <strong style={{ fontSize: '0.95rem' }}>Academic Ledger AI Oracle</strong>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            fontSize: '0.85rem'
          }}>
            {messages.map((m, index) => (
              <div 
                key={index} 
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: m.sender === 'user' ? '#2563eb' : '#0f172a',
                  color: m.sender === 'user' ? '#fff' : '#e2e8f0',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '10px',
                  maxWidth: '85%',
                  lineHeight: '1.45',
                  border: m.sender === 'bot' ? '1px solid #334155' : 'none'
                }}
              >
                {renderMarkdown(m.text)}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                background: '#0f172a',
                color: '#94a3b8',
                padding: '0.5rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                border: '1px solid #334155'
              }}>
                🤖 <em>Querying Hyperledger Fabric ledger & agents...</em>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            padding: '0.5rem 0.8rem',
            background: '#0f172a',
            borderTop: '1px solid #334155',
            overflowX: 'auto'
          }}>
            <button 
              className="chip-btn"
              onClick={() => handleQuickPrompt('What is the network health status?')}
            >
              🌐 Network Health
            </button>
            <button 
              className="chip-btn"
              onClick={() => handleQuickPrompt('Show status of latest certificate request')}
            >
              📋 Latest Request
            </button>
            <button 
              className="chip-btn"
              onClick={() => handleQuickPrompt('How do the autonomous agents verify degrees?')}
            >
              🤖 Agent Details
            </button>
          </div>

          {/* Input Bar */}
          <form 
            onSubmit={(e) => { e.preventDefault(); sendQuery(); }}
            style={{
              display: 'flex',
              padding: '0.65rem',
              background: '#0f172a',
              borderTop: '1px solid #334155',
              gap: '0.5rem'
            }}
          >
            <input 
              type="text" 
              placeholder="Ask anything about certificates or the ledger..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !inputVal.trim()}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '8px' }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
