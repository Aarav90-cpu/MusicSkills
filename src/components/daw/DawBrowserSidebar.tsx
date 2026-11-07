import React, { useState, useEffect } from 'react';
import { dawSampleManager, SampleItem } from '../../utils/daw/sampleManager';

interface DawBrowserSidebarProps {
  onAddSampleToNewTrack: (sample: SampleItem) => void;
  onAddSampleToTrack: (sample: SampleItem, trackId: string, bar: number) => void;
  selectedTrackId?: string;
  currentPlayheadBar: number;
}

export const DawBrowserSidebar: React.FC<DawBrowserSidebarProps> = ({
  onAddSampleToNewTrack,
  onAddSampleToTrack,
  selectedTrackId,
  currentPlayheadBar,
}) => {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

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

  const filteredSamples = samples.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const activeSample = samples.find((s) => s.id === activeSampleId);

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#17191E',
        borderRight: '1px solid #1D2027',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Browser Header */}
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
            Browser / Library
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                backgroundColor: selectedCategory === cat ? '#8B78FF' : '#252932',
                color: selectedCategory === cat ? '#FFFFFF' : '#9CA3AF',
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
    </aside>
  );
};
