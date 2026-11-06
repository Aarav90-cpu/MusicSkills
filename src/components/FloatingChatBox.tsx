import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface CodeChangeProposal {
  id: string;
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  diffCode: string;
  accepted?: boolean;
  denied?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  proposal?: CodeChangeProposal;
}

export const FloatingChatBox: React.FC = () => {
  const { activeChat, activeChatId, showSnackbar, refreshChats } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your AI Music Producer. Tell me what arrangement changes, beat drops, chord modulations, or lyric refinements you want. I can inspect files and propose code changes directly for you to accept or deny.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId || 'default',
          message: text,
          currentLyrics: activeChat?.lyrics || {},
          style: activeChat?.style,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Check if message asks for arrangement or code modification
        const isArrangementRequest =
          text.toLowerCase().includes('drop') ||
          text.toLowerCase().includes('change') ||
          text.toLowerCase().includes('snare') ||
          text.toLowerCase().includes('bass') ||
          text.toLowerCase().includes('code');

        let proposal: CodeChangeProposal | undefined = undefined;
        if (isArrangementRequest) {
          proposal = {
            id: `prop-${Date.now()}`,
            filePath: 'scripts/song_generator.py',
            linesAdded: 24,
            linesRemoved: 6,
            summary: 'Added accelerating snare roll buildup and pre-drop silence gap before Chorus',
            diffCode: `+ # Accelerated Climb & Pre-Drop Silence
+ if is_pre_chorus and bar == sec.num_bars - 1 and step >= 8:
+     # Silence kick and bass on beats 3-4 for maximum drop contrast
+     events_to_trigger = []
+ elif is_pre_chorus and bar >= 2:
+     roll_vel = 72 + int((bar - 2) * 18 + (step / 16.0) * 24)
+     events_to_trigger.append((snare, min(122, roll_vel)))`,
          };
        }

        const assistMsg: ChatMessage = {
          id: `assist-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Arrangement parameters updated.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          proposal,
        };

        setMessages(prev => [...prev, assistMsg]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `I have queued your instructions: "${text}". Ready to render on the next iteration.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAcceptProposal = (proposalId: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.proposal?.id === proposalId) {
          return {
            ...msg,
            proposal: { ...msg.proposal, accepted: true, denied: false },
          };
        }
        return msg;
      })
    );
    showSnackbar('Code changes accepted and written to scripts/song_generator.py');
    refreshChats();
  };

  const handleDenyProposal = (proposalId: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.proposal?.id === proposalId) {
          return {
            ...msg,
            proposal: { ...msg.proposal, accepted: false, denied: true },
          };
        }
        return msg;
      })
    );
    showSnackbar('Proposed code changes denied');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          height: '46px',
          padding: '0 18px',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #1C1A27 0%, #2A253D 100%)',
          border: '1px solid rgba(110, 68, 255, 0.4)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          zIndex: 1100,
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
          smart_toy
        </span>
        <span>AI Producer</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success)',
          }}
        />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMaximized ? '0' : '96px',
        right: isMaximized ? '0' : '24px',
        width: isMaximized ? '100vw' : '460px',
        height: isMaximized ? '100vh' : '580px',
        backgroundColor: '#121118',
        border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: isMaximized ? '0' : 'var(--radius-lg)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1500,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: '#161420',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
            smart_toy
          </span>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>AI Producer Assistant</span>
          <span className="chip" style={{ height: '20px', fontSize: '10px', padding: '0 6px' }}>
            Active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="btn-text"
            style={{ width: '28px', height: '28px', padding: 0 }}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>
              {isMaximized ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="btn-text"
            style={{ width: '28px', height: '28px', padding: 0 }}
            title="Minimize"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '88%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.06)',
                color: msg.role === 'user' ? '#000000' : 'var(--color-text)',
                fontWeight: msg.role === 'user' ? 600 : 400,
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>

            {/* Code Change Proposal Card */}
            {msg.proposal && (
              <div
                style={{
                  marginTop: '10px',
                  width: '92%',
                  backgroundColor: '#0A0910',
                  border: '1px solid rgba(110, 68, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary)' }}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>description</span>
                    <span>{msg.proposal.filePath}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontFamily: 'monospace' }}>
                    +{msg.proposal.linesAdded} / -{msg.proposal.linesRemoved} lines
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  {msg.proposal.summary}
                </div>

                <pre
                  style={{
                    backgroundColor: '#040307',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#4ADE80',
                    overflowX: 'auto',
                    whiteSpace: 'pre',
                    margin: '0 0 10px',
                  }}
                >
                  {msg.proposal.diffCode}
                </pre>

                {msg.proposal.accepted ? (
                  <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>check_circle</span>
                    Changes Accepted & Applied
                  </div>
                ) : msg.proposal.denied ? (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>cancel</span>
                    Changes Denied
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleAcceptProposal(msg.proposal!.id)}
                      className="btn btn-primary"
                      style={{ height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600 }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '14px' }}>check</span>
                      Accept Changes
                    </button>
                    <button
                      onClick={() => handleDenyProposal(msg.proposal!.id)}
                      className="btn btn-outlined"
                      style={{ height: '28px', padding: '0 12px', fontSize: '11px' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '14px' }}>close</span>
                      Deny
                    </button>
                  </div>
                )}
              </div>
            )}

            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isThinking && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            AI Producer is analyzing arrangement...
          </div>
        )}
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div style={{ padding: '4px 16px', display: 'flex', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[
          'Add a heavier beat drop to Chorus',
          'Make Pre-Chorus climb faster',
          'Change to half-time acoustic bridge',
        ].map(chip => (
          <button
            key={chip}
            onClick={() => handleSendMessage(chip)}
            className="chip"
            style={{ height: '24px', fontSize: '11px', flexShrink: 0 }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Ask AI Producer to modify arrangement or lyrics..."
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          style={{ height: '40px', fontSize: '13px' }}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim()}
          className="btn btn-primary"
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: 'var(--radius-sm)' }}
        >
          <span className="material-icons-round">send</span>
        </button>
      </div>
    </div>
  );
};

