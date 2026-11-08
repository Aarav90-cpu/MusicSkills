/**
 * MusicSkills Professional DAW - Browser Sidebar
 * Access audio samples, pre-engineered beat grooves, and project covers.
 * Supports sample auditioning, file imports, one-click beat loading, and cover duplication.
 * Strictly zero-emoji.
 */

import React, { useState, useEffect } from 'react';
import { dawSampleManager, SampleItem } from '../../utils/daw/sampleManager';
import { BEAT_PRESETS, BeatPreset } from '../../utils/beatPresets';
import { dawAudioEngine } from '../../utils/dawAudioEngine';
import { dawSynthEngine } from '../../utils/daw/synthEngine';
import { dawContextManager } from '../../utils/daw/audioContext';
import { useApp } from '../../context/AppContext';

interface DawBrowserSidebarProps {
  onAddSampleToNewTrack: (sample: SampleItem) => void;
  onAddSampleToTrack: (sample: SampleItem, trackId: string, bar: number) => void;
  selectedTrackId?: string;
  currentPlayheadBar: number;
  onApplyBeatPreset?: (preset: BeatPreset) => void;
  onOpenCoverModal?: () => void;
}

export const DawBrowserSidebar: React.FC<DawBrowserSidebarProps> = ({
  onAddSampleToNewTrack,
  onAddSampleToTrack,
  selectedTrackId,
  currentPlayheadBar,
  onApplyBeatPreset,
  onOpenCoverModal,
}) => {
  const { chats, playTrack } = useApp();
  const [activeTab, setActiveTab] = useState<'samples' | 'beats' | 'covers'>('samples');

  // Samples State
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sampleSearchQuery, setSampleSearchQuery] = useState<string>('');
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  // Beats State
  const [beatSearchQuery, setBeatSearchQuery] = useState<string>('');
  const [previewingBeatId, setPreviewingBeatId] = useState<string | null>(null);

  // Covers State
  const [coverSearchQuery, setCoverSearchQuery] = useState<string>('');

  useEffect(() => {
    dawSampleManager.initializeDefaultLibrary().then(() => {
      setSamples(dawSampleManager.getSamplesByCategory('all'));
    });
  }, []);

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setSamples(dawSampleManager.getSamplesByCategory(cat));
  };

  const handlePlayPreview = (sample: SampleItem) => {
    setActiveSampleId(sample.id);
    dawSampleManager.playSamplePreview(sample.id);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { buffer, peaks } = await dawSampleManager.decodeAudioFile(file);
      const newSample: SampleItem = {
        id: `user_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: 'vocals',
        durationSec: buffer.duration,
        sampleRate: buffer.sampleRate,
        buffer,
        peaks,
      };

      setSamples((prev) => [newSample, ...prev]);
      setActiveSampleId(newSample.id);
      dawSampleManager.playSamplePreview(newSample.id);
    } catch (err) {
      console.error('Audio import failed:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Beat Preset Preview
  const handlePreviewBeat = (preset: BeatPreset) => {
    setPreviewingBeatId(preset.id);
    const ctx = dawContextManager.getContext();
    const stepDur = 60 / preset.bpm / 4;
    const now = ctx.currentTime;

    // Play 1 bar audition of the rhythm
    for (let step = 0; step < 16; step++) {
      const t = now + step * stepDur;
      if (preset.drumSteps.kick[step]) dawAudioEngine.playKick(t, 0.85);
      if (preset.drumSteps.snare[step]) dawAudioEngine.playSnare(t, 0.8);
      if (preset.drumSteps.hihatClosed[step]) dawAudioEngine.playHiHatClosed(t, 0.65);
      if (preset.drumSteps.hihatOpen[step]) dawAudioEngine.playHiHatOpen(t, 0.65);
      if (preset.drumSteps.clap[step]) dawAudioEngine.playClap(t, 0.75);
      if (preset.drumSteps.sub808[step]) dawAudioEngine.play808Sub(t, 'C2', 0.4, 0.85);
      if (preset.drumSteps.perc[step]) dawAudioEngine.playPerc(t, 0.7);
    }

    // Play chord stabs in bar 1
    preset.pianoNotes.forEach((pn) => {
      if (pn.step < 16) {
        dawSynthEngine.playNote(
          pn.pitch,
          pn.durationSteps * stepDur,
          pn.velocity || 0.8,
          'piano',
          undefined,
          now + pn.step * stepDur
        );
      }
    });

    setTimeout(() => {
      setPreviewingBeatId((curr) => (curr === preset.id ? null : curr));
    }, stepDur * 16 * 1000);
  };

  const handlePreviewProjectAudio = (chat: any) => {
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

  const filteredSamples = samples.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(sampleSearchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const filteredBeats = BEAT_PRESETS.filter((b) => {
    const q = beatSearchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.genre.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
  });

  const filteredProjects = chats.filter((c) => {
    const q = coverSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.style.genre.toLowerCase().includes(q);
  });

  const activeSample = samples.find((s) => s.id === activeSampleId);

  return (
    <aside
      style={{
        width: '270px',
        backgroundColor: '#17191E',
        borderRight: '1px solid #1D2027',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 1. Primary Tab Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '1px solid #1D2027',
          backgroundColor: '#111216',
        }}
      >
        <button
          onClick={() => setActiveTab('samples')}
          style={{
            padding: '10px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'samples' ? 700 : 500,
            color: activeTab === 'samples' ? '#35C9A5' : '#9CA3AF',
            borderBottom: activeTab === 'samples' ? '2px solid #35C9A5' : '2px solid transparent',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Samples
        </button>

        <button
          onClick={() => setActiveTab('beats')}
          style={{
            padding: '10px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'beats' ? 700 : 500,
            color: activeTab === 'beats' ? '#8B78FF' : '#9CA3AF',
            borderBottom: activeTab === 'beats' ? '2px solid #8B78FF' : '2px solid transparent',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Beats
        </button>

        <button
          onClick={() => setActiveTab('covers')}
          style={{
            padding: '10px 4px',
            fontSize: '11px',
            fontWeight: activeTab === 'covers' ? 700 : 500,
            color: activeTab === 'covers' ? '#F5C451' : '#9CA3AF',
            borderBottom: activeTab === 'covers' ? '2px solid #F5C451' : '2px solid transparent',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Covers
        </button>
      </div>

      {/* 2. TAB CONTENT: SAMPLES */}
      {activeTab === 'samples' && (
        <>
          <div
            style={{
              padding: '12px 14px 8px',
              borderBottom: '1px solid #1D2027',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
                Sample Library
              </span>

              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#35C9A5',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
                title="Import custom .wav or .mp3 sample"
              >
                <span className="material-icons-round" style={{ fontSize: '14px' }}>file_upload</span>
                <span>Import</span>
                <input type="file" accept="audio/*,.wav,.mp3" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span
                className="material-icons-round"
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '15px',
                  color: '#697180',
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search samples..."
                value={sampleSearchQuery}
                onChange={(e) => setSampleSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '4px',
                  paddingLeft: '28px',
                  fontSize: '12px',
                  color: '#F3F4F6',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['all', 'kicks', 'snares', 'hats', 'claps', 'bass', 'instruments', 'vocals'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: selectedCategory === cat ? 700 : 500,
                    backgroundColor: selectedCategory === cat ? '#35C9A5' : '#252932',
                    color: selectedCategory === cat ? '#101114' : '#9CA3AF',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Sample Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {filteredSamples.map((sample) => {
              const isActive = sample.id === activeSampleId;

              return (
                <div
                  key={sample.id}
                  onClick={() => handlePlayPreview(sample)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#252932' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    marginBottom: '2px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span
                      className="material-icons-round"
                      style={{ fontSize: '15px', color: isActive ? '#35C9A5' : '#697180' }}
                    >
                      {isActive ? 'volume_up' : 'audiotrack'}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#FFFFFF' : '#F3F4F6',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                      }}
                    >
                      {sample.name}
                    </span>
                  </div>

                  <span style={{ fontSize: '10px', color: '#697180', fontFamily: 'monospace' }}>
                    {sample.durationSec.toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Preview Player & Add to Timeline Bottom Card */}
          {activeSample && (
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid #1D2027',
                backgroundColor: '#101114',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F3F4F6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeSample.name}
                </span>
                <button
                  onClick={() => handlePlayPreview(activeSample)}
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: '#35C9A5',
                    border: 'none',
                    borderRadius: '50%',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Play preview"
                >
                  <span className="material-icons-round" style={{ fontSize: '16px' }}>play_arrow</span>
                </button>
              </div>

              {/* SVG Waveform Visualization */}
              <div style={{ height: '32px', backgroundColor: '#17191E', borderRadius: '4px', padding: '2px', overflow: 'hidden' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${activeSample.peaks.length} 32`} preserveAspectRatio="none">
                  {activeSample.peaks.map((p, idx) => {
                    const h = Math.max(2, p * 30);
                    const y = 16 - h / 2;
                    return (
                      <rect
                        key={idx}
                        x={idx}
                        y={y}
                        width={0.8}
                        height={h}
                        fill="#35C9A5"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Add Actions */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedTrackId ? (
                  <button
                    onClick={() => onAddSampleToTrack(activeSample, selectedTrackId, currentPlayheadBar)}
                    style={{
                      flex: 1,
                      height: '28px',
                      backgroundColor: '#8B78FF',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title={`Place sample on selected track at Bar ${currentPlayheadBar}`}
                  >
                    Insert at Bar {currentPlayheadBar}
                  </button>
                ) : null}

                <button
                  onClick={() => onAddSampleToNewTrack(activeSample)}
                  style={{
                    flex: 1,
                    height: '28px',
                    backgroundColor: '#252932',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#F3F4F6',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Add sample into a new audio track"
                >
                  + New Track
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. TAB CONTENT: BEATS & GROOVES */}
      {activeTab === 'beats' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 14px 8px',
              borderBottom: '1px solid #1D2027',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
                Precreated Beats
              </span>
              <span style={{ fontSize: '10px', color: '#8B78FF', fontWeight: 600 }}>
                {BEAT_PRESETS.length} Patterns
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <span
                className="material-icons-round"
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '15px',
                  color: '#697180',
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search beats (Trap, Lo-Fi, Phonk...)"
                value={beatSearchQuery}
                onChange={(e) => setBeatSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '4px',
                  paddingLeft: '28px',
                  fontSize: '12px',
                  color: '#F3F4F6',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredBeats.map((preset) => {
              const isAuditioning = previewingBeatId === preset.id;

              return (
                <div
                  key={preset.id}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: '#111216',
                    border: isAuditioning ? '1px solid #8B78FF' : '1px solid #252932',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                      {preset.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: '#252932',
                        color: '#35C9A5',
                        padding: '2px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {preset.bpm} BPM
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', lineHeight: 1.3 }}>
                    {preset.description}
                  </p>

                  <div style={{ fontSize: '10px', color: '#697180' }}>
                    Key: {preset.key} {preset.scale} | 7 Drum Voices | Bass & Chords
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => handlePreviewBeat(preset)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: isAuditioning ? '#8B78FF' : '#252932',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                      title="Audition 1-bar beat loop"
                    >
                      <span className="material-icons-round" style={{ fontSize: '14px' }}>
                        {isAuditioning ? 'stop' : 'play_arrow'}
                      </span>
                      <span>{isAuditioning ? 'Playing' : 'Audition'}</span>
                    </button>

                    {onApplyBeatPreset && (
                      <button
                        onClick={() => onApplyBeatPreset(preset)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: '#35C9A5',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#101114',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Load this beat groove into DAW session"
                      >
                        Load Beat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: PROJECTS & COVERS */}
      {activeTab === 'covers' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 14px 8px',
              borderBottom: '1px solid #1D2027',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '0.05em' }}>
                Project Covers & Stems
              </span>

              {onOpenCoverModal && (
                <button
                  onClick={onOpenCoverModal}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#F5C451',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="Open full Cover & Duplication dialog"
                >
                  Modal...
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <span
                className="material-icons-round"
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '15px',
                  color: '#697180',
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search projects..."
                value={coverSearchQuery}
                onChange={(e) => setCoverSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '28px',
                  backgroundColor: '#101114',
                  border: '1px solid #252932',
                  borderRadius: '4px',
                  paddingLeft: '28px',
                  fontSize: '12px',
                  color: '#F3F4F6',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredProjects.length === 0 ? (
              <div style={{ padding: '20px 8px', textAlign: 'center', color: '#697180', fontSize: '11px' }}>
                No projects found. Create songs in MusicSkills to use them as cover baselines.
              </div>
            ) : (
              filteredProjects.map((chat) => (
                <div
                  key={chat.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#111216',
                    border: '1px solid #252932',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <button
                        onClick={() => handlePreviewProjectAudio(chat)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: '#252932',
                          border: 'none',
                          color: '#F5C451',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          flexShrink: 0,
                        }}
                        title="Preview audio master"
                      >
                        <span className="material-icons-round" style={{ fontSize: '14px' }}>play_arrow</span>
                      </button>

                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#F3F4F6',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {chat.name}
                      </span>
                    </div>

                    <span style={{ fontSize: '10px', color: '#35C9A5', fontWeight: 600 }}>
                      {chat.style.bpm} BPM
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#697180' }}>
                    <span>{chat.style.genre} | Key {chat.style.key}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    {onOpenCoverModal && (
                      <button
                        onClick={onOpenCoverModal}
                        style={{
                          flex: 1,
                          padding: '4px',
                          backgroundColor: '#252932',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#F5C451',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Use chords, structure and tempo to build a cover"
                      >
                        Use as Cover
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
