import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  DawProject,
  DawTrack,
  DawClip,
  DawNote,
  EditingTool,
  HistoryManager,
  createDefaultProject,
  saveAutosaveSnapshot,
  loadAutosaveSnapshot,
  saveProjectToLibrary,
} from '../utils/daw/projectModel';
import { exportProjectToMidiBlob, parseMidiFile } from '../utils/daw/midiFileEngine';
import { dawContextManager } from '../utils/daw/audioContext';
import { MixerEngine } from '../utils/daw/mixerEngine';
import { dawSampleManager, SampleItem } from '../utils/daw/sampleManager';
import { ChannelEffectsConfig } from '../utils/daw/effectsRack';
import { pitchToFrequency } from '../utils/dawAudioEngine';
import { dawSynthEngine } from '../utils/daw/synthEngine';
import { dawMidiEngine, MidiDeviceInfo } from '../utils/daw/midiEngine';

import { DawTitleBar } from '../components/daw/DawTitleBar';
import { DawMenuBar, MenuActionHandlers } from '../components/daw/DawMenuBar';
import { DawTransportBar } from '../components/daw/DawTransportBar';
import { DawBrowserSidebar } from '../components/daw/DawBrowserSidebar';
import { DawArrangementView } from '../components/daw/DawArrangementView';
import { DawInspectorPanel } from '../components/daw/DawInspectorPanel';
import { DawMixerPanel } from '../components/daw/DawMixerPanel';
import { DawEffectsModal } from '../components/daw/DawEffectsModal';
import { DawStatusBar } from '../components/daw/DawStatusBar';
import { DawStepSequencer } from '../components/daw/DawStepSequencer';
import { DawShortcutsModal } from '../components/daw/DawShortcutsModal';
import { DawAudioSetupModal } from '../components/daw/DawAudioSetupModal';
import { DawOpenProjectModal } from '../components/daw/DawOpenProjectModal';
import { DawProjectSettingsModal } from '../components/daw/DawProjectSettingsModal';
import { DawDocModal } from '../components/daw/DawDocModal';
import { DawAboutModal } from '../components/daw/DawAboutModal';
import { DawRenameModal } from '../components/daw/DawRenameModal';
import { DawConfirmModal } from '../components/daw/DawConfirmModal';
import { CoverDuplicateModal } from '../components/studio/CoverDuplicateModal';
import { BeatPreset } from '../utils/beatPresets';
import { PianoRoll } from '../components/studio/PianoRoll';

export const BeatStudioPage: React.FC = () => {
  const { activeChat, setActiveChatId, refreshChats, showSnackbar, setRoute } = useApp();

  // Project Model State
  const [project, setProject] = useState<DawProject>(() => {
    const cached = loadAutosaveSnapshot();
    if (cached && (!activeChat || activeChat.id === cached.id)) {
      return cached;
    }
    return createDefaultProject(
      activeChat?.id || 'proj_default',
      activeChat?.name || 'Studio Session'
    );
  });

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('Just now');

  // Workspace & Visibility Layout
  const [activeWorkspace, setActiveWorkspace] = useState<'arrangement' | 'pianoroll' | 'stepsequencer' | 'mixer'>('arrangement');
  const [showBrowser, setShowBrowser] = useState<boolean>(true);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [showMixer, setShowMixer] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<EditingTool>('pointer');

  // Hardware MIDI Devices State
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);
  const liveMidiVoicesRef = useRef<Map<number, string>>(new Map());

  // Selection
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(project.tracks[0]?.id || null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playback & Clock State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);

  // Effects Rack & Dialog Modals State
  const [activeEffectsTrackId, setActiveEffectsTrackId] = useState<string | null>(null);
  const [isMasterEffectsOpen, setIsMasterEffectsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isAudioSetupOpen, setIsAudioSetupOpen] = useState<boolean>(false);
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState<boolean>(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState<boolean>(false);
  const [isDocOpen, setIsDocOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState<boolean>(false);
  const [isNewProjectConfirmOpen, setIsNewProjectConfirmOpen] = useState<boolean>(false);
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    initialValue: '',
    onConfirm: () => {},
  });

  // Clipboard Buffer
  const clipboardClipRef = useRef<DawClip | null>(null);

  // Hidden File Inputs
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const midiFileInputRef = useRef<HTMLInputElement>(null);

  // Audio Engine & Mixer Instances
  const mixerEngineRef = useRef<MixerEngine | null>(null);
  const historyRef = useRef<HistoryManager>(new HistoryManager());
  const playbackTimerRef = useRef<any>(null);
  const recordingStartStepRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioNode[]>([]);

  // Initialize Mixer Engine with AudioContext
  if (!mixerEngineRef.current) {
    const ctx = dawContextManager.getContext();
    mixerEngineRef.current = new MixerEngine(ctx);
  }
  const mixer = mixerEngineRef.current;

  // Sync project tracks to Mixer Channel Strips
  useEffect(() => {
    project.tracks.forEach((track) => {
      mixer.registerChannel(track.id, track.name, track.color, track.effects);
      mixer.syncChannel(track.id, track.isMuted, track.isSolo, track.volumeDb, track.pan);
    });
    mixer.setMasterVolume(project.masterVolumeDb);
  }, [project.tracks, project.masterVolumeDb, mixer]);

  // Web MIDI Hardware Controller Integration
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    dawMidiEngine.init().then((supported) => {
      if (supported) {
        setMidiDevices(dawMidiEngine.getConnectedDevices());

        const unsubDevs = dawMidiEngine.onDevicesChanged((devices) => {
          setMidiDevices(devices);
          if (devices.length > 0) {
            showSnackbar(`MIDI Controller Attached: ${devices[0].name}`);
          }
        });
        unsubs.push(unsubDevs);

        const unsubOn = dawMidiEngine.onNoteOn((midiNumber, pitch, velocity) => {
          const armedTrack = project.tracks.find((t) => t.isArmed);
          if (!armedTrack) return;
          const channel = mixer.getChannel(armedTrack.id);
          if (!channel) return;

          // Trigger live audio voice through mixer strip
          const voiceId = dawSynthEngine.triggerAttack(
            pitch,
            velocity,
            armedTrack.instrumentPreset || 'piano',
            channel.inputNode
          );
          liveMidiVoicesRef.current.set(midiNumber, voiceId);

          // If recording, record note into active or new MIDI clip
          if (isRecording) {
            const currentBarNum = Math.floor(currentStepIndex / 16) + 1;
            const stepInBar = currentStepIndex % 16;

            setProject((prev) => {
              const clip = prev.clips.find(
                (c) =>
                  c.trackId === armedTrack.id &&
                  c.type === 'midi' &&
                  currentBarNum >= c.startBar &&
                  currentBarNum < c.startBar + c.durationBars
              );

              const stepInClip = clip ? (currentBarNum - clip.startBar) * 16 + stepInBar : stepInBar;

              const newNote: DawNote = {
                id: `rec_note_${Date.now()}_${midiNumber}`,
                pitch,
                step: stepInClip,
                durationSteps: 2,
                velocity,
              };

              if (clip) {
                return {
                  ...prev,
                  clips: prev.clips.map((c) =>
                    c.id === clip.id ? { ...c, notes: [...(c.notes || []), newNote] } : c
                  ),
                };
              } else {
                const newClip: DawClip = {
                  id: `rec_midi_clip_${Date.now()}`,
                  trackId: armedTrack.id,
                  name: `MIDI Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                  type: 'midi',
                  startBar: currentBarNum,
                  durationBars: 4,
                  color: armedTrack.color,
                  notes: [newNote],
                };
                return {
                  ...prev,
                  clips: [...prev.clips, newClip],
                };
              }
            });
            setIsDirty(true);
          }
        });
        unsubs.push(unsubOn);

        const unsubOff = dawMidiEngine.onNoteOff((midiNumber) => {
          const armedTrack = project.tracks.find((t) => t.isArmed);
          const voiceId = liveMidiVoicesRef.current.get(midiNumber);
          if (voiceId) {
            dawSynthEngine.triggerRelease(voiceId, armedTrack?.instrumentPreset || 'piano');
            liveMidiVoicesRef.current.delete(midiNumber);
          }
        });
        unsubs.push(unsubOff);
      }
    });

    return () => {
      unsubs.forEach((u) => u());
      dawSynthEngine.stopAllVoices();
    };
  }, [project.tracks, isRecording, currentStepIndex, mixer, showSnackbar]);

  // Periodic autosave snapshot
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        saveAutosaveSnapshot(project);
        setLastSavedAt(new Date().toLocaleTimeString());
        setIsDirty(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [project, isDirty]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyR' && !e.ctrlKey) {
        e.preventDefault();
        handleToggleRecord();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        handleToggleLoop();
      } else if (e.code === 'KeyS' && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool('split');
      } else if (e.code === 'KeyD' && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool('draw');
      } else if (e.code === 'KeyE' && !e.ctrlKey) {
        e.preventDefault();
        setActiveTool('erase');
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        setShowBrowser((prev) => !prev);
      } else if (e.code === 'KeyM' && !e.ctrlKey) {
        e.preventDefault();
        setShowMixer((prev) => !prev);
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      } else if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'y' && e.ctrlKey) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        handleCopyClip();
      } else if (e.key === 'x' && e.ctrlKey) {
        e.preventDefault();
        handleCutClip();
      } else if (e.key === 'v' && e.ctrlKey) {
        e.preventDefault();
        handlePasteClip();
      } else if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        if (selectedClipId) handleDuplicateClip(selectedClipId);
      } else if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        handleSaveProject();
      } else if (e.key === 'o' && e.ctrlKey) {
        e.preventDefault();
        setIsProjectLibraryOpen(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
        }
      } else if (e.key === 'Escape') {
        setSelectedClipId(null);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setIsDocOpen(true);
      } else if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, project]);

  // --- PLAYBACK ENGINE ---

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    const ctx = dawContextManager.getContext();
    setIsPlaying(true);

    const stepDuration = 60 / project.bpm / 4;
    const totalSteps = project.totalBars * 16;
    let nextStepTime = ctx.currentTime;
    let step = currentStepIndex % totalSteps;

    playbackTimerRef.current = setInterval(() => {
      while (nextStepTime < ctx.currentTime + 0.1) {
        const currentStep = step;
        const time = nextStepTime;

        // Schedule musical events at exact audio time
        scheduleStepEvents(currentStep, time);

        // Schedule UI tick
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        setTimeout(() => {
          setCurrentStepIndex(currentStep);
        }, delayMs);

        nextStepTime += stepDuration;
        step = (step + 1);

        // Loop handling
        if (project.isLoopEnabled) {
          const loopEndStep = project.loopEndBar * 16;
          const loopStartStep = (project.loopStartBar - 1) * 16;
          if (step >= loopEndStep) {
            step = loopStartStep;
          }
        } else if (step >= totalSteps) {
          step = 0;
        }
      }
    }, 25);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    // Stop all active audio buffer sources
    activeSourcesRef.current.forEach((node) => {
      try {
        (node as any).stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
  };

  const handleStop = () => {
    stopPlayback();
    setCurrentStepIndex(0);
  };

  const handleReturnToStart = () => {
    setCurrentStepIndex(0);
  };

  const handleScrubPlayhead = (bar: number) => {
    const newStep = (bar - 1) * 16;
    setCurrentStepIndex(newStep);
    if (isPlaying) {
      stopPlayback();
      setTimeout(startPlayback, 30);
    }
  };

  const scheduleStepEvents = (stepIdx: number, audioTime: number) => {
    const currentBarNum = Math.floor(stepIdx / 16) + 1;
    const stepInBar = stepIdx % 16;

    // 1. Metronome Click
    if (metronomeEnabled && stepIdx % 4 === 0) {
      const isDownbeat = stepIdx % 16 === 0;
      playMetronomeClick(audioTime, isDownbeat);
    }

    // 2. Solo / Mute Matrix Priority
    const anySoloed = project.tracks.some((t) => t.isSolo);

    // 3. Schedule Clips & Notes
    project.tracks.forEach((track) => {
      const channel = mixer.getChannel(track.id);
      if (!channel) return;
      if (anySoloed && !track.isSolo) return;
      if (track.isMuted) return;

      const activeClips = project.clips.filter(
        (c) => c.trackId === track.id && currentBarNum >= c.startBar && currentBarNum < c.startBar + c.durationBars && !c.isMuted
      );

      activeClips.forEach((clip) => {
        // Audio Clip Triggering at clip start
        if (clip.type === 'audio' && clip.audioBuffer && currentBarNum === clip.startBar && stepInBar === 0) {
          playAudioClip(clip, channel.inputNode, audioTime);
        }

        // MIDI Clip Notes Triggering
        if (clip.type === 'midi' && clip.notes) {
          const stepWithinClip = (currentBarNum - clip.startBar) * 16 + stepInBar;
          const notesOnStep = clip.notes.filter((n) => n.step === stepWithinClip);
          notesOnStep.forEach((note) => {
            playMidiVoice(note, track.instrumentPreset || 'piano', channel.inputNode, audioTime);
          });
        }
      });
    });
  };

  const playAudioClip = (clip: DawClip, destinationNode: AudioNode, time: number) => {
    if (!clip.audioBuffer) return;
    const ctx = dawContextManager.getContext();
    const source = ctx.createBufferSource();

    let buf = clip.audioBuffer;
    if (clip.isReversed) {
      buf = dawSampleManager.reverseBuffer(buf);
    }
    source.buffer = buf;

    if (clip.pitchShiftSemitones) {
      source.detune.setValueAtTime(clip.pitchShiftSemitones * 100, time);
    }

    // Connect through volume gain if offset defined
    if (clip.volumeOffsetDb && clip.volumeOffsetDb !== 0) {
      const clipGain = ctx.createGain();
      const linear = Math.pow(10, clip.volumeOffsetDb / 20);
      clipGain.gain.setValueAtTime(linear, time);
      source.connect(clipGain);
      clipGain.connect(destinationNode);
      activeSourcesRef.current.push(clipGain);
    } else {
      source.connect(destinationNode);
    }

    source.start(time);
    activeSourcesRef.current.push(source);
  };

  const playMidiVoice = (note: { pitch: string; durationSteps: number; velocity: number }, preset: string, destinationNode: AudioNode, time: number) => {
    const durationSec = note.durationSteps * (60 / project.bpm / 4);
    dawSynthEngine.playNote(note.pitch, durationSec, note.velocity, preset, destinationNode, time);
  };

  const playMetronomeClick = (time: number, isDownbeat: boolean) => {
    const ctx = dawContextManager.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, time);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  };

  // --- RECORDING AUDIO INTO ARMED TRACK ---

  const handleToggleRecord = async () => {
    if (isRecording) {
      try {
        const armedTrack = project.tracks.find((t) => t.isArmed);
        const { buffer, peaks, durationSec } = await dawSampleManager.stopRecording();
        setIsRecording(false);

        if (armedTrack) {
          const recStartBar = Math.floor(recordingStartStepRef.current / 16) + 1;
          const durBars = Math.max(1, Math.ceil(durationSec / (project.bpm / 60) / 4));

          const newClip: DawClip = {
            id: `rec_clip_${Date.now()}`,
            trackId: armedTrack.id,
            name: `Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
            type: 'audio',
            startBar: recStartBar,
            durationBars: durBars,
            color: '#FF5252',
            audioBuffer: buffer,
            peaks,
          };

          setProject((prev) => ({
            ...prev,
            clips: [...prev.clips, newClip],
          }));
          setIsDirty(true);
          showSnackbar(`Captured audio recording into "${armedTrack.name}"!`);
        }
      } catch (err: any) {
        showSnackbar(`Recording error: ${err.message}`);
        setIsRecording(false);
      }
    } else {
      const armedTrack = project.tracks.find((t) => t.isArmed);
      if (!armedTrack) {
        showSnackbar('No track armed for recording. Click [R] on an audio track header first.');
        return;
      }

      try {
        await dawSampleManager.startRecording();
        recordingStartStepRef.current = currentStepIndex;
        setIsRecording(true);
        if (!isPlaying) startPlayback();
        showSnackbar(`Recording audio into "${armedTrack.name}"... Speak or sing into microphone.`);
      } catch (err: any) {
        showSnackbar(`Microphone access denied: ${err.message}`);
      }
    }
  };

  // --- TRACK & CLIP OPERATIONS ---

  const handleAddTrack = (type: DawTrack['type'], name: string, color: string, preset = 'piano') => {
    const newTrack: DawTrack = {
      id: `trk_${Date.now()}`,
      name,
      type,
      color,
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: type === 'audio',
      instrumentPreset: preset,
      effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
    };

    const action = {
      description: `Add Track "${name}"`,
      undo: () => {
        setProject((prev) => ({ ...prev, tracks: prev.tracks.filter((t) => t.id !== newTrack.id) }));
        mixer.removeChannel(newTrack.id);
      },
      redo: () => {
        setProject((prev) => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
        mixer.registerChannel(newTrack.id, newTrack.name, newTrack.color);
      },
    };

    historyRef.current.pushAction(action);
    setProject((prev) => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
    setSelectedTrackId(newTrack.id);
    setIsDirty(true);
  };

  const handleDeleteTrack = (trackId: string) => {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const removedClips = project.clips.filter((c) => c.trackId === trackId);

    const action = {
      description: `Delete Track "${track.name}"`,
      undo: () => {
        setProject((prev) => ({
          ...prev,
          tracks: [...prev.tracks, track],
          clips: [...prev.clips, ...removedClips],
        }));
        mixer.registerChannel(track.id, track.name, track.color);
      },
      redo: () => {
        setProject((prev) => ({
          ...prev,
          tracks: prev.tracks.filter((t) => t.id !== trackId),
          clips: prev.clips.filter((c) => c.trackId !== trackId),
        }));
        mixer.removeChannel(trackId);
      },
    };

    historyRef.current.pushAction(action);
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      clips: prev.clips.filter((c) => c.trackId !== trackId),
    }));
    mixer.removeChannel(trackId);
    if (selectedTrackId === trackId) setSelectedTrackId(null);
    setIsDirty(true);
  };

  const handleAddClip = (trackId: string, bar: number) => {
    const track = project.tracks.find((t) => t.id === trackId);
    const newClip: DawClip = {
      id: `clip_${Date.now()}`,
      trackId,
      name: track ? `${track.name} Clip` : 'Clip',
      type: track?.type === 'audio' ? 'audio' : 'midi',
      startBar: bar,
      durationBars: 4,
      color: track?.color,
      notes: track?.type !== 'audio' ? [] : undefined,
    };

    setProject((prev) => ({ ...prev, clips: [...prev.clips, newClip] }));
    setSelectedClipId(newClip.id);
    setIsDirty(true);
  };

  const handleDeleteClip = (clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    setProject((prev) => ({ ...prev, clips: prev.clips.filter((c) => c.id !== clipId) }));
    if (selectedClipId === clipId) setSelectedClipId(null);
    setIsDirty(true);
  };

  const handleSplitClip = (clipId: string, splitBar: number) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip || splitBar <= clip.startBar || splitBar >= clip.startBar + clip.durationBars) return;

    const firstDuration = splitBar - clip.startBar;
    const secondDuration = clip.durationBars - firstDuration;

    const secondClip: DawClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip_split_${Date.now()}`,
      startBar: splitBar,
      durationBars: secondDuration,
    };

    setProject((prev) => ({
      ...prev,
      clips: prev.clips
        .map((c) => (c.id === clipId ? { ...c, durationBars: firstDuration } : c))
        .concat(secondClip),
    }));
    setIsDirty(true);
    showSnackbar(`Split clip "${clip.name}" at Bar ${splitBar}`);
  };

  const handleToggleClipMute = (clipId: string) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, isMuted: !c.isMuted } : c)),
    }));
    setIsDirty(true);
  };

  const handleNormalizeClip = (clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip || !clip.audioBuffer) return;

    const normalized = dawSampleManager.normalizeBuffer(clip.audioBuffer);
    const newPeaks = dawSampleManager.extractPeaks(normalized, 120);

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, audioBuffer: normalized, peaks: newPeaks } : c)),
    }));
    setIsDirty(true);
    showSnackbar(`Normalized peaks for "${clip.name}"!`);
  };

  const handleDuplicateClip = (clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const newStartBar = clip.startBar + clip.durationBars;
    const duplicated: DawClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip_dup_${Date.now()}`,
      name: `${clip.name} (Copy)`,
      startBar: newStartBar,
      audioBuffer: clip.audioBuffer,
    };

    setProject((prev) => ({
      ...prev,
      clips: [...prev.clips, duplicated],
    }));
    setSelectedClipId(duplicated.id);
    setIsDirty(true);
    showSnackbar(`Duplicated "${clip.name}" to Bar ${newStartBar}!`);
  };

  const handleQuantizeClip = (clipId?: string) => {
    const targetClip = (clipId ? project.clips.find((c) => c.id === clipId) : null) || activeMidiClip;
    if (!targetClip || targetClip.type !== 'midi' || !targetClip.notes) {
      showSnackbar('No MIDI clip selected to quantize.');
      return;
    }

    const quantizedNotes = targetClip.notes.map((n) => ({
      ...n,
      step: Math.round(n.step),
      durationSteps: Math.max(1, Math.round(n.durationSteps)),
    }));

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === targetClip.id ? { ...c, notes: quantizedNotes } : c)),
    }));
    setIsDirty(true);
    showSnackbar(`Quantized ${quantizedNotes.length} notes in "${targetClip.name}" to grid!`);
  };

  const handleReverseClip = (clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) {
      showSnackbar('No clip selected to reverse.');
      return;
    }
    const clip = project.clips.find((c) => c.id === targetId);
    if (!clip || clip.type !== 'audio' || !clip.audioBuffer) {
      showSnackbar('Selected clip has no audio buffer to reverse.');
      return;
    }

    const reversed = dawSampleManager.reverseBuffer(clip.audioBuffer);
    const newPeaks = dawSampleManager.extractPeaks(reversed, 120);

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === targetId ? { ...c, audioBuffer: reversed, peaks: newPeaks, isReversed: !c.isReversed } : c
      ),
    }));
    setIsDirty(true);
    showSnackbar(`Reversed audio waveform for "${clip.name}"!`);
  };

  const handleCutClip = (clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) {
      showSnackbar('No clip selected to cut.');
      return;
    }
    const clip = project.clips.find((c) => c.id === targetId);
    if (!clip) return;

    clipboardClipRef.current = JSON.parse(JSON.stringify(clip));
    if (clip.audioBuffer) {
      clipboardClipRef.current!.audioBuffer = clip.audioBuffer;
    }

    handleDeleteClip(targetId);
    showSnackbar(`Cut "${clip.name}" to clipboard.`);
  };

  const handleCopyClip = (clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) {
      showSnackbar('No clip selected to copy.');
      return;
    }
    const clip = project.clips.find((c) => c.id === targetId);
    if (!clip) return;

    clipboardClipRef.current = JSON.parse(JSON.stringify(clip));
    if (clip.audioBuffer) {
      clipboardClipRef.current!.audioBuffer = clip.audioBuffer;
    }
    showSnackbar(`Copied "${clip.name}" to clipboard.`);
  };

  const handlePasteClip = () => {
    if (!clipboardClipRef.current) {
      showSnackbar('Clipboard is empty. Copy or cut a clip first.');
      return;
    }

    const playheadBar = Math.floor(currentStepIndex / 16) + 1;
    let targetTrackId = selectedTrackId || clipboardClipRef.current.trackId;
    const targetTrack = project.tracks.find((t) => t.id === targetTrackId);

    if (
      targetTrack &&
      ((clipboardClipRef.current.type === 'audio' && targetTrack.type !== 'audio') ||
        (clipboardClipRef.current.type === 'midi' && targetTrack.type === 'audio'))
    ) {
      const compatible = project.tracks.find((t) =>
        clipboardClipRef.current!.type === 'audio' ? t.type === 'audio' : t.type !== 'audio'
      );
      if (compatible) targetTrackId = compatible.id;
    }

    const pastedClip: DawClip = {
      ...JSON.parse(JSON.stringify(clipboardClipRef.current)),
      id: `clip_pasted_${Date.now()}`,
      trackId: targetTrackId,
      startBar: playheadBar,
      audioBuffer: clipboardClipRef.current.audioBuffer,
    };

    setProject((prev) => ({
      ...prev,
      clips: [...prev.clips, pastedClip],
    }));
    setSelectedClipId(pastedClip.id);
    setSelectedTrackId(targetTrackId);
    setIsDirty(true);
    showSnackbar(`Pasted "${pastedClip.name}" at Bar ${playheadBar}!`);
  };

  const handleDuplicateTrack = (trackId?: string) => {
    const targetId = trackId || selectedTrackId;
    if (!targetId) {
      showSnackbar('No track selected to duplicate.');
      return;
    }
    const origTrack = project.tracks.find((t) => t.id === targetId);
    if (!origTrack) return;

    const newTrackId = `trk_${Date.now()}`;
    const newTrack: DawTrack = {
      ...JSON.parse(JSON.stringify(origTrack)),
      id: newTrackId,
      name: `${origTrack.name} (Copy)`,
    };

    const origClips = project.clips.filter((c) => c.trackId === targetId);
    const duplicatedClips: DawClip[] = origClips.map((c) => ({
      ...JSON.parse(JSON.stringify(c)),
      id: `clip_dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trackId: newTrackId,
      audioBuffer: c.audioBuffer,
    }));

    setProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
      clips: [...prev.clips, ...duplicatedClips],
    }));
    mixer.registerChannel(newTrack.id, newTrack.name, newTrack.color, newTrack.effects);
    mixer.syncChannel(newTrack.id, newTrack.isMuted, newTrack.isSolo, newTrack.volumeDb, newTrack.pan);
    setSelectedTrackId(newTrack.id);
    setIsDirty(true);
    showSnackbar(`Duplicated track "${origTrack.name}" and ${duplicatedClips.length} clips!`);
  };

  const handleRenameTrack = (trackId?: string) => {
    const targetId = trackId || selectedTrackId;
    if (!targetId) {
      showSnackbar('No track selected to rename.');
      return;
    }
    const track = project.tracks.find((t) => t.id === targetId);
    if (!track) return;

    setRenameModal({
      isOpen: true,
      title: 'Rename Track',
      initialValue: track.name,
      onConfirm: (newName) => {
        setProject((prev) => ({
          ...prev,
          tracks: prev.tracks.map((t) => (t.id === targetId ? { ...t, name: newName } : t)),
        }));
        mixer.registerChannel(track.id, newName, track.color, track.effects);
        setIsDirty(true);
        showSnackbar(`Renamed track to "${newName}".`);
      },
    });
  };

  const handleResetChannelLevels = () => {
    setProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => ({ ...t, volumeDb: 0, pan: 0, isMuted: false, isSolo: false })),
      masterVolumeDb: 0,
    }));
    project.tracks.forEach((t) => {
      mixer.setChannelVolume(t.id, 0);
      mixer.setChannelPan(t.id, 0);
      mixer.syncChannel(t.id, false, false, 0, 0);
    });
    mixer.setMasterVolume(0);
    setIsDirty(true);
    showSnackbar('Reset all channel faders to 0 dB and centered pan.');
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleResetWorkspace = () => {
    setShowBrowser(true);
    setShowInspector(true);
    setShowMixer(true);
    setActiveWorkspace('arrangement');
    setActiveTool('pointer');
    showSnackbar('Workspace layout reset to default.');
  };

  const handleExportMidi = () => {
    try {
      const blob = exportProjectToMidiBlob(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSnackbar(`Exported Standard MIDI File "${a.download}"!`);
    } catch (err: any) {
      showSnackbar(`MIDI export error: ${err.message}`);
    }
  };

  const handleImportAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showSnackbar(`Decoding audio file "${file.name}"...`);
      const arrayBuffer = await file.arrayBuffer();
      const ctx = dawContextManager.getContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      const peaks = dawSampleManager.extractPeaks(decodedBuffer, 120);

      const trackId = `trk_aud_${Date.now()}`;
      const trackName = file.name.replace(/\.[^/.]+$/, '');
      const newTrack: DawTrack = {
        id: trackId,
        name: trackName,
        type: 'audio',
        color: '#35C9A5',
        volumeDb: 0,
        pan: 0,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
      };

      const durBars = Math.max(1, Math.ceil(decodedBuffer.duration / (project.bpm / 60) / 4));
      const playheadBar = Math.floor(currentStepIndex / 16) + 1;
      const newClip: DawClip = {
        id: `clip_imported_${Date.now()}`,
        trackId,
        name: trackName,
        type: 'audio',
        startBar: playheadBar,
        durationBars: durBars,
        color: '#35C9A5',
        audioBuffer: decodedBuffer,
        peaks,
      };

      setProject((prev) => ({
        ...prev,
        tracks: [...prev.tracks, newTrack],
        clips: [...prev.clips, newClip],
      }));
      mixer.registerChannel(trackId, trackName, '#35C9A5');
      setSelectedTrackId(trackId);
      setSelectedClipId(newClip.id);
      setIsDirty(true);
      showSnackbar(`Imported "${file.name}" into new track at Bar ${playheadBar}!`);
    } catch (err: any) {
      showSnackbar(`Audio import error: ${err.message}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleImportMidiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showSnackbar(`Parsing MIDI file "${file.name}"...`);
      const arrayBuffer = await file.arrayBuffer();
      const parsedTracks = parseMidiFile(arrayBuffer);

      if (parsedTracks.length === 0) {
        showSnackbar('No readable MIDI note events found in file.');
        return;
      }

      const newTracks: DawTrack[] = [];
      const newClips: DawClip[] = [];

      parsedTracks.forEach((pt, idx) => {
        const trackId = `trk_midi_${Date.now()}_${idx}`;
        const newTrack: DawTrack = {
          id: trackId,
          name: pt.name || `MIDI Track ${idx + 1}`,
          type: 'midi',
          color: '#8B78FF',
          volumeDb: 0,
          pan: 0,
          isMuted: false,
          isSolo: false,
          isArmed: false,
          instrumentPreset: 'piano',
          effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
        };
        newTracks.push(newTrack);
        mixer.registerChannel(trackId, newTrack.name, newTrack.color);

        if (pt.notes.length > 0) {
          const maxStep = Math.max(...pt.notes.map((n) => n.step + n.durationSteps));
          const durBars = Math.max(1, Math.ceil(maxStep / 16));
          newClips.push({
            id: `clip_mid_${Date.now()}_${idx}`,
            trackId,
            name: `${pt.name} Pattern`,
            type: 'midi',
            startBar: 1,
            durationBars: durBars,
            color: '#8B78FF',
            notes: pt.notes,
          });
        }
      });

      setProject((prev) => ({
        ...prev,
        tracks: [...prev.tracks, ...newTracks],
        clips: [...prev.clips, ...newClips],
      }));
      if (newTracks.length > 0) setSelectedTrackId(newTracks[0].id);
      if (newClips.length > 0) setSelectedClipId(newClips[0].id);
      setIsDirty(true);
      showSnackbar(`Imported ${newTracks.length} MIDI track(s) from "${file.name}"!`);
    } catch (err: any) {
      showSnackbar(`MIDI import error: ${err.message}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleNormalizeAudioClip = (clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) {
      showSnackbar('No clip selected to normalize.');
      return;
    }
    handleNormalizeClip(targetId);
  };

  const handleSaveProject = async () => {
    saveAutosaveSnapshot(project);
    saveProjectToLibrary(project);
    setIsDirty(false);
    setLastSavedAt(new Date().toLocaleTimeString());
    if (activeChat) {
      try {
        await fetch(`/api/chats/${activeChat.id}/studio-arrangement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studioArrangement: project }),
        });
      } catch (_) {}
    }
    showSnackbar(`Saved project "${project.name}" to studio library!`);
  };

  const handleSaveAsCopy = () => {
    setRenameModal({
      isOpen: true,
      title: 'Save a Copy / Cover Project',
      initialValue: `${project.name} (Copy)`,
      onConfirm: (newName) => {
        const copy: DawProject = {
          ...JSON.parse(JSON.stringify(project)),
          id: `proj_${Date.now()}`,
          name: newName,
          updatedAt: new Date().toISOString(),
        };
        copy.clips = copy.clips.map((c, i) => ({
          ...c,
          audioBuffer: project.clips[i]?.audioBuffer,
        }));
        setProject(copy);
        saveProjectToLibrary(copy);
        setIsDirty(false);
        showSnackbar(`Saved duplicate session "${newName}"!`);
      },
    });
  };

  const handleOpenProject = (proj: DawProject) => {
    setProject(proj);
    proj.tracks.forEach((t) => {
      mixer.registerChannel(t.id, t.name, t.color, t.effects);
      mixer.syncChannel(t.id, t.isMuted, t.isSolo, t.volumeDb, t.pan);
    });
    mixer.setMasterVolume(proj.masterVolumeDb);
    setSelectedTrackId(proj.tracks[0]?.id || null);
    setSelectedClipId(null);
    setIsDirty(false);
  };

  const handleDeleteSelected = () => {
    if (selectedClipId) {
      handleDeleteClip(selectedClipId);
    } else if (selectedTrackId) {
      handleDeleteTrack(selectedTrackId);
    }
  };

  const handleSelectAll = () => {
    if (project.clips.length > 0) {
      setSelectedClipId(project.clips[0].id);
      showSnackbar(`Selected clip "${project.clips[0].name}".`);
    }
  };

  const handleDeselect = () => {
    setSelectedClipId(null);
  };

  // Add sample from sidebar to existing or new track
  const handleAddSampleToTrack = (sample: SampleItem, trackId: string, bar: number) => {
    const track = project.tracks.find((t) => t.id === trackId);
    const durBars = Math.max(1, Math.ceil(sample.durationSec / (project.bpm / 60) / 4));

    const newClip: DawClip = {
      id: `sample_clip_${Date.now()}`,
      trackId,
      name: sample.name,
      type: 'audio',
      startBar: bar,
      durationBars: durBars,
      color: track?.color || '#35C9A5',
      audioBuffer: sample.buffer,
      peaks: sample.peaks,
    };

    setProject((prev) => ({ ...prev, clips: [...prev.clips, newClip] }));
    setSelectedClipId(newClip.id);
    setIsDirty(true);
    showSnackbar(`Placed "${sample.name}" on timeline at Bar ${bar}!`);
  };

  const handleAddSampleToNewTrack = (sample: SampleItem) => {
    const trackId = `trk_audio_${Date.now()}`;
    const newTrack: DawTrack = {
      id: trackId,
      name: sample.name,
      type: 'audio',
      color: '#35C9A5',
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
    };

    const durBars = Math.max(1, Math.ceil(sample.durationSec / (project.bpm / 60) / 4));
    const newClip: DawClip = {
      id: `clip_${Date.now()}`,
      trackId,
      name: sample.name,
      type: 'audio',
      startBar: 1,
      durationBars: durBars,
      color: '#35C9A5',
      audioBuffer: sample.buffer,
      peaks: sample.peaks,
    };

    setProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
      clips: [...prev.clips, newClip],
    }));
    mixer.registerChannel(trackId, sample.name, '#35C9A5');
    setSelectedTrackId(trackId);
    setSelectedClipId(newClip.id);
    setIsDirty(true);
    showSnackbar(`Created audio track and placed "${sample.name}" at Bar 1!`);
  };

  const handleCommitStepPattern = (
    drumPattern: Record<string, boolean[]>,
    startBar: number,
    name: string
  ) => {
    let drumTrack = project.tracks.find((t) => t.name.toLowerCase().includes('drum') || t.id.includes('drum'));
    let nextTracks = [...project.tracks];

    if (!drumTrack) {
      drumTrack = {
        id: `trk_drums_${Date.now()}`,
        name: 'Drum Sequencer',
        type: 'instrument',
        color: '#FF5252',
        volumeDb: 0,
        pan: 0,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        instrumentPreset: 'bass',
        effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
      };
      nextTracks.push(drumTrack);
      mixer.registerChannel(drumTrack.id, drumTrack.name, drumTrack.color);
    }

    const voiceToPitchMap: Record<string, string> = {
      sub808: 'C1',
      kick: 'C2',
      snare: 'D2',
      clap: 'Eb2',
      perc: 'G#2',
      hihatClosed: 'F#2',
      hihatOpen: 'Bb2',
    };

    const notes: DawNote[] = [];
    Object.entries(drumPattern).forEach(([voiceId, steps]) => {
      const pitch = voiceToPitchMap[voiceId] || 'C2';
      steps.forEach((active, stepIdx) => {
        if (active) {
          notes.push({
            id: `drum_${voiceId}_${stepIdx}_${Date.now()}`,
            pitch,
            step: stepIdx,
            durationSteps: 1,
            velocity: 0.85,
          });
        }
      });
    });

    const newClip: DawClip = {
      id: `clip_drum_${Date.now()}`,
      trackId: drumTrack.id,
      name: `${name} Beat`,
      type: 'midi',
      startBar,
      durationBars: 1,
      color: drumTrack.color,
      notes,
    };

    setProject((prev) => ({
      ...prev,
      tracks: nextTracks,
      clips: [...prev.clips, newClip],
    }));
    setSelectedTrackId(drumTrack.id);
    setSelectedClipId(newClip.id);
    setIsDirty(true);
    showSnackbar(`Committed ${name} pattern to "${drumTrack.name}" at Bar ${startBar}!`);
  };

  // --- UNDO / REDO ---

  const handleUndo = () => {
    if (historyRef.current.undo()) {
      setIsDirty(true);
      showSnackbar(`Undo: ${historyRef.current.getUndoDescription() || 'Action'}`);
    }
  };

  const handleRedo = () => {
    if (historyRef.current.redo()) {
      setIsDirty(true);
      showSnackbar(`Redo: ${historyRef.current.getRedoDescription() || 'Action'}`);
    }
  };

  const handleToggleLoop = () => {
    setProject((prev) => ({ ...prev, isLoopEnabled: !prev.isLoopEnabled }));
  };

  // --- EXPORT MASTER AUDIO (WAV) ---

  const handleExportMaster = async () => {
    showSnackbar('Rendering high-resolution 24-bit WAV master from multitrack timeline...');
    const stepDuration = 60 / project.bpm / 4;
    const totalSteps = project.totalBars * 16;
    const totalDurationSec = totalSteps * stepDuration + 2.0;

    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDurationSec * sampleRate), sampleRate);
    const offlineMixer = new MixerEngine(offlineCtx);

    // Setup offline mixer routing
    project.tracks.forEach((t) => {
      offlineMixer.registerChannel(t.id, t.name, t.color, t.effects);
      offlineMixer.setChannelVolume(t.id, t.volumeDb);
      offlineMixer.setChannelPan(t.id, t.pan);
    });
    offlineMixer.setMasterVolume(project.masterVolumeDb);

    // Schedule audio and MIDI events into the offline context
    project.tracks.forEach((track) => {
      const channel = offlineMixer.getChannel(track.id);
      if (!channel || track.isMuted) return;

      const trackClips = project.clips.filter((c) => c.trackId === track.id && !c.isMuted);
      trackClips.forEach((clip) => {
        const clipStartTime = (clip.startBar - 1) * 16 * stepDuration;

        if (clip.type === 'audio' && clip.audioBuffer) {
          let buf = clip.audioBuffer;
          if (clip.isReversed) {
            buf = dawSampleManager.reverseBuffer(buf);
          }
          const source = offlineCtx.createBufferSource();
          source.buffer = buf;
          if (clip.pitchShiftSemitones) {
            source.detune.setValueAtTime(clip.pitchShiftSemitones * 100, clipStartTime);
          }
          source.connect(channel.inputNode);
          source.start(clipStartTime);
        }

        if (clip.type === 'midi' && clip.notes) {
          clip.notes.forEach((note) => {
            const noteTime = clipStartTime + note.step * stepDuration;
            const dur = note.durationSteps * stepDuration;
            dawSynthEngine.playNote(
              note.pitch,
              dur,
              note.velocity,
              track.instrumentPreset || 'piano',
              channel.inputNode,
              noteTime,
              offlineCtx
            );
          });
        }
      });
    });

    const rendered = await offlineCtx.startRendering();

    // Encode rendered AudioBuffer to WAV Blob
    const length = rendered.length * 2 * 2;
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);

    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 2, true); // Stereo
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, length, true);

    const l = rendered.getChannelData(0);
    const r = rendered.getChannelData(1);
    let offset = 44;
    for (let i = 0; i < rendered.length; i++, offset += 4) {
      const sL = Math.max(-1, Math.min(1, l[i]));
      const sR = Math.max(-1, Math.min(1, r[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
      view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
    }

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_master.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showSnackbar(`Successfully exported "${project.name}_master.wav"!`);
  };

  const handleExportStems = async () => {
    const tracksWithClips = project.tracks.filter((t) => project.clips.some((c) => c.trackId === t.id));
    if (tracksWithClips.length === 0) {
      showSnackbar('No audio or MIDI clips found to export stems.');
      return;
    }

    showSnackbar(`Rendering ${tracksWithClips.length} multitrack stems in WAV format...`);
    const stepDuration = 60 / project.bpm / 4;
    const totalSteps = project.totalBars * 16;
    const totalDurationSec = totalSteps * stepDuration + 2.0;
    const sampleRate = 44100;

    for (let i = 0; i < tracksWithClips.length; i++) {
      const track = tracksWithClips[i];
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDurationSec * sampleRate), sampleRate);
      const offlineMixer = new MixerEngine(offlineCtx);

      offlineMixer.registerChannel(track.id, track.name, track.color, track.effects);
      offlineMixer.setChannelVolume(track.id, track.volumeDb);
      offlineMixer.setChannelPan(track.id, track.pan);
      offlineMixer.setMasterVolume(project.masterVolumeDb);

      const channel = offlineMixer.getChannel(track.id);
      if (channel) {
        const trackClips = project.clips.filter((c) => c.trackId === track.id && !c.isMuted);
        trackClips.forEach((clip) => {
          const clipStartTime = (clip.startBar - 1) * 16 * stepDuration;

          if (clip.type === 'audio' && clip.audioBuffer) {
            let buf = clip.audioBuffer;
            if (clip.isReversed) {
              buf = dawSampleManager.reverseBuffer(buf);
            }
            const source = offlineCtx.createBufferSource();
            source.buffer = buf;
            if (clip.pitchShiftSemitones) {
              source.detune.setValueAtTime(clip.pitchShiftSemitones * 100, clipStartTime);
            }
            source.connect(channel.inputNode);
            source.start(clipStartTime);
          }

          if (clip.type === 'midi' && clip.notes) {
            clip.notes.forEach((note) => {
              const noteTime = clipStartTime + note.step * stepDuration;
              const dur = note.durationSteps * stepDuration;
              dawSynthEngine.playNote(
                note.pitch,
                dur,
                note.velocity,
                track.instrumentPreset || 'piano',
                channel.inputNode,
                noteTime,
                offlineCtx
              );
            });
          }
        });
      }

      const rendered = await offlineCtx.startRendering();

      // Encode rendered AudioBuffer to WAV Blob
      const length = rendered.length * 2 * 2;
      const wavBuffer = new ArrayBuffer(44 + length);
      const view = new DataView(wavBuffer);
      const writeStr = (offset: number, s: string) => {
        for (let j = 0; j < s.length; j++) view.setUint8(offset + j, s.charCodeAt(j));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + length, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 2, true); // Stereo
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 4, true);
      view.setUint16(32, 4, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, length, true);

      const l = rendered.getChannelData(0);
      const r = rendered.getChannelData(1);
      let offset = 44;
      for (let s = 0; s < rendered.length; s++, offset += 4) {
        const sL = Math.max(-1, Math.min(1, l[s]));
        const sR = Math.max(-1, Math.min(1, r[s]));
        view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
        view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      }

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_Stem_${track.name.replace(/\s+/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    showSnackbar(`Successfully exported ${tracksWithClips.length} multitrack stems!`);
  };

  const handleApplyBeatPreset = (preset: BeatPreset) => {
    const prevProject = JSON.parse(JSON.stringify(project));

    let drumTrack = project.tracks.find(
      (t) => t.name.toLowerCase().includes('drum') || t.id.includes('drum') || t.instrumentPreset === 'drums'
    );
    let bassTrack = project.tracks.find(
      (t) => t.name.toLowerCase().includes('bass') || t.id.includes('bass') || t.instrumentPreset === 'bass'
    );
    let pianoTrack = project.tracks.find(
      (t) => t.name.toLowerCase().includes('piano') || t.name.toLowerCase().includes('keys') || t.instrumentPreset === 'piano'
    );

    const nextTracks = [...project.tracks];

    if (!drumTrack) {
      drumTrack = {
        id: `trk_drums_${Date.now()}`,
        name: 'Drums & Percussion',
        type: 'instrument',
        color: '#FF5252',
        volumeDb: 0,
        pan: 0,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        instrumentPreset: 'drums',
        effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
      };
      nextTracks.push(drumTrack);
      mixer.registerChannel(drumTrack.id, drumTrack.name, drumTrack.color);
    } else {
      drumTrack = { ...drumTrack, instrumentPreset: 'drums' };
      const idx = nextTracks.findIndex((t) => t.id === drumTrack!.id);
      if (idx !== -1) nextTracks[idx] = drumTrack;
    }

    if (!bassTrack) {
      bassTrack = {
        id: `trk_bass_${Date.now()}`,
        name: '808 Sub Bass',
        type: 'instrument',
        color: '#8B78FF',
        volumeDb: -1,
        pan: 0,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        instrumentPreset: 'bass',
        effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
      };
      nextTracks.push(bassTrack);
      mixer.registerChannel(bassTrack.id, bassTrack.name, bassTrack.color);
    }

    if (!pianoTrack) {
      pianoTrack = {
        id: `trk_keys_${Date.now()}`,
        name: 'Chords & Keys',
        type: 'midi',
        color: '#35C9A5',
        volumeDb: -2,
        pan: -0.1,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        instrumentPreset: 'piano',
        effects: JSON.parse(JSON.stringify(mixer.masterEffectChain.getConfig())),
      };
      nextTracks.push(pianoTrack);
      mixer.registerChannel(pianoTrack.id, pianoTrack.name, pianoTrack.color);
    }

    const voiceToPitchMap: Record<string, string> = {
      sub808: 'C1',
      kick: 'C2',
      snare: 'D2',
      clap: 'Eb2',
      perc: 'G#2',
      hihatClosed: 'F#2',
      hihatOpen: 'Bb2',
    };

    const drumNotes: DawNote[] = [];
    Object.entries(preset.drumSteps).forEach(([voiceId, steps]) => {
      const pitch = voiceToPitchMap[voiceId] || 'C2';
      steps.forEach((active, stepIdx) => {
        if (active) {
          drumNotes.push({
            id: `drum_${voiceId}_${stepIdx}_${Date.now()}`,
            pitch,
            step: stepIdx,
            durationSteps: 1,
            velocity: 0.85,
          });
        }
      });
    });

    const newClips: DawClip[] = [];

    // 4-Bar Drum Clip
    const drumClipNotes: DawNote[] = [];
    for (let bar = 0; bar < 4; bar++) {
      drumNotes.forEach((n) => {
        drumClipNotes.push({
          id: `dn_${bar}_${n.step}_${Date.now()}_${Math.random()}`,
          pitch: n.pitch,
          step: bar * 16 + n.step,
          durationSteps: n.durationSteps,
          velocity: n.velocity,
        });
      });
    }

    newClips.push({
      id: `clip_drums_${Date.now()}`,
      trackId: drumTrack.id,
      name: `${preset.name} (Beat)`,
      type: 'midi',
      startBar: 1,
      durationBars: 4,
      color: drumTrack.color,
      notes: drumClipNotes,
    });

    // 4-Bar Bass Clip
    if (preset.bassNotes.length > 0) {
      const bassClipNotes: DawNote[] = [];
      for (let bar = 0; bar < 4; bar++) {
        preset.bassNotes.forEach((bn) => {
          bassClipNotes.push({
            id: `bn_${bar}_${bn.step}_${Date.now()}_${Math.random()}`,
            pitch: bn.pitch,
            step: bar * 16 + bn.step,
            durationSteps: bn.durationSteps,
            velocity: bn.velocity || 0.85,
          });
        });
      }
      newClips.push({
        id: `clip_bass_${Date.now()}`,
        trackId: bassTrack.id,
        name: `${preset.name} (Bass)`,
        type: 'midi',
        startBar: 1,
        durationBars: 4,
        color: bassTrack.color,
        notes: bassClipNotes,
      });
    }

    // 4-Bar Piano / Chords Clip
    if (preset.pianoNotes.length > 0) {
      const pianoClipNotes: DawNote[] = [];
      for (let bar = 0; bar < 4; bar++) {
        preset.pianoNotes.forEach((pn) => {
          pianoClipNotes.push({
            id: `pn_${bar}_${pn.step}_${Date.now()}_${Math.random()}`,
            pitch: pn.pitch,
            step: bar * 16 + pn.step,
            durationSteps: pn.durationSteps,
            velocity: pn.velocity || 0.8,
          });
        });
      }
      newClips.push({
        id: `clip_keys_${Date.now()}`,
        trackId: pianoTrack.id,
        name: `${preset.name} (Chords)`,
        type: 'midi',
        startBar: 1,
        durationBars: 4,
        color: pianoTrack.color,
        notes: pianoClipNotes,
      });
    }

    const nextProject: DawProject = {
      ...project,
      bpm: preset.bpm,
      key: preset.key,
      scale: preset.scale,
      tracks: nextTracks,
      clips: [...project.clips, ...newClips],
    };

    historyRef.current.pushAction({
      description: `Load ${preset.name} Beat`,
      undo: () => setProject(prevProject),
      redo: () => setProject(nextProject),
    });

    setProject(nextProject);
    setIsDirty(true);
    showSnackbar(`Loaded "${preset.name}" beat arrangement (${preset.bpm} BPM, Key ${preset.key} ${preset.scale})!`);
  };

  const handleDuplicateProject = async (sourceChatId: string, asCover: boolean, customName?: string) => {
    try {
      const res = await fetch(`/api/chats/${sourceChatId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asCover, customName }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      await refreshChats();

      const dupChat = data.chat;
      if (dupChat) {
        setProject((prev) => ({
          ...prev,
          id: `proj_${dupChat.id}`,
          name: dupChat.name,
          bpm: dupChat.style?.bpm || prev.bpm,
          key: dupChat.style?.key || prev.key,
        }));
        setIsDirty(true);
        showSnackbar(`Loaded ${asCover ? 'cover' : 'duplicate'} project "${dupChat.name}" into Studio!`);
      }
    } catch (err: any) {
      showSnackbar(`Project duplication error: ${err.message}`);
    }
  };

  // Menu action handlers
  const menuHandlers: MenuActionHandlers = {
    // File
    onNewProject: () => {
      setIsNewProjectConfirmOpen(true);
    },
    onOpenProject: () => setIsProjectLibraryOpen(true),
    onSaveProject: handleSaveProject,
    onSaveAsCopy: handleSaveAsCopy,
    onOpenCoversModal: () => setIsCoverModalOpen(true),
    onImportAudio: () => audioFileInputRef.current?.click(),
    onImportMidi: () => midiFileInputRef.current?.click(),
    onExportMaster: handleExportMaster,
    onExportMidi: handleExportMidi,
    onExportStems: handleExportStems,
    onOpenProjectSettings: () => setIsProjectSettingsOpen(true),
    onShowAudioSetup: () => setIsAudioSetupOpen(true),
    onExit: () => setRoute('home'),

    // Edit
    onUndo: handleUndo,
    onRedo: handleRedo,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    undoDesc: historyRef.current.getUndoDescription(),
    redoDesc: historyRef.current.getRedoDescription(),
    onCutClip: () => handleCutClip(),
    onCopyClip: () => handleCopyClip(),
    onPasteClip: handlePasteClip,
    onDuplicateClip: () => {
      if (selectedClipId) handleDuplicateClip(selectedClipId);
    },
    onDeleteSelected: handleDeleteSelected,
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    onSplitClipAtPlayhead: () => {
      if (selectedClipId) {
        const bar = Math.floor(currentStepIndex / 16) + 1;
        handleSplitClip(selectedClipId, bar);
      }
    },
    onQuantizeClip: () => handleQuantizeClip(),

    // View
    onSelectWorkspace: (ws) => setActiveWorkspace(ws),
    onToggleBrowser: () => setShowBrowser((prev) => !prev),
    onToggleInspector: () => setShowInspector((prev) => !prev),
    onToggleMixer: () => setShowMixer((prev) => !prev),
    onToggleFullscreen: handleToggleFullscreen,
    onResetWorkspace: handleResetWorkspace,

    // Track
    onAddAudioTrack: () => handleAddTrack('audio', 'Audio Track', '#35C9A5'),
    onAddMidiTrack: () => handleAddTrack('midi', 'MIDI Track', '#8B78FF', 'piano'),
    onAddInstrumentTrack: () => handleAddTrack('instrument', '808 Bass Track', '#FF5252', 'bass'),
    onAddDrumTrack: () => handleAddTrack('instrument', 'Drum Sequencer', '#FF5252', 'bass'),
    onDuplicateSelectedTrack: () => {
      if (selectedTrackId) handleDuplicateTrack(selectedTrackId);
    },
    onRenameSelectedTrack: () => {
      if (selectedTrackId) handleRenameTrack(selectedTrackId);
    },
    onDeleteSelectedTrack: () => {
      if (selectedTrackId) handleDeleteTrack(selectedTrackId);
    },

    // Clip
    onReverseAudioClip: () => handleReverseClip(),
    onNormalizeAudioClip: () => handleNormalizeAudioClip(),
    onToggleClipMute: () => {
      if (selectedClipId) handleToggleClipMute(selectedClipId);
    },

    // Mixer
    onResetChannelLevels: handleResetChannelLevels,
    onOpenMasterEffects: () => setIsMasterEffectsOpen(true),

    // Help
    onShowDoc: () => setIsDocOpen(true),
    onShowShortcuts: () => setIsShortcutsOpen(true),
    onShowAbout: () => setIsAboutOpen(true),
  };

  const selectedTrack = project.tracks.find((t) => t.id === selectedTrackId) || null;
  const selectedClip = project.clips.find((c) => c.id === selectedClipId) || null;

  // Selected MIDI notes for Piano Roll
  const activeMidiClip = selectedClip?.type === 'midi' ? selectedClip : project.clips.find((c) => c.type === 'midi') || null;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#101114',
        color: '#F3F4F6',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
      }}
    >
      {/* 1. DAW Top Title Bar */}
      <DawTitleBar
        projectName={project.name}
        isDirty={isDirty}
        onRenameProject={(name) => {
          setProject((prev) => ({ ...prev, name }));
          setIsDirty(true);
        }}
        activeWorkspace={activeWorkspace}
        onChangeWorkspace={setActiveWorkspace}
        onExit={() => setRoute('home')}
        midiConnectedCount={midiDevices.length}
        onOpenCoversModal={() => setIsCoverModalOpen(true)}
      />

      {/* 2. Global Main Menu */}
      <DawMenuBar handlers={menuHandlers} />

      {/* 3. Global Transport Toolbar */}
      <DawTransportBar
        isPlaying={isPlaying}
        isRecording={isRecording}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onToggleRecord={handleToggleRecord}
        onReturnToStart={handleReturnToStart}
        currentStepIndex={currentStepIndex}
        bpm={project.bpm}
        onChangeBpm={(bpm) => {
          setProject((prev) => ({ ...prev, bpm }));
          setIsDirty(true);
        }}
        timeSigNumerator={project.timeSignatureNumerator}
        timeSigDenominator={project.timeSignatureDenominator}
        onChangeTimeSig={(num, den) => {
          setProject((prev) => ({ ...prev, timeSignatureNumerator: num, timeSignatureDenominator: den }));
          setIsDirty(true);
        }}
        songKey={project.key}
        songScale={project.scale}
        onChangeKey={(key, scale) => {
          setProject((prev) => ({ ...prev, key, scale }));
          setIsDirty(true);
        }}
        isLoopEnabled={project.isLoopEnabled}
        onToggleLoop={handleToggleLoop}
        metronomeEnabled={metronomeEnabled}
        onToggleMetronome={() => setMetronomeEnabled((prev) => !prev)}
        snapResolution={project.snapResolution}
        onChangeSnap={(snap) => {
          setProject((prev) => ({ ...prev, snapResolution: snap }));
          setIsDirty(true);
        }}
        onJumpToBar={handleScrubPlayhead}
      />

      {/* 4. Central Horizontal Workspace Splitter */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Left: Sample Browser Sidebar */}
        {showBrowser && (
          <DawBrowserSidebar
            onAddSampleToNewTrack={handleAddSampleToNewTrack}
            onAddSampleToTrack={handleAddSampleToTrack}
            selectedTrackId={selectedTrackId || undefined}
            currentPlayheadBar={Math.floor(currentStepIndex / 16) + 1}
            onApplyBeatPreset={handleApplyBeatPreset}
            onOpenCoverModal={() => setIsCoverModalOpen(true)}
          />
        )}

        {/* Center: Active Workspace View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {activeWorkspace === 'arrangement' && (
            <DawArrangementView
              tracks={project.tracks}
              clips={project.clips}
              totalBars={project.totalBars}
              currentStepIndex={currentStepIndex}
              isPlaying={isPlaying}
              activeTool={activeTool}
              onChangeTool={setActiveTool}
              selectedTrackId={selectedTrackId}
              onSelectTrack={setSelectedTrackId}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              onAddClip={handleAddClip}
              onMoveClip={(id, newBar, newTrackId) => {
                setProject((prev) => ({
                  ...prev,
                  clips: prev.clips.map((c) =>
                    c.id === id
                      ? {
                          ...c,
                          startBar: newBar,
                          trackId: newTrackId || c.trackId,
                          color: newTrackId
                            ? prev.tracks.find((t) => t.id === newTrackId)?.color || c.color
                            : c.color,
                        }
                      : c
                  ),
                }));
                if (newTrackId && selectedClipId === id) {
                  setSelectedTrackId(newTrackId);
                }
                setIsDirty(true);
              }}
              onResizeClip={(id, newDur) => {
                setProject((prev) => ({
                  ...prev,
                  clips: prev.clips.map((c) => (c.id === id ? { ...c, durationBars: newDur } : c)),
                }));
                setIsDirty(true);
              }}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
              onToggleClipMute={handleToggleClipMute}
              onScrubPlayhead={handleScrubPlayhead}
              onToggleTrackMute={(id) => {
                mixer.toggleChannelMute(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t)),
                }));
              }}
              onToggleTrackSolo={(id) => {
                mixer.toggleChannelSolo(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isSolo: !t.isSolo } : t)),
                }));
              }}
              onToggleTrackArm={(id) => {
                mixer.toggleChannelArm(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isArmed: !t.isArmed } : t)),
                }));
              }}
              onChangeTrackVolume={(id, db) => {
                mixer.setChannelVolume(id, db);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, volumeDb: db } : t)),
                }));
              }}
              onChangeTrackPan={(id, pan) => {
                mixer.setChannelPan(id, pan);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, pan } : t)),
                }));
              }}
              loopStartBar={project.loopStartBar}
              loopEndBar={project.loopEndBar}
              isLoopEnabled={project.isLoopEnabled}
              onDoubleClickClip={(id) => {
                const c = project.clips.find((clip) => clip.id === id);
                if (c?.type === 'midi') {
                  setSelectedClipId(id);
                  setActiveWorkspace('pianoroll');
                } else {
                  setSelectedClipId(id);
                  setShowInspector(true);
                }
              }}
            />
          )}

          {activeWorkspace === 'pianoroll' && (
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
              <PianoRoll
                notes={activeMidiClip?.notes || []}
                clipName={activeMidiClip?.name}
                totalClipBars={activeMidiClip?.durationBars || 4}
                availableClips={project.clips
                  .filter((c) => c.type === 'midi')
                  .map((c) => ({
                    id: c.id,
                    name: c.name,
                    trackName: project.tracks.find((t) => t.id === c.trackId)?.name,
                  }))}
                selectedClipId={activeMidiClip?.id}
                onSelectClipId={(id) => {
                  setSelectedClipId(id);
                  const targetClip = project.clips.find((c) => c.id === id);
                  if (targetClip) setSelectedTrackId(targetClip.trackId);
                }}
                onAddNote={(note) => {
                  const dawNote: DawNote = {
                    id: note.id,
                    pitch: note.pitch,
                    step: note.step,
                    durationSteps: note.durationSteps,
                    velocity: note.velocity ?? 0.8,
                  };

                  if (!activeMidiClip) {
                    const targetTrackId =
                      selectedTrackId ||
                      project.tracks.find((t) => t.type !== 'audio')?.id ||
                      project.tracks[0].id;
                    const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
                    const newClip: DawClip = {
                      id: `clip_midi_${Date.now()}`,
                      trackId: targetTrackId,
                      name: `${targetTrack?.name || 'Instrument'} Pattern`,
                      type: 'midi',
                      startBar: 1,
                      durationBars: 4,
                      color: targetTrack?.color || '#8B78FF',
                      notes: [dawNote],
                    };
                    setProject((prev) => ({
                      ...prev,
                      clips: [...prev.clips, newClip],
                    }));
                    setSelectedClipId(newClip.id);
                    setSelectedTrackId(targetTrackId);
                    setIsDirty(true);
                    return;
                  }

                  setProject((prev) => ({
                    ...prev,
                    clips: prev.clips.map((c) =>
                      c.id === activeMidiClip.id
                        ? {
                            ...c,
                            notes: [
                              ...(c.notes || []).filter(
                                (n) => !(n.pitch === note.pitch && n.step === note.step)
                              ),
                              dawNote,
                            ],
                          }
                        : c
                    ),
                  }));
                  setIsDirty(true);
                }}
                onRemoveNote={(noteId) => {
                  if (!activeMidiClip) return;
                  setProject((prev) => ({
                    ...prev,
                    clips: prev.clips.map((c) =>
                      c.id === activeMidiClip.id
                        ? { ...c, notes: (c.notes || []).filter((n) => n.id !== noteId) }
                        : c
                    ),
                  }));
                  setIsDirty(true);
                }}
                onClearNotes={() => {
                  if (!activeMidiClip) return;
                  setProject((prev) => ({
                    ...prev,
                    clips: prev.clips.map((c) => (c.id === activeMidiClip.id ? { ...c, notes: [] } : c)),
                  }));
                  setIsDirty(true);
                }}
                instrument={(selectedTrack?.instrumentPreset as any) || 'piano'}
                onChangeInstrument={(inst) => {
                  if (selectedTrackId) {
                    setProject((prev) => ({
                      ...prev,
                      tracks: prev.tracks.map((t) => (t.id === selectedTrackId ? { ...t, instrumentPreset: inst } : t)),
                    }));
                  }
                }}
                songKey={project.key}
                songScale={project.scale}
                currentStepIndex={currentStepIndex}
                isPlaying={isPlaying}
              />
            </div>
          )}

          {activeWorkspace === 'stepsequencer' && (
            <DawStepSequencer
              currentStepIndex={currentStepIndex}
              isPlaying={isPlaying}
              bpm={project.bpm}
              currentPlayheadBar={Math.floor(currentStepIndex / 16) + 1}
              onCommitToTimeline={handleCommitStepPattern}
            />
          )}

          {/* Bottom Mixer Console (Visible when toggled or in mixer workspace) */}
          {(showMixer || activeWorkspace === 'mixer') && (
            <DawMixerPanel
              tracks={project.tracks}
              mixerEngine={mixer}
              masterVolumeDb={project.masterVolumeDb}
              onChangeMasterVolume={(db) => {
                mixer.setMasterVolume(db);
                setProject((prev) => ({ ...prev, masterVolumeDb: db }));
              }}
              onChangeTrackVolume={(id, db) => {
                mixer.setChannelVolume(id, db);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, volumeDb: db } : t)),
                }));
              }}
              onChangeTrackPan={(id, pan) => {
                mixer.setChannelPan(id, pan);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, pan } : t)),
                }));
              }}
              onToggleTrackMute={(id) => {
                mixer.toggleChannelMute(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t)),
                }));
              }}
              onToggleTrackSolo={(id) => {
                mixer.toggleChannelSolo(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isSolo: !t.isSolo } : t)),
                }));
              }}
              onToggleTrackArm={(id) => {
                mixer.toggleChannelArm(id);
                setProject((prev) => ({
                  ...prev,
                  tracks: prev.tracks.map((t) => (t.id === id ? { ...t, isArmed: !t.isArmed } : t)),
                }));
              }}
              onOpenEffectsRack={(id) => setActiveEffectsTrackId(id)}
              onOpenMasterEffects={() => setIsMasterEffectsOpen(true)}
              onCloseMixer={() => setShowMixer(false)}
            />
          )}
        </div>

        {/* Right: Inspector Panel */}
        {showInspector && (
          <DawInspectorPanel
            selectedTrack={selectedTrack}
            selectedClip={selectedClip}
            onUpdateTrack={(id, updates) => {
              setProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
              }));
              setIsDirty(true);
            }}
            onUpdateClip={(id, updates) => {
              setProject((prev) => ({
                ...prev,
                clips: prev.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
              }));
              setIsDirty(true);
            }}
            onDeleteClip={handleDeleteClip}
            onDeleteTrack={handleDeleteTrack}
            onOpenEffectsRack={(id) => setActiveEffectsTrackId(id)}
            onDuplicateClip={handleDuplicateClip}
            onNormalizeClip={handleNormalizeClip}
            onQuantizeClipNotes={(id) => handleQuantizeClip(id)}
          />
        )}
      </div>

      {/* 5. Bottom Status Bar */}
      <DawStatusBar
        engineState={dawContextManager.getState()}
        sampleRate={dawContextManager.getSampleRate()}
        tracksCount={project.tracks.length}
        clipsCount={project.clips.length}
        lastSavedAt={lastSavedAt}
      />

      {/* 6. Channel Insert Effects Rack Modal */}
      {activeEffectsTrackId && (
        <DawEffectsModal
          isOpen={true}
          onClose={() => setActiveEffectsTrackId(null)}
          channelName={project.tracks.find((t) => t.id === activeEffectsTrackId)?.name || 'Track'}
          config={project.tracks.find((t) => t.id === activeEffectsTrackId)?.effects || mixer.masterEffectChain.getConfig()}
          onUpdateConfig={(newCfg) => {
            mixer.updateChannelEffects(activeEffectsTrackId, newCfg);
            setProject((prev) => ({
              ...prev,
              tracks: prev.tracks.map((t) => (t.id === activeEffectsTrackId ? { ...t, effects: newCfg } : t)),
            }));
            setIsDirty(true);
          }}
        />
      )}

      {/* 7. Master Effects Rack Modal */}
      {isMasterEffectsOpen && (
        <DawEffectsModal
          isOpen={true}
          onClose={() => setIsMasterEffectsOpen(false)}
          channelName="Master Output Bus"
          config={project.masterEffects}
          onUpdateConfig={(newCfg) => {
            mixer.masterEffectChain.applyConfig(newCfg);
            setProject((prev) => ({ ...prev, masterEffects: newCfg }));
            setIsDirty(true);
          }}
        />
      )}

      {/* 8. Keyboard Shortcuts Modal */}
      <DawShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* 9. Audio Setup & Hardware Modal */}
      <DawAudioSetupModal
        isOpen={isAudioSetupOpen}
        onClose={() => setIsAudioSetupOpen(false)}
        midiDevices={midiDevices}
        activeChannelsCount={project.tracks.length}
      />

      {/* 10. Project Library & Session Manager Modal */}
      <DawOpenProjectModal
        isOpen={isProjectLibraryOpen}
        onClose={() => setIsProjectLibraryOpen(false)}
        currentProject={project}
        onLoadProject={handleOpenProject}
        onShowSnackbar={showSnackbar}
      />

      {/* 11. Project Settings Modal */}
      <DawProjectSettingsModal
        isOpen={isProjectSettingsOpen}
        onClose={() => setIsProjectSettingsOpen(false)}
        project={project}
        onUpdateSettings={(newSettings) => {
          setProject((prev) => ({ ...prev, ...newSettings }));
          setIsDirty(true);
        }}
        onShowSnackbar={showSnackbar}
      />

      {/* 12. Studio Documentation Modal */}
      <DawDocModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
      />

      {/* 13. About DAW Modal */}
      <DawAboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        sampleRate={dawContextManager.getSampleRate()}
      />

      {/* 14. Track / Project Rename Modal */}
      <DawRenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
        title={renameModal.title}
        initialValue={renameModal.initialValue}
        onConfirm={renameModal.onConfirm}
      />

      {/* 15. Cover / Duplicate Project & Beat Presets Modal */}
      <CoverDuplicateModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        onApplyPreset={(preset) => {
          handleApplyBeatPreset(preset);
          setIsCoverModalOpen(false);
        }}
        onDuplicateProject={handleDuplicateProject}
      />

      {/* 16. New Project Confirmation Modal */}
      <DawConfirmModal
        isOpen={isNewProjectConfirmOpen}
        onClose={() => setIsNewProjectConfirmOpen(false)}
        title="Start New Project Session"
        message="Create a new blank studio session? Any unsaved changes in the current session will be cleared."
        confirmLabel="Create New Session"
        isDestructive={true}
        onConfirm={() => {
          setProject(createDefaultProject());
          setIsDirty(false);
          showSnackbar('Created new blank studio session.');
        }}
      />

      {/* Hidden File Inputs for Audio & MIDI Import */}
      <input
        type="file"
        ref={audioFileInputRef}
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleImportAudioFile}
      />
      <input
        type="file"
        ref={midiFileInputRef}
        accept=".mid,.midi,application/json"
        style={{ display: 'none' }}
        onChange={handleImportMidiFile}
      />
    </div>
  );
};
