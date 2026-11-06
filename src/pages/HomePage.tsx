import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChatSession } from '../types';

export const HomePage: React.FC = () => {
  const { chats, refreshChats, setActiveChatId, setRoute, playTrack, showSnackbar } = useApp();
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'genre'>('recent');

  const handleCreateNew = async () => {
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
      }
    } catch (e) {
      console.error('Error creating chat:', e);
    }
  };

  const handlePlaySong = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    if (chat.versions.length > 0) {
      const latest = chat.versions[chat.versions.length - 1];
      playTrack({
        chatId: chat.id,
        songName: chat.name,
        version: latest.version,
        mp3Url: `/api/audio/${chat.id}/${latest.mp3File}`,
        midiUrl: `/api/audio/${chat.id}/${latest.midiFile}`,
        durationSec: latest.durationSec,
        lyrics: chat.lyrics,
        bpm: chat.style.bpm,
      });
    } else {
      setActiveChatId(chat.id);
      setRoute('chat');
    }
  };

  const handleDelete = async (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${chat.name}"? This removes its folder from .chats.`)) {
      try {
        await fetch(`/api/chats/${chat.id}`, { method: 'DELETE' });
        await refreshChats();
        showSnackbar(`Deleted "${chat.name}"`);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  // Unique genres across existing chats
  const genresUsed = Array.from(new Set(chats.map(c => c.style.genre).filter(Boolean)));

  // Filter & Sort
  const filteredChats = chats
    .filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.style.topic.toLowerCase().includes(search.toLowerCase());
      const matchGenre = selectedGenre === 'all' || c.style.genre.toLowerCase() === selectedGenre.toLowerCase();
      return matchSearch && matchGenre;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'genre') return a.style.genre.localeCompare(b.style.genre);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      {/* HEADER ROW */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '32px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Your Songs</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            {chats.length} {chats.length === 1 ? 'project' : 'projects'} saved locally in <code>.chats/</code>
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <span
              className="material-icons-round"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: '18px' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search songs..."
              className="input-field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: '40px', paddingLeft: '38px', fontSize: '13px' }}
            />
          </div>

          <select
            className="input-field"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{ height: '40px', width: '130px', fontSize: '13px', cursor: 'pointer' }}
          >
            <option value="recent">Recent</option>
            <option value="name">A to Z</option>
            <option value="genre">Genre</option>
          </select>
        </div>
      </div>

      {/* GENRE FILTER CHIPS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
        <button
          className={`chip ${selectedGenre === 'all' ? 'chip-active' : ''}`}
          onClick={() => setSelectedGenre('all')}
        >
          All Genres
        </button>
        {genresUsed.map(g => (
          <button
            key={g}
            className={`chip ${selectedGenre === g ? 'chip-active' : ''}`}
            onClick={() => setSelectedGenre(g)}
            style={{ textTransform: 'capitalize' }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* SONG CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
        }}
      >
        {/* First Cell: Dashed + New Song Card */}
        <div
          onClick={handleCreateNew}
          style={{
            border: '2px dashed var(--color-outline)',
            borderRadius: 'var(--radius-lg)',
            minHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-container)';
            e.currentTarget.style.color = 'var(--color-text)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-outline)';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '32px', color: 'var(--color-primary)' }}>
              add
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px' }}>
            New song
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
            Describe style and write lyrics
          </span>
        </div>

        {/* Render Saved Songs */}
        {filteredChats.map(chat => {
          const hasVersion = chat.versions.length > 0;
          const latestVersion = hasVersion ? chat.versions[chat.versions.length - 1] : null;
          const hasVocals = chat.takes.length > 0;

          return (
            <div
              key={chat.id}
              className="card card-hover"
              onClick={() => {
                setActiveChatId(chat.id);
                setRoute('chat');
              }}
              style={{
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Card Cover (140px) */}
              <div
                style={{
                  height: '140px',
                  background: 'linear-gradient(135deg, #1A162B 0%, #2A1F45 100%)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                }}
              >
                {/* Visualizer silhouette */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', opacity: 0.35, height: '60px' }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '4px',
                        height: `${20 + Math.sin(i * 0.6) * 35}px`,
                        borderRadius: '2px',
                        backgroundColor: '#FFF',
                      }}
                    />
                  ))}
                </div>

                {/* Status Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(15, 14, 21, 0.8)',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: hasVersion ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  />
                  <span>{hasVersion ? (hasVocals ? 'Has Vocals' : 'Ready') : 'Draft'}</span>
                </div>

                {/* Play Button Overlay */}
                <button
                  onClick={e => handlePlaySong(e, chat)}
                  title={hasVersion ? 'Play latest audio' : 'Open project'}
                  style={{
                    position: 'absolute',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--gradient-signature)',
                    border: 'none',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-l2)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-icons-round" style={{ fontSize: '26px' }}>
                    {hasVersion ? 'play_arrow' : 'edit'}
                  </span>
                </button>
              </div>

              {/* Card Body */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.name}
                  </div>
                  <button
                    className="btn-text"
                    onClick={e => handleDelete(e, chat)}
                    title="Delete project"
                    style={{ width: '28px', height: '28px', padding: 0 }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}>
                      delete_outline
                    </span>
                  </button>
                </div>

                {/* Style chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span className="chip" style={{ height: '24px', fontSize: '11px', padding: '0 8px', textTransform: 'capitalize' }}>
                    {chat.style.genre}
                  </span>
                  {chat.style.moods?.[0] && (
                    <span className="chip" style={{ height: '24px', fontSize: '11px', padding: '0 8px', textTransform: 'capitalize' }}>
                      {chat.style.moods[0]}
                    </span>
                  )}
                  {hasVersion && (
                    <span className="chip chip-active" style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}>
                      {latestVersion?.version}
                    </span>
                  )}
                </div>

                {/* Mono Info Row */}
                <div
                  className="mono"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    marginTop: 'auto',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-outline)',
                  }}
                >
                  <span>{chat.style.bpm} BPM · Key {chat.style.key}</span>
                  <span>{hasVersion ? `${Math.round(latestVersion?.durationSec || 0)}s` : 'Draft'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

