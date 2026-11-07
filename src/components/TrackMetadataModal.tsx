import React, { useState, useEffect } from 'react';
import {
  LibraryTrack,
  CustomMetadataTag,
  resolveTrackLyrics,
  fetchAndCacheLyricsForTrack,
} from '../utils/trackLibrary';

interface TrackMetadataModalProps {
  track: LibraryTrack | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTrack: LibraryTrack) => void;
}

export const TrackMetadataModal: React.FC<TrackMetadataModalProps> = ({
  track,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !track) return null;

  // Form State across all metadata sectors
  const [title, setTitle] = useState(track.title || '');
  const [artist, setArtist] = useState(track.artist || '');
  const [album, setAlbum] = useState(track.album || '');
  const [albumArtist, setAlbumArtist] = useState(track.albumArtist || '');
  const [trackNumber, setTrackNumber] = useState<string>(track.trackNumber ? String(track.trackNumber) : '');
  const [discNumber, setDiscNumber] = useState<string>(track.discNumber ? String(track.discNumber) : '1');
  const [genre, setGenre] = useState(track.genre || 'Pop');
  const [year, setYear] = useState(track.year || '');
  const [bpm, setBpm] = useState<string>(track.bpm ? String(track.bpm) : '');
  const [rootKey, setRootKey] = useState(track.rootKey || 'C');
  const [mood, setMood] = useState(track.mood || '');
  const [purpose, setPurpose] = useState(track.purpose || '');
  const [composer, setComposer] = useState(track.composer || '');
  const [producer, setProducer] = useState(track.producer || '');
  const [notes, setNotes] = useState(track.notes || '');

  // Cover Art
  const [coverArtUrl, setCoverArtUrl] = useState<string>(track.coverArtUrl || '');

  // Custom Tags
  const [customTags, setCustomTags] = useState<CustomMetadataTag[]>(
    track.customTags ? [...track.customTags] : []
  );

  // Lyrics Fields (6-Tier Architecture)
  const [embeddedSyncedLyrics, setEmbeddedSyncedLyrics] = useState(track.embeddedSyncedLyrics || '');
  const [embeddedStaticLyrics, setEmbeddedStaticLyrics] = useState(track.embeddedStaticLyrics || '');
  const [localSyncedLyrics, setLocalSyncedLyrics] = useState(track.localSyncedLyrics || '');
  const [offlineStaticLyrics, setOfflineStaticLyrics] = useState(track.offlineStaticLyrics || '');
  const [onlineSyncedLyrics, setOnlineSyncedLyrics] = useState(track.onlineSyncedLyrics || '');
  const [onlineStaticLyrics, setOnlineStaticLyrics] = useState(track.onlineStaticLyrics || '');
  const [isFetchingLrc, setIsFetchingLrc] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync state whenever track changes
  useEffect(() => {
    setTitle(track.title || '');
    setArtist(track.artist || '');
    setAlbum(track.album || '');
    setAlbumArtist(track.albumArtist || '');
    setTrackNumber(track.trackNumber ? String(track.trackNumber) : '');
    setDiscNumber(track.discNumber ? String(track.discNumber) : '1');
    setGenre(track.genre || 'Pop');
    setYear(track.year || '');
    setBpm(track.bpm ? String(track.bpm) : '');
    setRootKey(track.rootKey || 'C');
    setMood(track.mood || '');
    setPurpose(track.purpose || '');
    setComposer(track.composer || '');
    setProducer(track.producer || '');
    setNotes(track.notes || '');
    setCoverArtUrl(track.coverArtUrl || '');
    setCustomTags(track.customTags ? [...track.customTags] : []);
    setEmbeddedSyncedLyrics(track.embeddedSyncedLyrics || '');
    setEmbeddedStaticLyrics(track.embeddedStaticLyrics || '');
    setLocalSyncedLyrics(track.localSyncedLyrics || '');
    setOfflineStaticLyrics(track.offlineStaticLyrics || '');
    setOnlineSyncedLyrics(track.onlineSyncedLyrics || '');
    setOnlineStaticLyrics(track.onlineStaticLyrics || '');
    setStatusMessage(null);
  }, [track]);

  // Compute live active lyrics resolution
  const tempTrack: LibraryTrack = {
    ...track,
    title,
    artist,
    album,
    embeddedSyncedLyrics,
    embeddedStaticLyrics,
    localSyncedLyrics,
    onlineSyncedLyrics,
    offlineStaticLyrics,
    onlineStaticLyrics,
  };
  const resolved = resolveTrackLyrics(tempTrack);

  // Cover Art Image Upload
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverArtUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom Tags Handlers
  const handleAddCustomTag = () => {
    setCustomTags([...customTags, { key: '', value: '' }]);
  };

  const handleUpdateCustomTag = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...customTags];
    updated[index][field] = val;
    setCustomTags(updated);
  };

  const handleRemoveCustomTag = (index: number) => {
    setCustomTags(customTags.filter((_, i) => i !== index));
  };

  // Force Re-fetch Lyrics from LRCLIB
  const handleForceRefetchLyrics = async () => {
    setIsFetchingLrc(true);
    setStatusMessage('Querying LRCLIB API with User-Agent...');
    try {
      const activeTrackSnapshot: LibraryTrack = {
        ...track,
        title,
        artist,
        album,
        durationSec: track.durationSec,
      };

      const updated = await fetchAndCacheLyricsForTrack(activeTrackSnapshot, true);
      if (updated.onlineSyncedLyrics) {
        setOnlineSyncedLyrics(updated.onlineSyncedLyrics);
        setStatusMessage('Success: Fetched and cached synchronized lyrics from LRCLIB.');
      } else if (updated.onlineStaticLyrics) {
        setOnlineStaticLyrics(updated.onlineStaticLyrics);
        setStatusMessage('Success: Fetched and cached plain text lyrics from LRCLIB.');
      } else {
        setStatusMessage('Notice: LRCLIB returned no matching lyrics for this title/artist combination.');
      }
    } catch (err: any) {
      setStatusMessage(`Error fetching from LRCLIB: ${err.message || 'Network error'}`);
    } finally {
      setIsFetchingLrc(false);
    }
  };

  // Save All Changes
  const handleSaveAll = () => {
    const updated: LibraryTrack = {
      ...track,
      title: title.trim() || 'Untitled Track',
      artist: artist.trim() || 'Unknown Artist',
      album: album.trim() || 'Single',
      albumArtist: albumArtist.trim() || undefined,
      trackNumber: trackNumber ? parseInt(trackNumber, 10) : undefined,
      discNumber: discNumber ? parseInt(discNumber, 10) : undefined,
      genre: genre.trim() || 'Other',
      year: year.trim() || undefined,
      bpm: bpm ? parseInt(bpm, 10) : undefined,
      rootKey: rootKey.trim() || 'C',
      mood: mood.trim() || undefined,
      purpose: purpose.trim() || undefined,
      composer: composer.trim() || undefined,
      producer: producer.trim() || undefined,
      notes: notes.trim() || undefined,
      coverArtUrl: coverArtUrl || undefined,
      customTags: customTags.filter(t => t.key.trim().length > 0),
      embeddedSyncedLyrics: embeddedSyncedLyrics.trim() || undefined,
      embeddedStaticLyrics: embeddedStaticLyrics.trim() || undefined,
      localSyncedLyrics: localSyncedLyrics.trim() || undefined,
      offlineStaticLyrics: offlineStaticLyrics.trim() || undefined,
      onlineSyncedLyrics: onlineSyncedLyrics.trim() || undefined,
      onlineStaticLyrics: onlineStaticLyrics.trim() || undefined,
      lyricsSource: resolved.source,
      lyricsCachedAt: (onlineSyncedLyrics || onlineStaticLyrics) ? new Date().toISOString() : undefined,
    };

    onSave(updated);
    onClose();
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
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-outline)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Edit Song Metadata & Lyrics
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Modify title, artist, smart album grouping, cover art, custom tags, and 6-tier lyrics.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-text"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SECTOR 1: CORE IDENTITY & ALBUM */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: '12px' }}>
              Sector 1: Core Track Identity & Album
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Track Title *</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Artist Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Album Name (Smart Auto-Grouping) *</label>
                <input
                  type="text"
                  className="input-field"
                  value={album}
                  onChange={e => setAlbum(e.target.value)}
                  placeholder="Songs with identical album are auto-grouped"
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Album Artist</label>
                <input
                  type="text"
                  className="input-field"
                  value={albumArtist}
                  onChange={e => setAlbumArtist(e.target.value)}
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Track Number</label>
                <input
                  type="number"
                  className="input-field"
                  value={trackNumber}
                  onChange={e => setTrackNumber(e.target.value)}
                  placeholder="1, 2, 3..."
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Disc Number</label>
                <input
                  type="number"
                  className="input-field"
                  value={discNumber}
                  onChange={e => setDiscNumber(e.target.value)}
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Genre</label>
                <input
                  type="text"
                  className="input-field"
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  placeholder="Pop, Synthwave, Rock..."
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Release Year</label>
                <input
                  type="text"
                  className="input-field"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="2026"
                  style={{ width: '100%', height: '38px' }}
                />
              </div>
            </div>
          </div>

          {/* SECTOR 2: MUSICAL CHARACTERISTICS */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#3CC4B2', marginBottom: '12px' }}>
              Sector 2: Musical Characteristics & Theory
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Tempo (BPM)</label>
                <input
                  type="number"
                  className="input-field"
                  value={bpm}
                  onChange={e => setBpm(e.target.value)}
                  placeholder="120"
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Root Key</label>
                <input
                  type="text"
                  className="input-field"
                  value={rootKey}
                  onChange={e => setRootKey(e.target.value)}
                  placeholder="C, Am, F#..."
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Mood</label>
                <input
                  type="text"
                  className="input-field"
                  value={mood}
                  onChange={e => setMood(e.target.value)}
                  placeholder="Energetic, Melancholic..."
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Purpose</label>
                <input
                  type="text"
                  className="input-field"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Driving, Workout..."
                  style={{ width: '100%', height: '38px' }}
                />
              </div>
            </div>
          </div>

          {/* SECTOR 3: PRODUCTION, CREDITS & COVER ART */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#FFB020', marginBottom: '12px' }}>
              Sector 3: Production, Credits & Cover Art
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Cover Art Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-container)',
                    border: '1px solid var(--color-outline)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {coverArtUrl ? (
                    <img src={coverArtUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="material-icons-round" style={{ fontSize: '48px', color: 'var(--color-text-secondary)' }}>
                      album
                    </span>
                  )}
                </div>

                <label
                  className="btn btn-tonal"
                  style={{ fontSize: '11px', height: '28px', padding: '0 8px', cursor: 'pointer', textAlign: 'center' }}
                >
                  Change Cover
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {coverArtUrl && (
                  <button
                    onClick={() => setCoverArtUrl('')}
                    className="btn-text"
                    style={{ fontSize: '11px', color: '#FF453A', padding: '2px 6px' }}
                  >
                    Remove Cover
                  </button>
                )}
              </div>

              {/* Credits & Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Composer / Songwriter</label>
                    <input
                      type="text"
                      className="input-field"
                      value={composer}
                      onChange={e => setComposer(e.target.value)}
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Producer</label>
                    <input
                      type="text"
                      className="input-field"
                      value={producer}
                      onChange={e => setProducer(e.target.value)}
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Arrangement Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Vocal registers, drum mix nuances, mastering notes..."
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTOR 4: CUSTOM KEY-VALUE METADATA */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B7A6FF', margin: 0 }}>
                Sector 4: Custom Key-Value Tags
              </h3>
              <button
                onClick={handleAddCustomTag}
                className="btn btn-tonal"
                style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>add</span>
                Add Custom Tag
              </button>
            </div>

            {customTags.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '12px', backgroundColor: 'var(--color-container)', borderRadius: '6px' }}>
                No custom metadata tags added. Click "Add Custom Tag" to store attributes such as ISRC, Record Label, Studio Mic, or Copyright.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customTags.map((tag, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Tag Name (e.g. ISRC, Label)"
                      value={tag.key}
                      onChange={e => handleUpdateCustomTag(idx, 'key', e.target.value)}
                      style={{ flex: '0 0 200px', height: '36px' }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Tag Value"
                      value={tag.value}
                      onChange={e => handleUpdateCustomTag(idx, 'value', e.target.value)}
                      style={{ flex: 1, height: '36px' }}
                    />
                    <button
                      onClick={() => handleRemoveCustomTag(idx)}
                      className="btn-text"
                      style={{ width: '32px', height: '32px', padding: 0 }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '18px' }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTOR 5: 6-TIER LYRICS RESOLUTION & CACHE */}
          <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', margin: 0 }}>
                  Sector 5: 6-Tier Lyrics Engine & Cache
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Active Resolution:</span>
                  <span
                    className="chip"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        resolved.source === 'embedded_synced'
                          ? 'rgba(0, 230, 118, 0.25)'
                          : resolved.source === 'embedded_static'
                          ? 'rgba(0, 176, 255, 0.25)'
                          : resolved.source === 'local_synced'
                          ? 'rgba(40, 200, 100, 0.2)'
                          : resolved.source === 'online_synced'
                          ? 'rgba(60, 196, 178, 0.2)'
                          : resolved.source === 'offline_static'
                          ? 'rgba(255, 176, 32, 0.2)'
                          : resolved.source === 'online_static'
                          ? 'rgba(183, 166, 255, 0.2)'
                          : 'var(--color-container)',
                      color:
                        resolved.source === 'embedded_synced'
                          ? '#00E676'
                          : resolved.source === 'embedded_static'
                          ? '#00B0FF'
                          : resolved.source === 'local_synced'
                          ? '#28c864'
                          : resolved.source === 'online_synced'
                          ? '#3CC4B2'
                          : resolved.source === 'offline_static'
                          ? '#FFB020'
                          : resolved.source === 'online_static'
                          ? '#B7A6FF'
                          : 'var(--color-text-secondary)',
                    }}
                  >
                    {resolved.label}
                  </span>
                </div>
              </div>

              {/* Force Re-fetch LRCLIB */}
              <button
                onClick={handleForceRefetchLyrics}
                disabled={isFetchingLrc}
                className="btn btn-tonal"
                style={{ height: '36px', padding: '0 14px', fontSize: '12px' }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  {isFetchingLrc ? 'sync' : 'cloud_download'}
                </span>
                {isFetchingLrc ? 'Fetching from LRCLIB...' : 'Force Re-fetch LRCLIB'}
              </button>
            </div>

            {statusMessage && (
              <div
                style={{
                  fontSize: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-container)',
                  borderRadius: '4px',
                  marginBottom: '14px',
                  color: 'var(--color-text-high)',
                }}
              >
                {statusMessage}
              </div>
            )}

            {/* Row 1: Priorities 1 & 2 (Engraved in Audio File) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Priority 1: Engraved Synced Lyrics (In Audio File)
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  value={embeddedSyncedLyrics}
                  onChange={e => setEmbeddedSyncedLyrics(e.target.value)}
                  placeholder="[00:12.45]Engraved synced lyric line from SYLT/USLT..."
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px', padding: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Priority 2: Engraved Static Lyrics (In Audio File)
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  value={embeddedStaticLyrics}
                  onChange={e => setEmbeddedStaticLyrics(e.target.value)}
                  placeholder="Engraved plain lyric text from USLT..."
                  style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                />
              </div>
            </div>

            {/* Row 2: Priorities 3 & 5 (Local Companion Files) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Priority 3: Local Companion Synced (.lrc file)
                </label>
                <textarea
                  className="input-field"
                  rows={5}
                  value={localSyncedLyrics}
                  onChange={e => setLocalSyncedLyrics(e.target.value)}
                  placeholder="[00:12.45]First synced line&#10;[00:16.80]Second synced line..."
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px', padding: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Priority 5: Local Companion Static (.txt file)
                </label>
                <textarea
                  className="input-field"
                  rows={5}
                  value={offlineStaticLyrics}
                  onChange={e => setOfflineStaticLyrics(e.target.value)}
                  placeholder="First plain lyric line&#10;Second plain lyric line..."
                  style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                />
              </div>
            </div>

            {/* Row 3: Priorities 4 & 6 (Persistent Online Cache from LRCLIB) */}
            {(onlineSyncedLyrics || onlineStaticLyrics) && (
              <div style={{ marginTop: '14px', padding: '12px', backgroundColor: 'var(--color-container)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Persistent Online Cache (Priorities 4 & 6: LRCLIB)
                  </span>
                  <button
                    onClick={() => {
                      setOnlineSyncedLyrics('');
                      setOnlineStaticLyrics('');
                      setStatusMessage('Online cached lyrics cleared for this track.');
                    }}
                    className="btn-text"
                    style={{ fontSize: '11px', color: '#FF453A', padding: '2px 6px' }}
                  >
                    Clear Online Cache
                  </button>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-medium)', maxHeight: '80px', overflowY: 'auto' }}>
                  {onlineSyncedLyrics || onlineStaticLyrics}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-outline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button onClick={onClose} className="btn btn-tonal" style={{ height: '38px', padding: '0 18px' }}>
            Cancel
          </button>
          <button onClick={handleSaveAll} className="btn btn-primary" style={{ height: '38px', padding: '0 20px', fontWeight: 600 }}>
            <span className="material-icons-round">save</span>
            Save Track Metadata
          </button>
        </div>
      </div>
    </div>
  );
};

