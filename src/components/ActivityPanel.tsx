import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const ActivityPanel: React.FC = () => {
  const { activityEvents, clearActivityEvents, isActivityOpen, setIsActivityOpen } = useApp();
  const [filter, setFilter] = useState<'all' | 'tools' | 'errors'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new event
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [activityEvents]);

  if (!isActivityOpen) return null;

  const filteredEvents = activityEvents.filter(ev => {
    if (filter === 'errors') return ev.status === 'error';
    if (filter === 'tools') return ev.details || ev.stage.includes('Tool') || ev.stage.includes('Rendering');
    return true;
  });

  return (
    <aside
      style={{
        width: '340px',
        height: 'calc(100vh - 64px)',
        position: 'fixed',
        top: '64px',
        right: 0,
        backgroundColor: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-outline)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 900,
        boxShadow: 'var(--shadow-l2)',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--color-outline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>terminal</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
            Activity Log
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-text"
            onClick={clearActivityEvents}
            title="Clear Log"
            style={{ height: '32px', padding: '0 8px', fontSize: '12px' }}
          >
            Clear
          </button>
          <button
            className="btn-text"
            onClick={() => setIsActivityOpen(false)}
            title="Close Panel"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--color-outline)' }}>
        <button
          className={`chip ${filter === 'all' ? 'chip-active' : ''}`}
          onClick={() => setFilter('all')}
          style={{ height: '28px', fontSize: '12px' }}
        >
          All ({activityEvents.length})
        </button>
        <button
          className={`chip ${filter === 'tools' ? 'chip-active' : ''}`}
          onClick={() => setFilter('tools')}
          style={{ height: '28px', fontSize: '12px' }}
        >
          Tools & Audio
        </button>
        <button
          className={`chip ${filter === 'errors' ? 'chip-active' : ''}`}
          onClick={() => setFilter('errors')}
          style={{ height: '28px', fontSize: '12px' }}
        >
          Errors
        </button>
      </div>

      {/* Timeline Stream */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
            No activity events recorded yet.
          </div>
        ) : (
          filteredEvents.map(ev => {
            const isExpanded = expandedId === ev.id;
            return (
              <div
                key={ev.id}
                style={{
                  backgroundColor: 'var(--color-container)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-outline)',
                  padding: '10px 12px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span
                      className="material-icons-round"
                      style={{
                        fontSize: '18px',
                        color:
                          ev.status === 'error'
                            ? 'var(--color-error)'
                            : ev.status === 'done'
                            ? 'var(--color-success)'
                            : 'var(--color-warning)',
                      }}
                    >
                      {ev.status === 'error' ? 'error' : ev.status === 'done' ? 'check_circle' : 'sync'}
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{ev.stage}</span>
                  </div>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {ev.timestamp}
                  </span>
                </div>

                {ev.details && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      className="btn-text"
                      onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      style={{ fontSize: '11px', padding: '0', height: '20px', color: 'var(--color-primary)' }}
                    >
                      {isExpanded ? 'Hide Details' : 'View Payload & Output'}
                    </button>
                    {isExpanded && (
                      <pre
                        className="mono"
                        style={{
                          marginTop: '6px',
                          padding: '8px',
                          backgroundColor: '#0A0A0F',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#C3C0DB',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '160px',
                        }}
                      >
                        {ev.details}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-outline)',
          backgroundColor: 'var(--color-container)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>Engine: Active</span>
        <span>Local Execution: Yes</span>
      </div>
    </aside>
  );
};

