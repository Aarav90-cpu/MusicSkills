import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  loadStudioStats,
  loadPlaylists,
  createPlaylist,
  removeTrackFromPlaylist,
  toggleFavoriteTrack,
  isTrackFavorite,
  StudioStats,
  Playlist,
} from '../utils/libraryStorage';

export const StatsPage: React.FC = () => {
  const { chats, playTrack, setActiveChatId, setRoute, showSnackbar } = useApp();

  const [stats, setStats] = useState<StudioStats>(loadStudioStats());
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists());
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'playlists' | 'favorites'>('overview');

  useEffect(() => {
    setStats(loadStudioStats());
    setPlaylists(loadPlaylists());
  }, []);

  const formatHoursMins = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${totalSecs % 60}s`;
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const pl = createPlaylist(newPlaylistName.trim());
    setPlaylists(loadPlaylists());
    setNewPlaylistName('');
    showSnackbar(`Created playlist "${pl.name}"`);
  };

  const handlePlayChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.versions.length > 0) {
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
      showSnackbar(`Playing "${chat.name}"`);
    } else if (chat) {
      setActiveChatId(chat.id);
      setRoute('chat');
    }
  };

  const favoriteChats = chats.filter(c => stats.favoriteTrackIds.includes(c.id));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>Music Studio & Player Stats</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Analytics on your listening sessions, code iterations, AI token consumption, and music collections.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--color-outline)' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'overview' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'overview' ? '#000' : 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'playlists' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'playlists' ? '#000' : 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Playlists ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === 'favorites' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'favorites' ? '#000' : 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Favorites ({favoriteChats.length})
          </button>
        </div>
      </div>

      {/* OVERVIEW ANALYTICS TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                <span className="material-icons-round">headphones</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Listening Time</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {formatHoursMins(stats.listeningSeconds)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Total playback time in Studio Player
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3CC4B2' }}>
                <span className="material-icons-round">code</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coding & Composing</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {formatHoursMins(stats.codingSeconds)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Time crafting Python arrangements & prompts
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFB020' }}>
                <span className="material-icons-round">token</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tokens Processed</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {((stats.promptTokens + stats.completionTokens) / 1000).toFixed(1)}k
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {stats.promptTokens.toLocaleString()} in · {stats.completionTokens.toLocaleString()} out
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF4FA3' }}>
                <span className="material-icons-round">music_note</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Songs in Library</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {chats.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Stored locally in <code>.chats/</code>
              </div>
            </div>
          </div>

          {/* Genre Distribution Breakdown */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Top Genre Compositions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(stats.genrePlays).map(([genre, count]) => {
                const totalPlays = Object.values(stats.genrePlays).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / Math.max(1, totalPlays)) * 100);

                return (
                  <div key={genre} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{genre}</span>
                      <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                        {count} tracks ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--color-container)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PLAYLISTS TAB */}
      {activeTab === 'playlists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Create Playlist Form */}
          <div className="card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Enter new playlist name..."
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreatePlaylist();
              }}
              style={{ flex: 1, height: '42px' }}
            />
            <button
              onClick={handleCreatePlaylist}
              className="btn btn-primary"
              style={{ height: '42px', padding: '0 20px', fontWeight: 600 }}
            >
              <span className="material-icons-round">add</span>
              Create Playlist
            </button>
          </div>

          {/* Playlist Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {playlists.map(pl => (
              <div key={pl.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{pl.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{pl.description || 'Custom playlist'}</p>
                  </div>
                  <span className="chip" style={{ fontSize: '11px', height: '22px' }}>
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pl.trackIds.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '12px 0', textAlign: 'center' }}>
                      No tracks added yet. Add songs from your library.
                    </div>
                  ) : (
                    pl.trackIds.map(tid => {
                      const chat = chats.find(c => c.id === tid);
                      return (
                        <div key={tid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--color-container)' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{chat?.name || 'Unknown Track'}</span>
                          <button
                            onClick={() => {
                              removeTrackFromPlaylist(pl.id, tid);
                              setPlaylists(loadPlaylists());
                            }}
                            className="btn-text"
                            style={{ padding: 0, width: '22px', height: '22px' }}
                          >
                            <span className="material-icons-round" style={{ fontSize: '14px' }}>close</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAVORITES TAB */}
      {activeTab === 'favorites' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Favorite Tracks</h2>
          {favoriteChats.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No tracks marked as favorite yet. Click the heart or star on any track in your library to add it here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {favoriteChats.map(chat => (
                <div
                  key={chat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-outline)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => handlePlayChat(chat.id)}
                      className="btn btn-primary"
                      style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '20px' }}>play_arrow</span>
                    </button>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{chat.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {chat.style.genre} · {chat.style.bpm} BPM · Key {chat.style.key}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setRoute('lyrics');
                      }}
                      className="btn btn-outlined"
                      style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px' }}>subtitles</span>
                      Stage Lyrics
                    </button>

                    <button
                      onClick={() => {
                        toggleFavoriteTrack(chat.id);
                        setStats(loadStudioStats());
                      }}
                      className="btn-text"
                      style={{ width: '32px', height: '32px', padding: 0, color: '#FF4FA3' }}
                    >
                      <span className="material-icons-round">favorite</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
