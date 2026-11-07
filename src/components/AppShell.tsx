import React, { useState } from 'react';
import { useApp, AppRoute } from '../context/AppContext';
import { ActivityPanel } from './ActivityPanel';
import { PersistentPlayer } from './PersistentPlayer';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const {
    route,
    setRoute,
    activeChat,
    setActiveChatId,
    chats,
    refreshChats,
    theme,
    toggleTheme,
    toggleActivity,
    activityEvents,
    snackbar,
    showSnackbar,
    systemStatus,
  } = useApp();

  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Handle chat creation
  const handleNewSong = async () => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Track' }),
      });
      if (res.ok) {
        const newChat = await res.json();
        await refreshChats();
        setActiveChatId(newChat.id);
        setRoute('chat');
        showSnackbar(`Created project "${newChat.name}"`);
      }
    } catch (e) {
      console.error('Error creating song:', e);
    }
  };

  const handleSaveName = async () => {
    if (!activeChat || !tempName.trim()) {
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName.trim() }),
      });
      if (res.ok) {
        await refreshChats();
        setEditingName(false);
        showSnackbar(`Renamed to "${tempName.trim()}"`);
      }
    } catch (e) {
      console.error('Error renaming:', e);
    }
  };

  const handleDeleteChat = async (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This removes its folder from .chats and cannot be undone.`)) {
      try {
        await fetch(`/api/chats/${id}`, { method: 'DELETE' });
        await refreshChats();
        showSnackbar(`Deleted "${name}"`);
        if (activeChat?.id === id) {
          setActiveChatId(null);
          setRoute('home');
        }
      } catch (e) {
        console.error('Error deleting chat:', e);
      }
    }
  };

  // If on public welcome page, render without full app shell
  if (route === 'welcome') {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--color-bg)' }}>
      {/* LEFT NAVIGATION DRAWER (280px or 80px) */}
      <aside
        style={{
          width: isDrawerCollapsed ? '80px' : '280px',
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-outline)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 800,
          transition: 'width var(--duration-medium) var(--ease-standard)',
          flexShrink: 0,
        }}
      >
        {/* Drawer Header & Logo */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={() => setRoute('welcome')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            {/* 5 Rounded Gradient Bars Logo */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px' }}>
              <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
              <div style={{ width: '4px', height: '22px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
              <div style={{ width: '4px', height: '10px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
              <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
              <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
            </div>
            {!isDrawerCollapsed && (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>
                MusicSkills
              </span>
            )}
          </div>

          <button
            className="btn-text"
            onClick={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
            title={isDrawerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <span className="material-icons-round">
              {isDrawerCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Extended + New Song Button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={handleNewSong}
            className="btn btn-gradient"
            style={{
              width: '100%',
              height: '48px',
              fontSize: '14px',
              borderRadius: 'var(--radius-full)',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 18px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '20px' }}>add</span>
            {!isDrawerCollapsed && <span>New song</span>}
          </button>
        </div>

        {/* Primary Nav Links */}
        <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            className={`btn ${route === 'home' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('home')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'home' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'home' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">library_music</span>
            {!isDrawerCollapsed && <span>All Songs</span>}
          </button>

          <button
            className={`btn ${route === 'lyrics' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('lyrics')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'lyrics' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'lyrics' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">subtitles</span>
            {!isDrawerCollapsed && <span>Stage Lyrics</span>}
          </button>

          <button
            className={`btn ${route === 'code' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('code')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'code' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'code' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">terminal</span>
            {!isDrawerCollapsed && <span>Code Editor</span>}
          </button>

          <button
            className={`btn ${route === 'video' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('video')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'video' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'video' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">movie_filter</span>
            {!isDrawerCollapsed && <span>Video Studio</span>}
          </button>

          <button
            className={`btn ${route === 'studio' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('studio')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'studio' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'studio' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">graphic_eq</span>
            {!isDrawerCollapsed && <span>Beat Studio (DAW)</span>}
          </button>

          <button
            className={`btn ${route === 'stats' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('stats')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'stats' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'stats' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">insights</span>
            {!isDrawerCollapsed && <span>Player & Stats</span>}
          </button>

          <button
            className={`btn ${route === 'settings' ? 'btn-tonal' : 'btn-text'}`}
            onClick={() => setRoute('settings')}
            style={{
              width: '100%',
              height: '48px',
              justifyContent: isDrawerCollapsed ? 'center' : 'flex-start',
              padding: isDrawerCollapsed ? '0' : '0 16px',
              backgroundColor: route === 'settings' ? 'var(--color-primary-container)' : 'transparent',
              color: route === 'settings' ? 'var(--color-on-primary-container)' : 'var(--color-text)',
            }}
          >
            <span className="material-icons-round">settings</span>
            {!isDrawerCollapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* Recent Chats Section */}
        {!isDrawerCollapsed && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', padding: '0 8px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Projects
            </div>
            {chats.slice(0, 8).map(chat => (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setRoute('chat');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  backgroundColor: activeChat?.id === chat.id ? 'var(--color-container)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (activeChat?.id !== chat.id) e.currentTarget.style.backgroundColor = 'var(--color-container)';
                }}
                onMouseLeave={e => {
                  if (activeChat?.id !== chat.id) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'var(--gradient-signature)',
                      opacity: 0.8,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF',
                    }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '16px' }}>music_note</span>
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chat.name}
                  </span>
                </div>

                <button
                  className="btn-text"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id, chat.name);
                  }}
                  title="Delete song"
                  style={{ width: '24px', height: '24px', padding: 0, opacity: 0.6 }}
                >
                  <span className="material-icons-round" style={{ fontSize: '16px' }}>delete_outline</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-outline)', fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          {!isDrawerCollapsed && (
            <>
              <span>v1.0.0 (Local-First)</span>
              <span>MIT License</span>
            </>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP BAR (64px) */}
        <header
          style={{
            height: '64px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 700,
          }}
        >
          {/* Left: Chat Name / Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {route === 'chat' || route === 'vocals' || route === 'iterate' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      autoFocus
                      style={{ height: '36px', fontSize: '15px' }}
                    />
                    <button className="btn btn-primary" onClick={handleSaveName} style={{ height: '36px', padding: '0 12px' }}>
                      Save
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setTempName(activeChat?.name || '');
                      setEditingName(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '8px',
                    }}
                    title="Click to rename track"
                  >
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>
                      {activeChat?.name || 'Untitled Song'}
                    </span>
                    <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
                      edit
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>
                {route === 'home'
                  ? 'Song Library'
                  : route === 'settings'
                  ? 'Studio Settings'
                  : route === 'stats'
                  ? 'Library, Playlists & Analytics'
                  : route === 'code'
                  ? 'Python Code Editor'
                  : route === 'video'
                  ? 'Remotion Music Video Studio'
                  : route === 'lyrics'
                  ? 'Stage Lyrics & Syncer'
                  : route === 'studio'
                  ? 'Beat Studio (LMMS DAW)'
                  : 'MusicSkills Studio'}
              </span>
            )}
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Chip */}
            <div
              className="chip"
              style={{
                borderColor: systemStatus?.soundfontExists ? 'var(--color-success)' : 'var(--color-warning)',
                backgroundColor: 'transparent',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: systemStatus?.soundfontExists ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
              <span style={{ fontSize: '12px' }}>
                {systemStatus?.soundfontExists ? 'Audio Engine Ready' : 'MIDI Synthesizer Ready'}
              </span>
            </div>

            {/* Dark Studio Mode Toggle */}
            <button
              className="btn-text"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark Studio'} mode`}
              style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
            >
              <span className="material-icons-round">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Activity Stream Toggle with Badge */}
            <button
              className="btn-text"
              onClick={toggleActivity}
              title="Toggle Live Activity Log"
              style={{
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '50%',
                position: 'relative',
              }}
            >
              <span className="material-icons-round">terminal</span>
              {activityEvents.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                  }}
                />
              )}
            </button>
          </div>
        </header>

        {/* Content Pane */}
        <main style={{ flex: 1, paddingBottom: '100px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      {/* ACTIVITY PANEL (COLLAPSIBLE) */}
      <ActivityPanel />

      {/* PERSISTENT MINI PLAYER */}
      <PersistentPlayer />

      {/* SNACKBAR NOTIFICATIONS */}
      {snackbar && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '24px',
            backgroundColor: 'var(--color-container-high)',
            border: '1px solid var(--color-outline)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            boxShadow: 'var(--shadow-l2)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1200,
            fontSize: '14px',
          }}
        >
          <span>{snackbar.message}</span>
          {snackbar.actionLabel && (
            <button
              className="btn btn-primary"
              onClick={() => {
                snackbar.onAction?.();
              }}
              style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
            >
              {snackbar.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

