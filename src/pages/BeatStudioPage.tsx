import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { StudioTrack, StudioClip, StudioNote } from '../types';
import { dawAudioEngine, pitchToFrequency } from '../utils/dawAudioEngine';
import { BEAT_PRESETS, BeatPreset } from '../utils/beatPresets';
import { StepSequencer } from '../components/studio/StepSequencer';
import { PianoRoll } from '../components/studio/PianoRoll';
import { TimelineArranger } from '../components/studio/TimelineArranger';
import { CoverDuplicateModal } from '../components/studio/CoverDuplicateModal';

const DEFAULT_TRACKS: StudioTrack[] = [
  { id: 't_drums', name: 'Drums / Beat', type: 'drums', instrument: 'drums', volume: 0.9, pan: 0, isMuted: false, isSolo: false, color: '#ff5252' },
  { id: 't_bass', name: '808 & Bassline', type: 'bass', instrument: 'bass', volume: 0.85, pan: 0, isMuted: false, isSolo: false, color: '#7c4dff' },
  { id: 't_piano', name: 'Piano & Chords', type: 'piano', instrument: 'piano', volume: 0.8, pan: -0.1, isMuted: false, isSolo: false, color: '#00b0ff' },
  { id: 't_synth', name: 'Lead & Synth', type: 'synth', instrument: 'synth', volume: 0.75, pan: 0.1, isMuted: false, isSolo: false, color: '#00e676' },
  { id: 't_audio', name: 'Vocals & Audio Clips', type: 'audio', instrument: 'audio', volume: 0.9, pan: 0, isMuted: false, isSolo: false, color: '#ffd600' },
];

export const BeatStudioPage: React.FC = () => {
  const { activeChat, setActiveChatId, refreshChats, showSnackbar, playTrack } = useApp();

  // Studio Settings State
  const [bpm, setBpm] = useState<number>(activeChat?.style?.bpm || 120);
  const [songKey, setSongKey] = useState<string>(activeChat?.style?.key || 'C');
  const [songScale, setSongScale] = useState<string>(activeChat?.style?.scale || 'major');
  const [totalBars, setTotalBars] = useState<number>(16);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.85);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentBar, setCurrentBar] = useState<number>(1);
  const [startBar, setStartBar] = useState<number>(1);

  // View Layout: 'split' | 'arranger' | 'drums' | 'piano'
  const [viewMode, setViewMode] = useState<'split' | 'arranger' | 'drums' | 'piano'>('split');

  // Multi-track and Clips State
  const [tracks, setTracks] = useState<StudioTrack[]>(DEFAULT_TRACKS);
  const [clips, setClips] = useState<StudioClip[]>([
    { id: 'c_drums_1', trackId: 't_drums', name: 'Drum Pattern', startBar: 1, durationBars: 8, color: '#ff5252' },
    { id: 'c_bass_1', trackId: 't_bass', name: 'Bass Groove', startBar: 1, durationBars: 8, color: '#7c4dff' },
    { id: 'c_piano_1', trackId: 't_piano', name: 'Piano Chords', startBar: 1, durationBars: 8, color: '#00b0ff' },
  ]);

  // Drum Pattern State (16 steps)
  const [drumSteps, setDrumSteps] = useState({
    kick:        [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
    snare:       [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
    hihatClosed: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
    hihatOpen:   [false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true,  false],
    clap:        [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
    sub808:      [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    perc:        [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false, false],
  });

  // Piano Roll Notes State
  const [pianoNotes, setPianoNotes] = useState<StudioNote[]>([
    { id: 'n1', pitch: 'C4', step: 0, durationSteps: 4, velocity: 0.8 },
    { id: 'n2', pitch: 'E4', step: 0, durationSteps: 4, velocity: 0.75 },
    { id: 'n3', pitch: 'G4', step: 0, durationSteps: 4, velocity: 0.75 },
    { id: 'n4', pitch: 'G3', step: 8, durationSteps: 4, velocity: 0.8 },
    { id: 'n5', pitch: 'B3', step: 8, durationSteps: 4, velocity: 0.75 },
    { id: 'n6', pitch: 'D4', step: 8, durationSteps: 4, velocity: 0.75 },
  ]);

  const [activeInstrument, setActiveInstrument] = useState<'piano' | 'bass' | 'synth' | 'pluck'>('piano');
  const [showCoverModal, setShowCoverModal] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Tap tempo state
  const lastTapRef = useRef<number>(0);
  const tapIntervalsRef = useRef<number[]>([]);

  // Load existing arrangement from chat if available
  useEffect(() => {
    if (activeChat?.studioArrangement) {
      const arr = activeChat.studioArrangement;
      if (arr.bpm) setBpm(arr.bpm);
      if (arr.key) setSongKey(arr.key);
      if (arr.scale) setSongScale(arr.scale);
      if (arr.totalBars) setTotalBars(arr.totalBars);
      if (arr.tracks) setTracks(arr.tracks);
      if (arr.clips) setClips(arr.clips);
      if (arr.patterns?.drums?.steps) {
        // Restore drum steps
      }
      if (arr.patterns?.piano?.notes) {
        setPianoNotes(arr.patterns.piano.notes);
      }
    }
  }, [activeChat]);

  // Handle Tap Tempo
  const handleTapTempo = () => {
    const now = Date.now();
    if (lastTapRef.current > 0) {
      const diff = now - lastTapRef.current;
      if (diff > 200 && diff < 2000) {
        tapIntervalsRef.current.push(diff);
        if (tapIntervalsRef.current.length > 4) tapIntervalsRef.current.shift();
        const avg = tapIntervalsRef.current.reduce((a, b) => a + b, 0) / tapIntervalsRef.current.length;
        const calculatedBpm = Math.round(60000 / avg);
        setBpm(Math.max(40, Math.min(240, calculatedBpm)));
      }
    }
    lastTapRef.current = now;
  };

  // Playback Control
  const handleTogglePlay = () => {
    if (isPlaying) {
      dawAudioEngine.stopPlayback();
      setIsPlaying(false);
    } else {
      dawAudioEngine.initContext();
      setIsPlaying(true);

      const startStep = (startBar - 1) * 16;
      dawAudioEngine.startPlayback(
        bpm,
        totalBars,
        (stepIdx, barNum) => {
          setCurrentStepIndex(stepIdx);
          setCurrentBar(barNum);
        },
        (stepIdx, audioTime) => {
          // 1. Metronome Click
          if (metronomeEnabled && stepIdx % 4 === 0) {
            const isDownbeat = stepIdx % 16 === 0;
            dawAudioEngine.playMetronome(audioTime, isDownbeat);
          }

          const currentBarNum = Math.floor(stepIdx / 16) + 1;
          const stepInBar = stepIdx % 16;

          // 2. Schedule Drums if Drums Track is active
          const drumTrack = tracks.find(t => t.id === 't_drums');
          const isDrumClipActive = clips.some(
            c => c.trackId === 't_drums' && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars
          );

          if (drumTrack && !drumTrack.isMuted && isDrumClipActive) {
            const vol = drumTrack.volume * masterVolume;
            if (drumSteps.kick[stepInBar]) dawAudioEngine.playKick(audioTime, vol * 0.95);
            if (drumSteps.snare[stepInBar]) dawAudioEngine.playSnare(audioTime, vol * 0.85);
            if (drumSteps.hihatClosed[stepInBar]) dawAudioEngine.playHiHatClosed(audioTime, vol * 0.7);
            if (drumSteps.hihatOpen[stepInBar]) dawAudioEngine.playHiHatOpen(audioTime, vol * 0.7);
            if (drumSteps.clap[stepInBar]) dawAudioEngine.playClap(audioTime, vol * 0.85);
            if (drumSteps.sub808[stepInBar]) dawAudioEngine.play808Sub(audioTime, 'C2', 0.5, vol * 0.95);
            if (drumSteps.perc[stepInBar]) dawAudioEngine.playPerc(audioTime, vol * 0.75);
          }

          // 3. Schedule Piano / Chords if Piano Track is active
          const pianoTrack = tracks.find(t => t.id === 't_piano');
          const isPianoClipActive = clips.some(
            c => c.trackId === 't_piano' && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars
          );

          if (pianoTrack && !pianoTrack.isMuted && isPianoClipActive) {
            const vol = pianoTrack.volume * masterVolume;
            const matchingNotes = pianoNotes.filter(n => n.step === stepInBar);
            matchingNotes.forEach(note => {
              const freq = pitchToFrequency(note.pitch);
              const durSec = (note.durationSteps * 0.125);
              dawAudioEngine.playPianoNote(audioTime, freq, durSec, (note.velocity || 0.8) * vol);
            });
          }

          // 4. Schedule Bass Track
          const bassTrack = tracks.find(t => t.id === 't_bass');
          const isBassClipActive = clips.some(
            c => c.trackId === 't_bass' && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars
          );

          if (bassTrack && !bassTrack.isMuted && isBassClipActive) {
            const vol = bassTrack.volume * masterVolume;
            // Bass trigger on beat if note exists
            if (drumSteps.sub808[stepInBar]) {
              dawAudioEngine.playBassNote(audioTime, pitchToFrequency('C2'), 0.5, vol);
            }
          }
        },
        startStep
      );
    }
  };

  const handleStop = () => {
    dawAudioEngine.stopPlayback();
    setIsPlaying(false);
    setCurrentStepIndex((startBar - 1) * 16);
    setCurrentBar(startBar);
  };

  const handleScrubBar = (bar: number) => {
    setStartBar(bar);
    setCurrentBar(bar);
    setCurrentStepIndex((bar - 1) * 16);
    if (isPlaying) {
      handleTogglePlay(); // Restart from new bar
      setTimeout(handleTogglePlay, 50);
    }
  };

  // Drum Step Toggles
  const handleToggleDrumStep = (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc', stepIdx: number) => {
    setDrumSteps(prev => {
      const copy = [...prev[voice]];
      copy[stepIdx] = !copy[stepIdx];
      return { ...prev, [voice]: copy };
    });
  };

  const handleClearVoice = (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc') => {
    setDrumSteps(prev => ({
      ...prev,
      [voice]: Array(16).fill(false),
    }));
  };

  const handleFillVoice = (voice: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'clap' | 'sub808' | 'perc', interval: number) => {
    setDrumSteps(prev => {
      const copy = Array(16).fill(false);
      for (let i = 0; i < 16; i += interval) {
        copy[i] = true;
      }
      return { ...prev, [voice]: copy };
    });
  };

  // Piano Roll Note Handlers
  const handleAddPianoNote = (note: StudioNote) => {
    setPianoNotes(prev => [...prev.filter(n => !(n.pitch === note.pitch && n.step === note.step)), note]);
  };

  const handleRemovePianoNote = (noteId: string) => {
    setPianoNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleClearPianoNotes = () => {
    setPianoNotes([]);
  };

  // Timeline Clip Handlers
  const handleAddClip = (trackId: string, startBarNum: number) => {
    const track = tracks.find(t => t.id === trackId);
    const newClip: StudioClip = {
      id: `clip_${trackId}_${Date.now()}`,
      trackId,
      name: track ? `${track.name} Pattern` : 'Pattern',
      startBar: startBarNum,
      durationBars: 4,
      color: track?.color,
    };
    setClips(prev => [...prev, newClip]);
  };

  const handleUpdateClip = (clipId: string, updates: Partial<StudioClip>) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
  };

  const handleDeleteClip = (clipId: string) => {
    setClips(prev => prev.filter(c => c.id !== clipId));
  };

  const handleToggleMute = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
  };

  const handleToggleSolo = (trackId: string) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t));
  };

  const handleChangeVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
  };

  const handleChangePan = (trackId: string, pan: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, pan } : t));
  };

  // Audio Sample Upload
  const handleUploadAudioSample = async (
    e: React.ChangeEvent<HTMLInputElement>,
    trackId: string,
    startBarNum: number
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    showSnackbar(`Uploading audio clip "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const res = await fetch(`/api/chats/${activeChat.id}/upload-sample`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Decode buffer for immediate playback
        await dawAudioEngine.loadAudioSample(data.audioUrl);

        // Add clip to timeline
        const audioClip: StudioClip = {
          id: `audio_clip_${Date.now()}`,
          trackId,
          name: file.name.replace(/\.[^/.]+$/, ''),
          startBar: startBarNum,
          durationBars: 4,
          color: '#ffd600',
          audioUrl: data.audioUrl,
          audioFileName: data.filename,
        };
        setClips(prev => [...prev, audioClip]);
        showSnackbar(`Audio clip "${file.name}" placed on timeline at Bar ${startBarNum}!`);
      } else {
        const err = await res.json();
        showSnackbar(`Upload failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      showSnackbar(`Upload error: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Apply Precreated Beat Preset
  const handleApplyPreset = (preset: BeatPreset) => {
    setBpm(preset.bpm);
    setSongKey(preset.key);
    setSongScale(preset.scale);
    setDrumSteps(preset.drumSteps);
    setPianoNotes(preset.pianoNotes);

    // Arrange default 8-bar block
    setClips([
      { id: `c_d_${Date.now()}`, trackId: 't_drums', name: `${preset.name} Drums`, startBar: 1, durationBars: 8, color: '#ff5252' },
      { id: `c_b_${Date.now()}`, trackId: 't_bass', name: `${preset.name} Bass`, startBar: 1, durationBars: 8, color: '#7c4dff' },
      { id: `c_p_${Date.now()}`, trackId: 't_piano', name: `${preset.name} Chords`, startBar: 1, durationBars: 8, color: '#00b0ff' },
    ]);

    showSnackbar(`Loaded beat preset: "${preset.name}" (${preset.bpm} BPM)!`);
  };

  // Project Duplication & Cover
  const handleDuplicateProject = async (sourceChatId: string, asCover: boolean, customName?: string) => {
    try {
      const res = await fetch(`/api/chats/${sourceChatId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          asCover,
          bpm,
          genre: activeChat?.style?.genre || 'pop',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await refreshChats();
        setActiveChatId(data.chat.id);
        showSnackbar(asCover ? `Created cover project "${data.chat.name}"!` : `Duplicated project "${data.chat.name}"!`);
      } else {
        const err = await res.json();
        showSnackbar(`Duplication failed: ${err.error || 'Error'}`);
      }
    } catch (err: any) {
      showSnackbar(`Duplication error: ${err.message}`);
    }
  };

  // Save Arrangement to Backend
  const handleSaveArrangement = async () => {
    if (!activeChat) {
      showSnackbar('No active project selected. Duplicate or create a project first.');
      return;
    }

    try {
      const studioArrangement = {
        bpm,
        key: songKey,
        scale: songScale,
        timeSignature: '4/4',
        totalBars,
        tracks,
        clips,
        patterns: {
          drums: {
            id: 'p_drums',
            name: 'Main Drums',
            type: 'drums' as const,
            instrument: 'drums',
            steps: drumSteps.kick,
          },
          piano: {
            id: 'p_piano',
            name: 'Main Piano',
            type: 'notes' as const,
            instrument: 'piano',
            notes: pianoNotes,
          },
        },
      };

      const res = await fetch(`/api/chats/${activeChat.id}/studio-arrangement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioArrangement }),
      });

      if (res.ok) {
        await refreshChats();
        showSnackbar(`Saved studio beat arrangement for "${activeChat.name}"!`);
      } else {
        const err = await res.json();
        showSnackbar(`Save failed: ${err.error || 'Error'}`);
      }
    } catch (err: any) {
      showSnackbar(`Save error: ${err.message}`);
    }
  };

  // Offline Render WAV Master
  const handleRenderMaster = async () => {
    setIsRendering(true);
    showSnackbar('Synthesizing high-fidelity WAV master in offline audio engine...');

    try {
      const wavBlob = await dawAudioEngine.renderArrangementToWav(
        bpm,
        totalBars,
        (offlineCtx, stepDuration) => {
          for (let step = 0; step < totalBars * 16; step++) {
            const time = step * stepDuration;
            const currentBarNum = Math.floor(step / 16) + 1;
            const stepInBar = step % 16;

            // Drums
            const isDrumActive = clips.some(c => c.trackId === 't_drums' && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars);
            if (isDrumActive) {
              if (drumSteps.kick[stepInBar]) dawAudioEngine.playKick(time, 0.9, offlineCtx);
              if (drumSteps.snare[stepInBar]) dawAudioEngine.playSnare(time, 0.8, offlineCtx);
              if (drumSteps.hihatClosed[stepInBar]) dawAudioEngine.playHiHatClosed(time, 0.7, offlineCtx);
              if (drumSteps.hihatOpen[stepInBar]) dawAudioEngine.playHiHatOpen(time, 0.7, offlineCtx);
              if (drumSteps.clap[stepInBar]) dawAudioEngine.playClap(time, 0.8, offlineCtx);
              if (drumSteps.sub808[stepInBar]) dawAudioEngine.play808Sub(time, 'C2', 0.5, 0.9, offlineCtx);
              if (drumSteps.perc[stepInBar]) dawAudioEngine.playPerc(time, 0.7, offlineCtx);
            }

            // Piano Chords
            const isPianoActive = clips.some(c => c.trackId === 't_piano' && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars);
            if (isPianoActive) {
              const matchingNotes = pianoNotes.filter(n => n.step === stepInBar);
              matchingNotes.forEach(note => {
                const freq = pitchToFrequency(note.pitch);
                dawAudioEngine.playPianoNote(time, freq, note.durationSteps * 0.125, 0.8, offlineCtx);
              });
            }
          }
        }
      );

      // Download WAV file
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeChat?.name || 'Studio_Beat'}_master.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showSnackbar(`Render complete! Downloaded "${activeChat?.name || 'Studio_Beat'}_master.wav".`);
    } catch (err: any) {
      showSnackbar(`Render error: ${err.message}`);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Studio Control Bar */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-outline)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-l1)',
        }}
      >
        {/* Left: Transport Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleTogglePlay}
            className="btn btn-primary"
            style={{
              height: '42px',
              padding: '0 20px',
              borderRadius: 'var(--radius-full)',
              fontSize: '14px',
              fontWeight: 700,
              gap: '6px',
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '20px' }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={handleStop}
            className="btn btn-tonal"
            style={{ height: '42px', width: '42px', padding: 0, borderRadius: '50%' }}
            title="Stop & Reset to Start"
          >
            <span className="material-icons-round">stop</span>
          </button>

          {/* Time & Bar Position Indicator */}
          <div
            className="mono"
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--color-container)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Bar {currentBar}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>·</span>
            <span>Step {(currentStepIndex % 16) + 1}</span>
          </div>

          {/* Metronome Toggle */}
          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className="btn-text"
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              backgroundColor: metronomeEnabled ? 'var(--color-primary-container)' : 'transparent',
              color: metronomeEnabled ? 'var(--color-on-primary-container)' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Toggle Metronome Click"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>
              alarm
            </span>
            <span>Click</span>
          </button>
        </div>

        {/* Center: BPM, Key & Scale Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* BPM Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>BPM:</span>
            <input
              type="number"
              min="40"
              max="240"
              value={bpm}
              onChange={e => setBpm(parseInt(e.target.value, 10) || 120)}
              className="input-field"
              style={{ width: '64px', height: '36px', textAlign: 'center', fontSize: '14px', fontWeight: 700 }}
            />
            <button
              onClick={handleTapTempo}
              className="btn btn-outlined"
              style={{ height: '36px', padding: '0 10px', fontSize: '12px' }}
              title="Tap repeatedly to detect BPM"
            >
              Tap
            </button>
          </div>

          {/* Key Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Key:</span>
            <select
              className="input-field"
              value={songKey}
              onChange={e => setSongKey(e.target.value)}
              style={{ height: '36px', width: '60px', fontSize: '13px', cursor: 'pointer' }}
            >
              {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Scale Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Scale:</span>
            <select
              className="input-field"
              value={songScale}
              onChange={e => setSongScale(e.target.value)}
              style={{ height: '36px', width: '90px', fontSize: '13px', cursor: 'pointer' }}
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="dorian">Dorian</option>
              <option value="pentatonic">Pentatonic</option>
            </select>
          </div>
        </div>

        {/* Right: Cover/Duplication, Presets, Save & Render */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Cover & Presets Modal Button */}
          <button
            onClick={() => setShowCoverModal(true)}
            className="btn btn-tonal"
            style={{ height: '38px', padding: '0 14px', fontSize: '13px', gap: '6px' }}
            title="Use another project as cover, duplicate, or load beat presets"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>queue_music</span>
            <span>Covers & Presets</span>
          </button>

          {/* Save Arrangement */}
          <button
            onClick={handleSaveArrangement}
            className="btn btn-outlined"
            style={{ height: '38px', padding: '0 14px', fontSize: '13px', gap: '6px' }}
            title="Save arrangement to project"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>save</span>
            <span>Save</span>
          </button>

          {/* Render WAV Master */}
          <button
            onClick={handleRenderMaster}
            disabled={isRendering}
            className="btn btn-gradient"
            style={{ height: '38px', padding: '0 16px', fontSize: '13px', gap: '6px' }}
            title="Synthesize and render high-fidelity WAV master"
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>
              {isRendering ? 'sync' : 'file_download'}
            </span>
            <span>{isRendering ? 'Rendering...' : 'Render Audio'}</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setViewMode('split')}
            className={`btn ${viewMode === 'split' ? 'btn-primary' : 'btn-tonal'}`}
            style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
          >
            Split Studio View
          </button>
          <button
            onClick={() => setViewMode('arranger')}
            className={`btn ${viewMode === 'arranger' ? 'btn-primary' : 'btn-tonal'}`}
            style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
          >
            Timeline Playlist
          </button>
          <button
            onClick={() => setViewMode('drums')}
            className={`btn ${viewMode === 'drums' ? 'btn-primary' : 'btn-tonal'}`}
            style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
          >
            Step Sequencer
          </button>
          <button
            onClick={() => setViewMode('piano')}
            className={`btn ${viewMode === 'piano' ? 'btn-primary' : 'btn-tonal'}`}
            style={{ height: '34px', fontSize: '12px', padding: '0 12px' }}
          >
            Piano Roll
          </button>
        </div>

        {activeChat && (
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Project: <strong style={{ color: 'var(--color-text)' }}>{activeChat.name}</strong>
            {activeChat.coverOf && <span> (Cover of {activeChat.coverOf})</span>}
          </div>
        )}
      </div>

      {/* Main Studio Views */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Timeline Arranger (Visible in 'split' or 'arranger') */}
        {(viewMode === 'split' || viewMode === 'arranger') && (
          <TimelineArranger
            tracks={tracks}
            clips={clips}
            totalBars={totalBars}
            currentBar={currentBar}
            currentStepIndex={currentStepIndex}
            isPlaying={isPlaying}
            onAddClip={handleAddClip}
            onUpdateClip={handleUpdateClip}
            onDeleteClip={handleDeleteClip}
            onToggleMute={handleToggleMute}
            onToggleSolo={handleToggleSolo}
            onChangeVolume={handleChangeVolume}
            onChangePan={handleChangePan}
            onScrubBar={handleScrubBar}
            onUploadAudioSample={handleUploadAudioSample}
          />
        )}

        {/* Step Sequencer (Visible in 'split' or 'drums') */}
        {(viewMode === 'split' || viewMode === 'drums') && (
          <StepSequencer
            drumSteps={drumSteps}
            onToggleStep={handleToggleDrumStep}
            onClearVoice={handleClearVoice}
            onFillVoice={handleFillVoice}
            currentStepIndex={currentStepIndex}
            isPlaying={isPlaying}
          />
        )}

        {/* Piano Roll (Visible in 'split' or 'piano') */}
        {(viewMode === 'split' || viewMode === 'piano') && (
          <PianoRoll
            notes={pianoNotes}
            onAddNote={handleAddPianoNote}
            onRemoveNote={handleRemovePianoNote}
            onClearNotes={handleClearPianoNotes}
            instrument={activeInstrument}
            onChangeInstrument={setActiveInstrument}
            songKey={songKey}
            songScale={songScale}
            currentStepIndex={currentStepIndex}
            isPlaying={isPlaying}
          />
        )}
      </div>

      {/* Covers, Duplication & Preset Modal */}
      <CoverDuplicateModal
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        onApplyPreset={handleApplyPreset}
        onDuplicateProject={handleDuplicateProject}
      />
    </div>
  );
};
