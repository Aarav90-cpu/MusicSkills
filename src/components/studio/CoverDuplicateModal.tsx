import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BEAT_PRESETS, BeatPreset } from '../../utils/beatPresets';

interface CoverDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset: (preset: BeatPreset) => void;
  onDuplicateProject: (sourceChatId: string, asCover: boolean, customName?: string) => Promise<void>;
}

export const CoverDuplicateModal: React.FC<CoverDuplicateModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset,
  onDuplicateProject,
}) => {
  const { chats, activeChat, playTrack } = useApp();
  const [tab, setTab] = useState<'covers' | 'presets'>('covers');
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const filteredChats = chats
    .filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.style.genre.toLowerCase().includes(search.toLowerCase());
      const matchGenre = selectedGenre === 'all' || c.style.genre.toLowerCase() === selectedGenre.toLowerCase();
      return matchSearch && matchGenre;
    });

  const handleDuplicate = async (chatId: string, asCover: boolean) => {
    setIsProcessing(true);
    try {
      await onDuplicateProject(chatId, asCover, customName.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Error duplicating project:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviewAudio = (chat: any) => {
    const artist = chat.style?.description?.replace(/^Custom import by\s*/i, '') || 'MusicSkills Studio';
    const coverArtUrl = chat.coverArtUrl || `/api/audio/${encodeURIComponent(chat.id)}/cover?title=${encodeURIComponent(chat.name)}`;
    if (chat.versions && chat.versions.length > 0) {
      const latest = chat.versions[chat.versions.length - 1];
      const mp3File = latest.mp3File || `${chat.folderName}_${latest.version || 'v1'}.mp3`;
      playTrack({
        chatId: chat.id,
        songName: chat.name,
        artist,
        album: `${chat.style?.genre || 'Pop'} Studio Masters`,
        coverArtUrl,
        version: latest.version,
        mp3Url: `/api/audio/${encodeURIComponent(chat.id)}/${encodeURIComponent(mp3File)}`,
        midiUrl: '',
        durationSec: latest.durationSec || 180,
        lyrics: chat.lyrics,
        bpm: chat.style?.bpm || 120,
      });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '840px',
          maxWidth: '100%',
          maxHeight: '88vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-outline)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-l3)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Project Covers, Duplication & Precreated Beats
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Use any existing project as a cover baseline, clone with tracks, or load pre-engineered beat grooves.
            </p>
          </div>

          <button className="btn-text" onClick={onClose} style={{ width: '36px', height: '36px', padding: 0 }}>
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline)', padding: '0 24px' }}>
          <button
            onClick={() => setTab('covers')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: tab === 'covers' ? 700 : 500,
              color: tab === 'covers' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === 'covers' ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>library_music</span>
            <span>Use Other Project as Cover or Duplicate</span>
          </button>

          <button
            onClick={() => setTab('presets')}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: tab === 'presets' ? 700 : 500,
              color: tab === 'presets' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === 'presets' ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>tune</span>
            <span>Precreated Beat Presets (Trap, Lo-Fi, Phonk, EDM...)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tab === 'covers' ? (
            <>
              {/* Active Project Duplication Card */}
              {activeChat && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--color-container)',
                    border: '1px solid var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      Current Open Project
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
                      {activeChat.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {activeChat.style.genre} · {activeChat.style.bpm} BPM · Key {activeChat.style.key}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn btn-outlined"
                      onClick={() => handleDuplicate(activeChat.id, true)}
                      disabled={isProcessing}
                      style={{ fontSize: '12px', height: '36px' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px' }}>music_note</span>
                      <span>Branch New Cover</span>
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={() => handleDuplicate(activeChat.id, false)}
                      disabled={isProcessing}
                      style={{ fontSize: '12px', height: '36px' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px' }}>content_copy</span>
                      <span>Duplicate Project</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search projects to use as cover..."
                  className="input-field"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, height: '38px', fontSize: '13px' }}
                />

                <select
                  className="input-field"
                  value={selectedGenre}
                  onChange={e => setSelectedGenre(e.target.value)}
                  style={{ width: '130px', height: '38px', fontSize: '13px' }}
                >
                  <option value="all">All Genres</option>
                  <option value="pop">Pop</option>
                  <option value="hip-hop">Hip-Hop</option>
                  <option value="electronic">Electronic</option>
                  <option value="rock">Rock</option>
                  <option value="phonk">Phonk</option>
                  <option value="indian">Indian</option>
                </select>
              </div>

              {/* Projects Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredChats.slice(0, 15).map(c => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-container)',
                      border: '1px solid var(--color-outline)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        className="btn-text"
                        onClick={() => handlePreviewAudio(c)}
                        title="Preview Audio"
                        style={{ width: '32px', height: '32px', padding: 0 }}
                      >
                        <span className="material-icons-round" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>
                          play_circle
                        </span>
                      </button>

                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {c.style.genre} · {c.style.bpm} BPM · Key {c.style.key}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-outlined"
                        onClick={() => handleDuplicate(c.id, true)}
                        disabled={isProcessing}
                        style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                        title="Use chords, tempo and structure to create a fresh cover"
                      >
                        <span className="material-icons-round" style={{ fontSize: '15px' }}>queue_music</span>
                        <span>Use as Cover</span>
                      </button>

                      <button
                        className="btn btn-tonal"
                        onClick={() => handleDuplicate(c.id, false)}
                        disabled={isProcessing}
                        style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                        title="Clone entire project session"
                      >
                        <span className="material-icons-round" style={{ fontSize: '15px' }}>content_copy</span>
                        <span>Duplicate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Presets Tab */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '12px' }}>
              {BEAT_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-container)',
                    border: '1px solid var(--color-outline)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                        {preset.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor: 'var(--color-primary-container)',
                          color: 'var(--color-on-primary-container)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                        }}
                      >
                        {preset.bpm} BPM
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, margin: '4px 0 8px' }}>
                      {preset.description}
                    </p>

                    <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
                      Key: {preset.key} {preset.scale} · 7-Voice Drum Pattern · Bass & Piano Chords
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      onApplyPreset(preset);
                      onClose();
                    }}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '16px' }}>download</span>
                    <span>Load Beat into Studio</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
