import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { VocalTake, SongVersion } from '../types';

export const VocalStudioPage: React.FC = () => {
  const {
    activeChat,
    setActiveChat,
    refreshChats,
    playTrack,
    showSnackbar,
    setRoute,
    addActivityEvent,
  } = useApp();

  // Selected backing version
  const [selectedVersion, setSelectedVersion] = useState<SongVersion | null>(null);

  // Audio & Recording State
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState<number>(4);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [selectedSection, setSelectedSection] = useState<string>('Full Song');

  // Audio Context & Metering
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micActive, setMicActive] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const backingAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Teleprompter playback tracking
  const [teleprompterTime, setTeleprompterTime] = useState<number>(0);
  const [teleprompterPlaying, setTeleprompterPlaying] = useState<boolean>(false);

  // Mixing Controls
  const [vocalVolume, setVocalVolume] = useState<number>(1.0);
  const [backingVolume, setBackingVolume] = useState<number>(0.85);
  const [reverbPercent, setReverbPercent] = useState<number>(15);
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(0);
  const [selectedTakeForMix, setSelectedTakeForMix] = useState<VocalTake | null>(null);
  const [isMixing, setIsMixing] = useState<boolean>(false);
  const [mixedFileUrl, setMixedFileUrl] = useState<string | null>(null);

  // Set latest version as default
  useEffect(() => {
    if (activeChat && activeChat.versions.length > 0) {
      const latest = activeChat.versions[activeChat.versions.length - 1];
      setSelectedVersion(latest);
    }
  }, [activeChat]);

  // Enumerate Audio Devices
  useEffect(() => {
    async function getDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.warn('Failed to enumerate audio devices:', err);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  // Setup Microphone & Level Analyser
  const initMicrophone = async (deviceId?: string) => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
      setMicActive(true);
      showSnackbar('Microphone connected successfully');
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      showSnackbar(`Microphone access error: ${err.message || 'Permission denied'}`);
      setMicActive(false);
    }
  };

  // Play Audible Metronome Beep for Count-In
  const playMetronomeTick = (frequency = 880, duration = 0.08) => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // AudioContext policy fallback
    }
  };

  // Start 4-Beat Count-In then Record
  const handleStartRecordingFlow = async () => {
    if (!micActive) {
      await initMicrophone(selectedDeviceId);
    }

    if (!selectedVersion) {
      showSnackbar('Please select or generate a backing track version first');
      return;
    }

    setIsCountingIn(true);
    setCountInBeat(4);
    playMetronomeTick(880);

    const bpm = selectedVersion.bpm || 120;
    const beatInterval = (60 / bpm) * 1000;

    let currentBeat = 4;
    const countTimer = setInterval(() => {
      currentBeat -= 1;
      setCountInBeat(currentBeat);
      if (currentBeat > 0) {
        playMetronomeTick(currentBeat === 1 ? 1200 : 880);
      } else {
        clearInterval(countTimer);
        setIsCountingIn(false);
        startActualRecording();
      }
    }, beatInterval);
  };

  const startActualRecording = () => {
    if (!mediaStreamRef.current) return;

    recordedChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);

    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
    }

    const options = mimeType ? { mimeType } : undefined;
    const recorder = new MediaRecorder(mediaStreamRef.current, options);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setIsRecording(true);

    // Play backing track synchronously
    if (backingAudioRef.current && selectedVersion) {
      backingAudioRef.current.currentTime = 0;
      backingAudioRef.current.volume = backingVolume;
      backingAudioRef.current.play().catch(e => console.warn('Backing audio play error:', e));
      setTeleprompterPlaying(true);
    }

    // Start duration counter
    const startTime = Date.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setRecordingDuration(elapsed);
      if (backingAudioRef.current) {
        setTeleprompterTime(backingAudioRef.current.currentTime);
      }
    }, 100);

    addActivityEvent({
      stage: 'Vocal Recording Started',
      status: 'running',
      details: `Recording take for "${activeChat?.name}" at ${selectedVersion?.bpm} BPM`,
    });
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (backingAudioRef.current) {
      backingAudioRef.current.pause();
      setTeleprompterPlaying(false);
    }
    setIsRecording(false);
    addActivityEvent({
      stage: 'Vocal Recording Complete',
      status: 'done',
      details: `Take duration: ${recordingDuration.toFixed(1)}s`,
    });
    showSnackbar('Recording captured. Review and save below.');
  };

  // Upload Take to Server
  const handleSaveTake = async () => {
    if (!activeChat || !recordedBlob) return;

    try {
      const formData = new FormData();
      formData.append('audio', recordedBlob, 'vocal_take.webm');
      formData.append('section', selectedSection);
      formData.append('durationSec', recordingDuration.toString());

      const res = await fetch(`/api/chats/${activeChat.id}/vocals/take`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setActiveChat(data.chat);
        await refreshChats();
        setRecordedBlob(null);
        setRecordedUrl(null);
        showSnackbar(`Saved take for "${selectedSection}"`);
        addActivityEvent({
          stage: 'Vocal Take Saved',
          status: 'done',
          details: `Take saved to .chats/${activeChat.folderName}/vocals/`,
        });
      } else {
        showSnackbar('Failed to upload vocal take');
      }
    } catch (e: any) {
      showSnackbar(`Upload error: ${e.message}`);
    }
  };

  // Trigger Mix & Master
  const handleMixAndMaster = async () => {
    if (!activeChat || !selectedTakeForMix || !selectedVersion) {
      showSnackbar('Please select a vocal take and backing version to mix');
      return;
    }

    setIsMixing(true);
    addActivityEvent({
      stage: 'Mixing & Mastering',
      status: 'running',
      details: `Blending vocal take with backing track (${reverbPercent}% reverb, offset: ${syncOffsetMs}ms)`,
    });

    try {
      const res = await fetch(`/api/chats/${activeChat.id}/vocals/mix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backingMp3: selectedVersion.mp3File,
          vocalWav: selectedTakeForMix.filename,
          vocalVolume,
          backingVolume,
          syncOffsetMs,
          reverbPercent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mixUrl = `/api/audio/${activeChat.id}/${data.mixedFile}`;
        setMixedFileUrl(mixUrl);
        showSnackbar('Master mixdown complete!');
        addActivityEvent({
          stage: 'Mixdown Mastered',
          status: 'done',
          details: `Output generated: ${data.mixedFile}`,
        });
      } else {
        const err = await res.json();
        showSnackbar(`Mixing failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      showSnackbar(`Mixing error: ${e.message}`);
    } finally {
      setIsMixing(false);
    }
  };

  // Clean up media resources on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  if (!activeChat) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <span className="material-icons-round" style={{ fontSize: '48px', color: 'var(--color-text-dim)', marginBottom: '16px' }}>
          library_music
        </span>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-high)', marginBottom: '8px' }}>
          No Active Song Project Selected
        </h2>
        <p style={{ color: 'var(--color-text-medium)', marginBottom: '24px' }}>
          Please select or generate a song first before entering the Vocal Studio.
        </p>
        <button
          onClick={() => setRoute('home')}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go to Song Library
        </button>
      </div>
    );
  }

  const lyricsEntries = Object.entries(activeChat.lyrics || {});

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 24px 100px 24px' }}>
      {/* MANDATORY VOCAL DISCLAIMER BANNER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: 'rgba(235, 186, 78, 0.08)',
          border: '1px solid rgba(235, 186, 78, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
        }}
      >
        <span className="material-icons-round" style={{ color: 'var(--color-accent-amber)', fontSize: '20px' }}>
          info
        </span>
        <div style={{ fontSize: '13px', color: 'var(--color-text-high)', lineHeight: 1.5 }}>
          <strong>Notice:</strong> This library does not generate vocals. MusicSkills arranges complete multi-track musical instrumentation, rhythm backing, and vocal guide leads. Use the recording suite below to track your own human vocals over the arrangement.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
              mic
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-high)', letterSpacing: '-0.02em', margin: 0 }}>
              Live Vocal Recording Studio
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-medium)', margin: 0 }}>
            Song: <strong style={{ color: 'var(--color-text-high)' }}>{activeChat.name}</strong> • Genre: {activeChat.style.genre} • {activeChat.style.bpm} BPM • Key: {activeChat.style.key}
          </p>
        </div>

        {/* Backing Track Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--color-text-dim)', fontWeight: 500 }}>
            Backing Version:
          </label>
          <select
            value={selectedVersion?.version || ''}
            onChange={(e) => {
              const v = activeChat.versions.find(x => x.version === e.target.value);
              if (v) setSelectedVersion(v);
            }}
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--color-surface-container)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-high)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {activeChat.versions.map((ver) => (
              <option key={ver.version} value={ver.version}>
                {ver.version} ({ver.durationSec.toFixed(0)}s - {ver.bpm} BPM)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hidden Backing Audio Player for Synchronized Playback */}
      {selectedVersion && (
        <audio
          ref={backingAudioRef}
          src={`/api/audio/${activeChat.id}/${selectedVersion.mp3File || (selectedVersion.midiFile ? selectedVersion.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat.folderName}_${selectedVersion.version || 'v1'}.mp3`)}`}
          preload="auto"
          onTimeUpdate={(e) => setTeleprompterTime((e.target as HTMLAudioElement).currentTime)}
          onEnded={() => setTeleprompterPlaying(false)}
        />
      )}

      {/* COUNTDOWN OVERLAY */}
      {isCountingIn && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 14, 21, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <div
            key={countInBeat}
            className="animate-pop-in"
            style={{
              fontSize: '130px',
              fontWeight: 900,
              color: countInBeat === 1 ? 'var(--color-accent-amber)' : 'var(--color-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              filter: `drop-shadow(0 0 32px ${countInBeat === 1 ? 'rgba(255, 176, 32, 0.7)' : 'rgba(183, 166, 255, 0.7)'})`,
            }}
          >
            {countInBeat}
          </div>
          <div className="animate-pop-in" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-high)', marginTop: '16px', letterSpacing: '0.05em' }}>
            Get ready to sing... (Beat {5 - countInBeat} of 4)
          </div>
        </div>
      )}

      {/* MAIN STUDIO GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* LEFT COLUMN: TELEPROMPTER & WAVEFORM MONITOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* MICROPHONE & HARDWARE CONSOLE */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  settings_voice
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                  Hardware Input & Calibration
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: micActive ? '#4ade80' : 'var(--color-outline)',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                  {micActive ? 'Mic Active' : 'Mic Disconnected'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
              {/* Device Selector */}
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  initMicrophone(e.target.value);
                }}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                {audioDevices.length > 0 ? (
                  audioDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Audio Input ${idx + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default Microphone</option>
                )}
              </select>

              <button
                onClick={() => initMicrophone(selectedDeviceId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  refresh
                </span>
                Reconnect
              </button>

              <button
                onClick={() => playMetronomeTick(1000, 0.1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>
                  volume_up
                </span>
                Test Tone
              </button>
            </div>

            {/* REAL-TIME AUDIO LEVEL VU METER */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '6px' }}>
                <span>Input Level Meter</span>
                <span>{audioLevel}% RMS</span>
              </div>
              <div
                style={{
                  height: '10px',
                  backgroundColor: 'var(--color-surface-container)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${audioLevel}%`,
                    backgroundColor: audioLevel > 85 ? '#ef4444' : audioLevel > 60 ? 'var(--color-accent-amber)' : 'var(--color-primary)',
                    transition: 'width 0.05s ease-out',
                  }}
                />
              </div>
            </div>
          </div>

          {/* TELEPROMPTER / LYRICS PROMPTER */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '440px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  text_fields
                </span>
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                  Singing Teleprompter & Pitch Cue
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-dim)' }}>
                <span className="material-icons-round" style={{ fontSize: '16px' }}>timer</span>
                {new Date(teleprompterTime * 1000).toISOString().substr(14, 5)}
              </div>
            </div>

            {/* Teleprompter Display Box */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: '360px',
                paddingRight: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {lyricsEntries.length > 0 ? (
                lyricsEntries.map(([secName, lines], sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      padding: '14px 18px',
                      backgroundColor: 'var(--color-surface-container)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: '4px solid var(--color-primary)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--color-primary)',
                        marginBottom: '8px',
                      }}
                    >
                      {secName}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Array.isArray(lines) &&
                        lines.map((line, lIdx) => {
                          const totalLines = lyricsEntries.reduce((acc, [, ls]) => acc + (ls?.length || 0), 0);
                          const lineDur = (selectedVersion?.durationSec || 180) / Math.max(1, totalLines);
                          const globalIdx = lyricsEntries.slice(0, sIdx).reduce((acc, [, ls]) => acc + (ls?.length || 0), 0) + lIdx;
                          const isLineSinging = (isRecording || teleprompterPlaying) && teleprompterTime >= globalIdx * lineDur && teleprompterTime < (globalIdx + 1) * lineDur;

                          return (
                            <div
                              key={lIdx}
                              className={`animate-lyric-reveal ${isLineSinging ? 'animate-karaoke-active' : ''}`}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '15px',
                                lineHeight: 1.6,
                                color: isLineSinging ? '#ffffff' : 'var(--color-text-high)',
                                backgroundColor: isLineSinging ? 'rgba(183, 166, 255, 0.18)' : 'transparent',
                                borderLeft: isLineSinging ? '3px solid var(--color-primary)' : '3px solid transparent',
                                fontFamily: 'Outfit, sans-serif',
                                transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                              }}
                            >
                              {line}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '40px' }}>
                  No lyrics generated yet. Generate lyrics in the song studio first.
                </div>
              )}
            </div>

            {/* RECORDING CONTROLS DOCK */}
            <div
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-outline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Section selector for take metadata */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>Take Label:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-surface-container)',
                    border: '1px solid var(--color-outline)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-high)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="Full Song">Full Song</option>
                  <option value="Chorus Lead">Chorus Lead</option>
                  <option value="Verse 1">Verse 1</option>
                  <option value="Verse 2">Verse 2</option>
                  <option value="Bridge">Bridge</option>
                  <option value="Harmonies">Harmonies</option>
                  <option value="Ad-libs">Ad-libs</option>
                </select>
              </div>

              {/* Main Record Action Button */}
              {!isRecording ? (
                <button
                  onClick={handleStartRecordingFlow}
                  disabled={isCountingIn}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 28px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: isCountingIn ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '18px' }}>
                    fiber_manual_record
                  </span>
                  Record Take (4-Beat Count In)
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 28px',
                    backgroundColor: '#ffffff',
                    color: '#0f0e15',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '18px', color: '#ef4444' }}>
                    stop
                  </span>
                  Stop Recording ({recordingDuration.toFixed(1)}s)
                </button>
              )}
            </div>
          </div>

          {/* RECORDED TAKE REVIEW PREVIEW */}
          {recordedBlob && recordedUrl && (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                    check_circle
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                    Review Captured Take ({recordingDuration.toFixed(1)}s)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setRecordedBlob(null);
                    setRecordedUrl(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-icons-round">close</span>
                </button>
              </div>

              <audio controls src={recordedUrl} style={{ width: '100%', height: '36px' }} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => {
                    setRecordedBlob(null);
                    setRecordedUrl(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-outline)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-medium)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveTake}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '16px' }}>
                    save
                  </span>
                  Save Take to Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TAKES REEL & MIX CONSOLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* TAKES LIBRARY */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  queue_music
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                  Takes Reel ({activeChat.takes?.length || 0})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {activeChat.takes && activeChat.takes.length > 0 ? (
                activeChat.takes.map((take) => (
                  <div
                    key={take.id}
                    onClick={() => setSelectedTakeForMix(take)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor:
                        selectedTakeForMix?.id === take.id
                          ? 'rgba(183, 166, 255, 0.12)'
                          : 'var(--color-surface-container)',
                      border:
                        selectedTakeForMix?.id === take.id
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--color-outline)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                        {take.section}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                        {new Date(take.createdAt).toLocaleTimeString()} • {take.durationSec.toFixed(1)}s
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const audio = new Audio(`/api/audio/${activeChat.id}/${take.filename}`);
                          audio.play();
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <span className="material-icons-round" style={{ fontSize: '18px' }}>
                          play_arrow
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', textAlign: 'center', padding: '16px 0' }}>
                  No takes recorded yet. Use the record button on the left to track vocals.
                </div>
              )}
            </div>
          </div>

          {/* MIX & MASTER CONSOLE */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-outline)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className="material-icons-round" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                tune
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-high)' }}>
                Mixdown & Mastering Console
              </span>
            </div>

            {/* Vocal Take Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '6px' }}>
                Active Vocal Take for Mix:
              </label>
              <select
                value={selectedTakeForMix?.id || ''}
                onChange={(e) => {
                  const t = activeChat.takes.find(x => x.id === e.target.value);
                  if (t) setSelectedTakeForMix(t);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-high)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="">Select a take...</option>
                {activeChat.takes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.section} ({t.durationSec.toFixed(1)}s)
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders: Vocal Vol, Backing Vol, Reverb, Sync */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                  <span>Vocal Level</span>
                  <span>{Math.round(vocalVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={vocalVolume}
                  onChange={(e) => setVocalVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                  <span>Backing Music Level</span>
                  <span>{Math.round(backingVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={backingVolume}
                  onChange={(e) => setBackingVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                  <span>Studio Reverb</span>
                  <span>{reverbPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={reverbPercent}
                  onChange={(e) => setReverbPercent(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                  <span>Sync Offset Compensation</span>
                  <span>{syncOffsetMs} ms</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={syncOffsetMs}
                  onChange={(e) => setSyncOffsetMs(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>
            </div>

            {/* Mix Button */}
            <button
              onClick={handleMixAndMaster}
              disabled={isMixing || !selectedTakeForMix || !selectedVersion}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 18px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isMixing || !selectedTakeForMix ? 'not-allowed' : 'pointer',
                opacity: isMixing || !selectedTakeForMix ? 0.6 : 1,
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '18px' }}>
                auto_fix_high
              </span>
              {isMixing ? 'Mastering Mix...' : 'Mix & Master Track'}
            </button>

            {/* Rendered Mixed Output */}
            {mixedFileUrl && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '8px' }}>
                  Master Audio Ready
                </div>
                <audio controls src={mixedFileUrl} style={{ width: '100%', height: '32px', marginBottom: '8px' }} />
                <a
                  href={mixedFileUrl}
                  download="master_mix.mp3"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: 'var(--color-surface-container-high)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '16px' }}>
                    download
                  </span>
                  Download Mastered MP3
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

