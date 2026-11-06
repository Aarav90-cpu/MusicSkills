import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  loadStudioStats,
  loadPlaylists,
  createPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
  toggleFavoriteTrack,
  isTrackFavorite,
  recordGenrePlay,
  StudioStats,
  Playlist,
} from '../utils/libraryStorage';
import {
  LibraryTrack,
  loadLibraryTracks,
  saveLibraryTracks,
  parseFolderFiles,
  getSmartAlbums,
  getSmartArtists,
  getSmartGenres,
  resolveTrackLyrics,
  fetchAndCacheLyricsForTrack,
} from '../utils/trackLibrary';
import { TrackMetadataModal } from '../components/TrackMetadataModal';

export const StatsPage: React.FC = () => {
  const { chats, playTrack, setActiveChatId, setRoute, showSnackbar } = useApp();

  // Local state
  const [stats, setStats] = useState<StudioStats>(loadStudioStats());
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists());
  const [importedTracks, setImportedTracks] = useState<LibraryTrack[]>(loadLibraryTracks());
  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists' | 'genres' | 'playlists' | 'favorites' | 'analytics'>('tracks');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration' | 'date'>('date');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingTrack, setEditingTrack] = useState<LibraryTrack | null>(null);
  const [isImportingFolder, setIsImportingFolder] = useState(false);

  // File and Folder input refs
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Periodic refresh of live stats & library
  useEffect(() => {
    setStats(loadStudioStats());
    setPlaylists(loadPlaylists());
    setImportedTracks(loadLibraryTracks());
  }, []);

  // Merge studio generated chats with imported tracks
  const generatedTracks: LibraryTrack[] = useMemo(() => {
    return chats
      .filter(c => c.versions && c.versions.length > 0)
      .map(c => {
        const latest = c.versions[c.versions.length - 1];
        return {
          id: c.id,
          title: c.name,
          artist: 'AI Studio Producer',
          album: 'Studio Master Compositions',
          genre: c.style?.genre || 'Pop',
          bpm: c.style?.bpm || 120,
          rootKey: c.style?.key || 'C',
          mood: (c.style?.moods && c.style?.moods[0]) || 'energetic',
          purpose: (c.style?.purposes && c.style?.purposes[0]) || 'creative',
          durationSec: latest.durationSec || 180,
          audioUrl: `/api/audio/${c.id}/${latest.mp3File}`,
          dateAdded: c.createdAt,
          fileSource: 'generated',
          lyricsSource: 'local_synced',
          customTags: [],
        };
      });
  }, [chats]);

  // Combined tracks universe
  const allTracks: LibraryTrack[] = useMemo(() => {
    return [...generatedTracks, ...importedTracks];
  }, [generatedTracks, importedTracks]);

  // Filtered and Sorted Tracks
  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = allTracks.filter(t => {
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'album') return a.album.localeCompare(b.album);
      if (sortBy === 'duration') return (b.durationSec || 0) - (a.durationSec || 0);
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    });

    return result;
  }, [allTracks, searchQuery, sortBy]);

  // Smart Auto-Grouping
  const smartAlbums = useMemo(() => getSmartAlbums(allTracks), [allTracks]);
  const smartArtists = useMemo(() => getSmartArtists(allTracks), [allTracks]);
  const smartGenres = useMemo(() => getSmartGenres(allTracks), [allTracks]);
  const favoriteTracks = useMemo(() => allTracks.filter(t => isTrackFavorite(t.id)), [allTracks]);

  // Real Dynamic Metrics calculation
  const totalDurationSecs = useMemo(() => allTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0), [allTracks]);
  const liveGenreDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTracks) {
      const g = (t.genre || 'Other').toLowerCase();
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [allTracks]);

  const formatHoursMins = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  // Play track through global audio player
  const handlePlayTrack = (track: LibraryTrack) => {
    recordGenrePlay(track.genre);
    playTrack({
      chatId: track.id,
      songName: track.title,
      version: 'v1',
      mp3Url: track.audioUrl,
      midiUrl: track.audioUrl.endsWith('.mid') ? track.audioUrl : '',
      durationSec: track.durationSec,
      bpm: track.bpm || 120,
      lyrics: {},
    });
    showSnackbar(`Playing "${track.title}" by ${track.artist}`);
  };

  // Folder Import Handler
  const handleFolderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImportingFolder(true);
    showSnackbar('Scanning folder and auto-organizing albums and lyrics...');

    try {
      const result = await parseFolderFiles(files);
      setImportedTracks(loadLibraryTracks());
      showSnackbar(
        `Imported ${result.totalScanned} audio files! Created ${result.createdAlbumsCount} smart albums (${result.matchedLrcCount} local synced lyrics matched).`
      );
    } catch (err: any) {
      showSnackbar(`Folder import failed: ${err.message || 'Error reading files'}`);
    } finally {
      setIsImportingFolder(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Single or Multi File Import Handler
  const handleSongImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImportingFolder(true);
    try {
      const result = await parseFolderFiles(files);
      setImportedTracks(loadLibraryTracks());
      showSnackbar(`Imported ${result.totalScanned} tracks successfully!`);
    } catch (err: any) {
      showSnackbar(`File import failed: ${err.message}`);
    } finally {
      setIsImportingFolder(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Metadata Save Handler
  const handleSaveTrackMetadata = (updated: LibraryTrack) => {
    const current = loadLibraryTracks();
    const idx = current.findIndex(t => t.id === updated.id);
    if (idx !== -1) {
      current[idx] = updated;
      saveLibraryTracks(current);
      setImportedTracks([...current]);
      showSnackbar(`Updated metadata for "${updated.title}"`);
    } else {
      // If it is a studio generated track being customized
      const merged = [...current, updated];
      saveLibraryTracks(merged);
      setImportedTracks(merged);
      showSnackbar(`Saved custom metadata for "${updated.title}"`);
    }
  };

  // Force Re-fetch LRCLIB from track row
  const handleQuickForceLRCLib = async (track: LibraryTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    showSnackbar(`Querying LRCLIB for "${track.title}"...`);
    try {
      const updated = await fetchAndCacheLyricsForTrack(track, true);
      handleSaveTrackMetadata(updated);
      showSnackbar(`Lyrics cached from LRCLIB for "${track.title}"!`);
    } catch (err: any) {
      showSnackbar(`LRCLIB error: ${err.message}`);
    }
  };

  // Create Playlist Handler
  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const pl = createPlaylist(newPlaylistName.trim());
    setPlaylists(loadPlaylists());
    setNewPlaylistName('');
    showSnackbar(`Created playlist "${pl.name}"`);
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '32px 24px 100px 24px' }}>
      {/* Hidden inputs for folder and file selection */}
      <input
        type="file"
        ref={folderInputRef}
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        onChange={handleFolderImport}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.mid,.midi"
        multiple
        onChange={handleSongImport}
        style={{ display: 'none' }}
      />

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '28px' }}>
              library_music
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>
              Studio Library, Player & Analytics
            </h1>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>
            Manage generated and folder-imported tracks, smart albums, 4-tier synced lyrics cache, and true session analytics.
          </p>
        </div>

        {/* Action Buttons: Import Folder & Audio */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={isImportingFolder}
            className="btn btn-tonal"
            style={{ height: '38px', padding: '0 16px', fontWeight: 600, fontSize: '13px' }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
              snippet_folder
            </span>
            {isImportingFolder ? 'Importing Folder...' : 'Import Folder'}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImportingFolder}
            className="btn btn-tonal"
            style={{ height: '38px', padding: '0 16px', fontWeight: 600, fontSize: '13px' }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>
              audio_file
            </span>
            Import Audio Tracks
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px',
          border: '1px solid var(--color-outline)',
          marginBottom: '24px',
          overflowX: 'auto',
          gap: '4px',
        }}
      >
        {[
          { id: 'tracks', label: `All Tracks (${allTracks.length})`, icon: 'music_note' },
          { id: 'albums', label: `Smart Albums (${smartAlbums.length})`, icon: 'album' },
          { id: 'artists', label: `Artists (${smartArtists.length})`, icon: 'person' },
          { id: 'genres', label: `Genres (${smartGenres.length})`, icon: 'category' },
          { id: 'playlists', label: `Playlists (${playlists.length})`, icon: 'playlist_play' },
          { id: 'favorites', label: `Favorites (${favoriteTracks.length})`, icon: 'star' },
          { id: 'analytics', label: 'Studio Analytics', icon: 'analytics' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: activeTab === t.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === t.id ? '#000000' : 'var(--color-text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '16px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* --- TAB 1: ALL TRACKS --- */}
      {activeTab === 'tracks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search & Sort Controls */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <span
                className="material-icons-round"
                style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '18px', color: 'var(--color-text-secondary)' }}
              >
                search
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="Search tracks by title, artist, album, genre..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', height: '38px', paddingLeft: '38px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Sort By:</span>
              <select
                className="input-field"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{ height: '38px', padding: '0 12px', fontSize: '13px' }}
              >
                <option value="date">Date Added</option>
                <option value="title">Title (A-Z)</option>
                <option value="artist">Artist (A-Z)</option>
                <option value="album">Album</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>

          {/* Track List Table */}
          {filteredTracks.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <span className="material-icons-round" style={{ fontSize: '48px', color: 'var(--color-outline)', marginBottom: '12px' }}>
                folder_open
              </span>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)' }}>No Tracks Found</div>
              <p style={{ fontSize: '13px', maxWidth: '420px', margin: '8px auto 20px auto' }}>
                Your library is currently clean. Click "Import Folder" to load an album or discography with synced lyrics, or create a new song with the AI co-writer.
              </p>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="btn btn-primary"
                style={{ height: '38px', padding: '0 20px', fontWeight: 600 }}
              >
                <span className="material-icons-round">snippet_folder</span>
                Import Music Folder
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 1fr 1fr 100px 140px 100px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-outline)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <div>#</div>
                <div>Title</div>
                <div>Artist</div>
                <div>Album</div>
                <div>Duration</div>
                <div>Lyrics Priority</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>

              {filteredTracks.map((track, idx) => {
                const resolved = resolveTrackLyrics(track);
                const isFav = isTrackFavorite(track.id);

                return (
                  <div
                    key={track.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 1fr 1fr 100px 140px 100px',
                      padding: '12px 16px',
                      borderBottom: idx < filteredTracks.length - 1 ? '1px solid var(--color-outline)' : 'none',
                      alignItems: 'center',
                      fontSize: '13px',
                      transition: 'background-color 0.15s ease',
                    }}
                    className="track-row"
                  >
                    {/* Play Button / Number */}
                    <button
                      onClick={() => handlePlayTrack(track)}
                      className="btn-text"
                      style={{ width: '28px', height: '28px', padding: 0 }}
                      title="Play track"
                    >
                      <span className="material-icons-round" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                        play_circle_outline
                      </span>
                    </button>

                    {/* Title */}
                    <div style={{ fontWeight: 600, color: 'var(--color-text-high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.title}
                    </div>

                    {/* Artist */}
                    <div style={{ color: 'var(--color-text-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.artist}
                    </div>

                    {/* Album */}
                    <div style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.album}
                    </div>

                    {/* Duration */}
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {Math.floor(track.durationSec / 60)}:{(track.durationSec % 60).toString().padStart(2, '0')}
                    </div>

                    {/* Lyrics Priority Badge */}
                    <div>
                      <span
                        className="chip"
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor:
                            resolved.source === 'local_synced'
                              ? 'rgba(40, 200, 100, 0.2)'
                              : resolved.source === 'online_synced'
                              ? 'rgba(60, 196, 178, 0.2)'
                              : resolved.source === 'offline_static'
                              ? 'rgba(255, 176, 32, 0.2)'
                              : resolved.source === 'online_static'
                              ? 'rgba(183, 166, 255, 0.2)'
                              : 'var(--color-container)',
                          color:
                            resolved.source === 'local_synced'
                              ? '#28c864'
                              : resolved.source === 'online_synced'
                              ? '#3CC4B2'
                              : resolved.source === 'offline_static'
                              ? '#FFB020'
                              : resolved.source === 'online_static'
                              ? '#B7A6FF'
                              : 'var(--color-text-secondary)',
                          whiteSpace: 'nowrap',
                          padding: '2px 8px',
                          height: '22px',
                        }}
                        title={resolved.label}
                      >
                        {resolved.source === 'local_synced'
                          ? 'P1 Local Synced'
                          : resolved.source === 'online_synced'
                          ? 'P2 Online Cached'
                          : resolved.source === 'offline_static'
                          ? 'P3 Offline Static'
                          : resolved.source === 'online_static'
                          ? 'P4 Online Static'
                          : 'No Lyrics'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {/* Force LRCLIB */}
                      <button
                        onClick={e => handleQuickForceLRCLib(track, e)}
                        className="btn-text"
                        style={{ width: '28px', height: '28px', padding: 0 }}
                        title="Force re-fetch lyrics from LRCLIB"
                      >
                        <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
                          sync
                        </span>
                      </button>

                      {/* Favorite Star */}
                      <button
                        onClick={() => {
                          toggleFavoriteTrack(track.id);
                          setStats(loadStudioStats());
                        }}
                        className="btn-text"
                        style={{ width: '28px', height: '28px', padding: 0 }}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <span className="material-icons-round" style={{ fontSize: '18px', color: isFav ? '#FFB020' : 'var(--color-text-secondary)' }}>
                          {isFav ? 'star' : 'star_border'}
                        </span>
                      </button>

                      {/* Edit Metadata Modal */}
                      <button
                        onClick={() => setEditingTrack(track)}
                        className="btn-text"
                        style={{ width: '28px', height: '28px', padding: 0 }}
                        title="Edit metadata in every sector"
                      >
                        <span className="material-icons-round" style={{ fontSize: '16px' }}>edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: SMART ALBUMS --- */}
      {activeTab === 'albums' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Songs sharing the same album name are automatically unified into high-fidelity album collections.
          </div>

          {smartAlbums.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No albums assembled yet. Import songs with album tags or edit existing tracks to assign an album name.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {smartAlbums.map(album => (
                <div key={album.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-container)',
                        border: '1px solid var(--color-outline)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {album.coverArtUrl ? (
                        <img src={album.coverArtUrl} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span className="material-icons-round" style={{ fontSize: '36px', color: 'var(--color-primary)' }}>
                          album
                        </span>
                      )}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {album.name}
                      </h3>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-medium)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {album.artist}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        {album.tracks.length} tracks · {formatHoursMins(album.totalDurationSec)}
                      </div>
                    </div>
                  </div>

                  {/* Album Track List preview */}
                  <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {album.tracks.map((t, idx) => (
                      <div
                        key={t.id}
                        onClick={() => handlePlayTrack(t)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-container)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ color: 'var(--color-text-secondary)', width: '16px' }}>{idx + 1}</span>
                          <span style={{ fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.title}</span>
                        </div>
                        <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                          play_circle
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: SMART ARTISTS --- */}
      {activeTab === 'artists' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {smartArtists.map(artist => (
            <div key={artist.name} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(183, 166, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                  }}
                >
                  <span className="material-icons-round">person</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{artist.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {artist.tracks.length} tracks · {artist.albums.length} albums
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {artist.tracks.slice(0, 4).map(t => (
                  <div
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                      {Math.floor(t.durationSec / 60)}:{(t.durationSec % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 4: SMART GENRES --- */}
      {activeTab === 'genres' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {smartGenres.map(g => (
            <div key={g.name} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{g.name}</h3>
                <span className="chip" style={{ fontSize: '11px', height: '22px' }}>
                  {g.tracks.length} tracks
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Total genre duration: {formatHoursMins(g.totalDurationSec)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--color-outline)', paddingTop: '8px' }}>
                {g.tracks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    style={{ fontSize: '12px', padding: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{t.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 5: PLAYLISTS --- */}
      {activeTab === 'playlists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

          {playlists.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No custom playlists created yet. Enter a playlist name above to start building your playlists.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {playlists.map(pl => (
                <div key={pl.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>{pl.name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {pl.trackIds.length} tracks
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        deletePlaylist(pl.id);
                        setPlaylists(loadPlaylists());
                      }}
                      className="btn-text"
                      style={{ padding: 0, width: '28px', height: '28px' }}
                      title="Delete playlist"
                    >
                      <span className="material-icons-round" style={{ fontSize: '16px', color: '#FF453A' }}>delete</span>
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pl.trackIds.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '12px 0', textAlign: 'center' }}>
                        No tracks added yet.
                      </div>
                    ) : (
                      pl.trackIds.map(tid => {
                        const trk = allTracks.find(t => t.id === tid);
                        return (
                          <div
                            key={tid}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--color-container)' }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{trk?.title || 'Unknown Track'}</span>
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
          )}
        </div>
      )}

      {/* --- TAB 6: FAVORITES --- */}
      {activeTab === 'favorites' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Favorite Tracks</h2>
          {favoriteTracks.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No tracks marked as favorite yet. Click the star next to any song in the All Tracks list to favorite it.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {favoriteTracks.map(trk => (
                <div
                  key={trk.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-container)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => handlePlayTrack(trk)}
                      className="btn-text"
                      style={{ padding: 0, width: '32px', height: '32px' }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '24px', color: 'var(--color-primary)' }}>
                        play_circle
                      </span>
                    </button>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{trk.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {trk.artist} · {trk.album}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      toggleFavoriteTrack(trk.id);
                      setStats(loadStudioStats());
                    }}
                    className="btn-text"
                    style={{ padding: 0, width: '32px', height: '32px' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '20px', color: '#FFB020' }}>
                      star
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 7: TRUE ZERO-PLACEHOLDER ANALYTICS --- */}
      {activeTab === 'analytics' && (
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
                Actual playback recorded in studio audio player
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
                Active time in Python Code Editor & chat sessions
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFB020' }}>
                <span className="material-icons-round">token</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Tokens Processed</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {stats.promptTokens + stats.completionTokens > 0
                  ? `${((stats.promptTokens + stats.completionTokens) / 1000).toFixed(1)}k`
                  : '0'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {stats.promptTokens.toLocaleString()} in · {stats.completionTokens.toLocaleString()} out
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF4FA3' }}>
                <span className="material-icons-round">library_music</span>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Library Tracks</span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: 'monospace' }}>
                {allTracks.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {generatedTracks.length} generated · {importedTracks.length} imported
              </div>
            </div>
          </div>

          {/* Real Dynamic Genre Distribution */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>True Library Genre Distribution</h3>
            {Object.keys(liveGenreDistribution).length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '20px 0', textAlign: 'center' }}>
                No genre data yet. Import tracks or generate songs to populate the distribution.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(liveGenreDistribution).map(([genre, count]) => {
                  const pct = Math.round((count / Math.max(1, allTracks.length)) * 100);
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
            )}
          </div>
        </div>
      )}

      {/* Metadata Editor Modal */}
      <TrackMetadataModal
        track={editingTrack}
        isOpen={Boolean(editingTrack)}
        onClose={() => setEditingTrack(null)}
        onSave={handleSaveTrackMetadata}
      />
    </div>
  );
};
