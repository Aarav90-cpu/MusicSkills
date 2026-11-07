import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { SongSection, SongVersion } from '../types';

export const ChatCreationPage: React.FC = () => {
  const {
    activeChat,
    activeChatId,
    refreshChats,
    playTrack,
    togglePlayback,
    currentTrack,
    seekTrack,
    currentTime,
    isPlaying,
    setRoute,
    showSnackbar,
    addActivityEvent,
  } = useApp();

  // Active step in flow: 1: style, 2: lyrics, 3: review, 4: generate, 5: result
  const [currentStep, setCurrentStep] = useState<number>(1);

  // --- STEP 1: STYLE STATE ---
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('pop');
  const [subgenre, setSubgenre] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>(['energetic']);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>(['dance music']);
  const [instrumentation, setInstrumentation] = useState<string[]>(['synthesizer', 'electric piano']);
  const [customInst, setCustomInst] = useState('');
  const [vocalDelivery, setVocalDelivery] = useState('sung');
  const [bpm, setBpm] = useState(120);
  const [rootKey, setRootKey] = useState('C');
  const [scale, setScale] = useState('major');

  // --- STEP 2: LYRICS STATE ---
  const [lyrics, setLyrics] = useState<Record<string, string[]>>({});
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [activeSectionScroll, setActiveSectionScroll] = useState<string | null>(null);
  const [recentEditedSection, setRecentEditedSection] = useState<string | null>(null);

  // --- STEP 3: PYTHON CODE & ARRANGEMENT STATE ---
  const [reviewSubTab, setReviewSubTab] = useState<'blueprint' | 'code'>('blueprint');
  const [customPythonCode, setCustomPythonCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [isEditingCode, setIsEditingCode] = useState<boolean>(false);
  const [codeTweakInput, setCodeTweakInput] = useState<string>('');
  const [codeLinesAdded, setCodeLinesAdded] = useState<number>(0);
  const [codeLinesRemoved, setCodeLinesRemoved] = useState<number>(0);
  const [codeDiffSummary, setCodeDiffSummary] = useState<string>('');
  const [codeAccepted, setCodeAccepted] = useState<boolean>(false);

  // --- STEP 4: GENERATION PROGRESS STATE ---
  const [genStage, setGenStage] = useState(0);
  const stages = [
    'Composing harmonic progressions and song architecture',
    'Generating rhythmic bassline and syncopated counterpoint',
    'Arranging multi-track drums and percussive accents',
    'Applying micro-timing jitter and velocity dynamics',
    'Synthesizing multi-track Standard MIDI arrangement',
    'Rendering high-fidelity MP3 master with FluidSynth and FFmpeg',
  ];

  // --- STEP 5: RESULT & KARAOKE STATE ---
  const [activeKaraokeIndex, setActiveKaraokeIndex] = useState(0);
  const [latestVersion, setLatestVersion] = useState<SongVersion | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Load chat state on mount / change
  useEffect(() => {
    if (activeChat) {
      setTopic(activeChat.style.topic || activeChat.name);
      setDescription(activeChat.style.description || '');
      setGenre(activeChat.style.genre || 'pop');
      setSubgenre(activeChat.style.subgenre || '');
      setSelectedMoods(activeChat.style.moods || ['energetic']);
      setSelectedPurposes(activeChat.style.purposes || ['dance music']);
      setInstrumentation(activeChat.style.instrumentation || ['synthesizer', 'drums']);
      setVocalDelivery(activeChat.style.vocalDelivery || 'sung');
      setBpm(activeChat.style.bpm || 120);
      setRootKey(activeChat.style.key || 'C');
      setScale(activeChat.style.scale || 'major');
      setLyrics(activeChat.lyrics || {});

      if (activeChat.versions.length > 0) {
        setLatestVersion(activeChat.versions[activeChat.versions.length - 1]);
        setCurrentStep(5);
      } else if (Object.keys(activeChat.lyrics).length > 0) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    }
  }, [activeChat]);

  // Sync state to backend
  const persistChatChanges = async (updates: any) => {
    if (!activeChatId) return;
    try {
      await fetch(`/api/chats/${activeChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await refreshChats();
    } catch (e) {
      console.error('Failed to sync chat:', e);
    }
  };

  // Genre profiles with icons
  const majorGenres = [
    { id: 'pop', name: 'Pop', icon: 'music_note', defaultBpm: 120, scale: 'major' },
    { id: 'hip-hop', name: 'Hip-Hop / Rap', icon: 'album', defaultBpm: 88, scale: 'minor' },
    { id: 'rock', name: 'Rock', icon: 'electric_guitar', defaultBpm: 128, scale: 'minor' },
    { id: 'electronic', name: 'Electronic / EDM', icon: 'speaker', defaultBpm: 126, scale: 'minor' },
    { id: 'jazz', name: 'Jazz', icon: 'piano', defaultBpm: 110, scale: 'dorian' },
    { id: 'classical', name: 'Classical', icon: 'music_video', defaultBpm: 90, scale: 'major' },
    { id: 'country', name: 'Country / Folk', icon: 'radio', defaultBpm: 105, scale: 'major' },
    { id: 'indian', name: 'Indian Music', icon: 'surround_sound', defaultBpm: 96, scale: 'bhairav' },
    { id: 'reggae', name: 'Reggae / Caribbean', icon: 'waves', defaultBpm: 78, scale: 'major' },
    { id: 'metal', name: 'Metal', icon: 'flash_on', defaultBpm: 145, scale: 'phrygian' },
  ];

  const subgenresByGenre: Record<string, string[]> = {
    'pop': ['Dance Pop', 'Synth-Pop', 'Electropop', 'Teen Pop'],
    'hip-hop': ['Trap', 'Drill', 'Boom Bap', 'Conscious Rap', 'Memphis Phonk'],
    'rock': ['Classic Rock', 'Hard Rock', 'Punk Rock', 'Alternative Rock', 'Indie Rock'],
    'electronic': ['House', 'Techno', 'Trance', 'Dubstep', 'Drum and Bass', 'Future Bass'],
    'jazz': ['Bebop', 'Swing', 'Smooth Jazz', 'Fusion'],
    'classical': ['Baroque', 'Romantic', 'Opera', 'Symphony'],
    'country': ['Bluegrass', 'Americana', 'Country Pop', 'Folk Rock'],
    'indian': ['Bollywood', 'Bhangra', 'Qawwali', 'Ghazal', 'Hindustani Classical', 'Carnatic'],
    'reggae': ['Ska', 'Dancehall', 'Dub', 'Roots Reggae'],
    'metal': ['Heavy Metal', 'Death Metal', 'Metalcore', 'Symphonic Metal'],
  };

  const allMoods = [
    'Happy', 'Sad', 'Romantic', 'Heartbroken', 'Energetic', 'Motivational',
    'Nostalgic', 'Dark', 'Aggressive', 'Peaceful', 'Mysterious', 'Spiritual', 'Cinematic', 'Emotional',
  ];

  const allPurposes = [
    'Dance music', 'Party music', 'Workout music', 'Love songs', 'Lullabies', 'Devotional songs',
    'Wedding songs', 'Festival music', 'Protest songs', 'Storytelling songs', 'Advertisement jingles', 'Background music',
  ];

  // Dynamic compound identity line
  const identityLine = [
    subgenre || majorGenres.find(g => g.id === genre)?.name || genre,
    selectedMoods.slice(0, 2).join(' / '),
    selectedPurposes[0],
    instrumentation.slice(0, 2).join(' & '),
  ].filter(Boolean).join(' + ');

  // Suggest Button Parser
  const handleSuggest = () => {
    const text = (description + ' ' + topic).toLowerCase();
    if (text.includes('phonk') || text.includes('drift')) {
      setGenre('hip-hop');
      setSubgenre('Memphis Phonk');
      setSelectedMoods(['Dark', 'Aggressive']);
      setSelectedPurposes(['Workout music']);
      setInstrumentation(['Cowbell', '808 Bass', 'Distorted Synth']);
      setBpm(136);
    } else if (text.includes('rock') || text.includes('guitar')) {
      setGenre('rock');
      setSelectedMoods(['Energetic']);
      setInstrumentation(['Overdrive Guitar', 'Electric Bass', 'Drums']);
      setBpm(128);
    } else if (text.includes('bollywood') || text.includes('indian') || text.includes('hindi')) {
      setGenre('indian');
      setSubgenre('Bollywood');
      setSelectedMoods(['Energetic', 'Romantic']);
      setSelectedPurposes(['Festival music']);
      setInstrumentation(['Sitar', 'Dholak', 'Strings']);
      setBpm(104);
    } else {
      setSelectedMoods(['Energetic', 'Motivational']);
      setBpm(124);
    }
    showSnackbar('Applied style recommendations');
  };

  // Step 1 -> Lock Style & Advance to Lyrics
  const handleLockStyle = async () => {
    const updatedStyle = {
      topic: topic.trim() || activeChat?.name || 'Untitled',
      description,
      genre,
      subgenre,
      moods: selectedMoods,
      purposes: selectedPurposes,
      instrumentation,
      vocalDelivery,
      bpm,
      key: rootKey,
      scale,
      identityLine,
    };

    addActivityEvent({
      stage: `Locked style: ${identityLine}`,
      status: 'done',
    });

    await persistChatChanges({ style: updatedStyle });

    // If lyrics don't exist yet, generate them dynamically
    if (Object.keys(lyrics).length === 0) {
      setCurrentStep(2);
      handleGenerateLyrics();
    } else {
      setCurrentStep(2);
    }
  };

  // Step 2 -> Generate / Refresh Lyrics with AI
  const handleGenerateLyrics = async () => {
    setIsGeneratingLyrics(true);
    addActivityEvent({
      stage: `AI composing lyrics for "${topic || 'Song'}"`,
      status: 'running',
    });

    try {
      const res = await fetch('/api/ai/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'New Song',
          genre,
          mood: selectedMoods[0] || 'energetic',
          purpose: selectedPurposes[0] || 'dance music',
          vocalDelivery,
          sections: activeChat?.sections || [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLyrics(data.lyrics);
        setRecentEditedSection('ALL');
        setTimeout(() => setRecentEditedSection(null), 1200);
        await persistChatChanges({ lyrics: data.lyrics });
        addActivityEvent({
          stage: `Lyrics successfully generated with section timestamps`,
          status: 'done',
        });
      }
    } catch (e) {
      console.error('Failed to generate lyrics:', e);
      addActivityEvent({
        stage: `Lyric generation failed`,
        status: 'error',
      });
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // Step 2 -> AI Chat Refinement
  const handleSendChatInstruction = async (textToSend?: string) => {
    const msg = textToSend || chatPrompt;
    if (!msg.trim()) return;

    addActivityEvent({
      stage: `AI prompt: "${msg}"`,
      status: 'running',
    });
    setChatPrompt('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          message: msg,
          currentLyrics: lyrics,
          style: { genre, moods: selectedMoods, bpm },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showSnackbar(data.reply.slice(0, 80));
        addActivityEvent({
          stage: `AI refined song parameters`,
          status: 'done',
          details: data.reply,
        });
        await refreshChats();
      }
    } catch (err) {
      console.error('Chat refinement error:', err);
    }
  };

  // Step 3 -> Generate AI Python Script
  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch('/api/ai/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          topic: topic || activeChat?.name || 'Untitled Project',
          genre,
          mood: selectedMoods[0] || 'energetic',
          bpm,
          key: rootKey,
          sections: activeChat?.sections,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomPythonCode(data.code);
        setCodeLinesAdded(data.linesAdded || data.lineCount || 0);
        setCodeLinesRemoved(0);
        setCodeDiffSummary(data.summary || 'Generated custom multi-track Python composition');
        setCodeAccepted(true);
        setReviewSubTab('code');
        showSnackbar(`AI wrote ${data.lineCount} lines of Python composition code`);
      } else {
        const err = await res.json();
        showSnackbar(`Code generation failed: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      showSnackbar(`Network error: ${e.message}`);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Step 3 -> Tweak AI Python Script
  const handleEditCode = async () => {
    if (!codeTweakInput.trim() || !customPythonCode) return;
    setIsEditingCode(true);
    try {
      const res = await fetch('/api/ai/code/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          code: customPythonCode,
          instruction: codeTweakInput.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomPythonCode(data.code);
        setCodeLinesAdded(data.linesAdded || 0);
        setCodeLinesRemoved(data.linesRemoved || 0);
        setCodeDiffSummary(data.summary || 'Updated Python composition code');
        setCodeTweakInput('');
        showSnackbar(`Updated code: +${data.linesAdded} / -${data.linesRemoved} lines`);
      } else {
        const err = await res.json();
        showSnackbar(`Code tweak failed: ${err.error}`);
      }
    } catch (e: any) {
      showSnackbar(`Error: ${e.message}`);
    } finally {
      setIsEditingCode(false);
    }
  };

  // Step 4 -> Generate Music Track
  const handleStartMusicGeneration = async () => {
    setCurrentStep(4);
    setGenStage(0);

    const stageInterval = setInterval(() => {
      setGenStage(prev => {
        if (prev < stages.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);

    addActivityEvent({
      stage: `Generating multi-track arrangement for "${topic}"`,
      status: 'running',
    });

    try {
      let res;
      if (customPythonCode && codeAccepted) {
        res = await fetch('/api/ai/code/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChatId,
            code: customPythonCode,
          }),
        });
      } else {
        res = await fetch('/api/generate-music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: activeChatId }),
        });
      }

      clearInterval(stageInterval);

      if (res.ok) {
        const data = await res.json();
        setLatestVersion(data.version);
        setPeaks(data.peaks || []);
        addActivityEvent({
          stage: `Rendered ${data.version.version} (MIDI & MP3)`,
          status: 'done',
        });
        showSnackbar(`Music generated successfully: ${data.version.version}`);
        setCurrentStep(5);
        await refreshChats();

        // Autoplay generated version
        if (activeChatId) {
          const mp3File = data.version.mp3File || (data.version.midiFile ? data.version.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat?.folderName || 'song'}_v1.mp3`);
          playTrack({
            chatId: activeChatId,
            songName: topic || activeChat?.name || 'Untitled',
            artist: 'AI Studio Producer',
            album: 'Studio Master Compositions',
            coverArtUrl: activeChat?.coverArtUrl || `/api/audio/${activeChatId}/cover?title=${encodeURIComponent(topic || activeChat?.name || 'Untitled')}`,
            version: data.version.version,
            mp3Url: `/api/audio/${activeChatId}/${mp3File}`,
            midiUrl: `/api/audio/${activeChatId}/${data.version.midiFile}`,
            durationSec: data.version.durationSec,
            lyrics,
            bpm,
          });
        }
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
    } catch (e: any) {
      clearInterval(stageInterval);
      showSnackbar(`Music generation failed: ${e.message}`);
      addActivityEvent({
        stage: `Music generation failed: ${e.message}`,
        status: 'error',
      });
      setCurrentStep(3);
    }
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 24px' }}>
      {/* 5-STEPPER HEADER */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {[
            { step: 1, label: 'Style' },
            { step: 2, label: 'Lyrics' },
            { step: 3, label: 'Review' },
            { step: 4, label: 'Generate' },
            { step: 5, label: 'Result' },
          ].map((item, idx) => {
            const isDone = currentStep > item.step;
            const isCurrent = currentStep === item.step;

            return (
              <React.Fragment key={item.step}>
                {idx > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: '2px',
                      backgroundColor: isDone ? 'var(--color-primary)' : 'var(--color-outline)',
                      transition: 'background-color 0.3s ease',
                      margin: '0 8px',
                    }}
                  />
                )}
                <div
                  onClick={() => {
                    if (isDone || (item.step === 5 && latestVersion)) {
                      setCurrentStep(item.step);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isDone ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: isDone
                        ? 'var(--color-primary)'
                        : isCurrent
                        ? 'var(--color-primary-container)'
                        : 'var(--color-container)',
                      color: isDone ? '#0F0E15' : isCurrent ? 'var(--color-on-primary-container)' : 'var(--color-text-secondary)',
                      border: isCurrent ? '2px solid var(--color-primary)' : '1px solid var(--color-outline)',
                    }}
                  >
                    {isDone ? (
                      <span className="material-icons-round" style={{ fontSize: '18px' }}>check</span>
                    ) : (
                      item.step
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          STEP 1: STYLE
          ========================================================================= */}
      {currentStep === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'flex-start' }}>
          {/* Left Column: Form Pickers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>What kind of song?</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
                Pick your genre, mood, and instrumentation, or describe your vision in plain words.
              </p>
            </div>

            {/* Topic & Description */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Song Topic (Required)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Midnight Highway Run, Solar Flare, Lost City"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>
                    Description & Vibe
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggest}
                    className="btn btn-tonal"
                    style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: '14px' }}>auto_awesome</span>
                    <span>Suggest Style</span>
                  </button>
                </div>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g. A fast dark phonk track with heavy cowbells and relentless energy for workout..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ height: 'auto', padding: '12px', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* 10 Major Genres */}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
                Major Genre
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {majorGenres.map(g => {
                  const isSelected = genre === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        setGenre(g.id);
                        setSubgenre('');
                        setBpm(g.defaultBpm);
                        setScale(g.scale);
                      }}
                      className="card"
                      style={{
                        padding: '14px 10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: isSelected ? 'var(--color-primary-container)' : 'var(--color-container)',
                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-outline)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: '26px', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                        {g.icon}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500 }}>
                        {g.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subgenres */}
            {subgenresByGenre[genre] && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Subgenre & Flavor
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {subgenresByGenre[genre].map(sub => (
                    <button
                      key={sub}
                      type="button"
                      className={`chip ${subgenre === sub ? 'chip-active' : ''}`}
                      onClick={() => setSubgenre(subgenre === sub ? '' : sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mood Chips (Up to 3) */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                Mood ({selectedMoods.length}/3)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allMoods.map(m => {
                  const isSelected = selectedMoods.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`chip ${isSelected ? 'chip-active' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMoods(selectedMoods.filter(x => x !== m));
                        } else if (selectedMoods.length < 3) {
                          setSelectedMoods([...selectedMoods, m]);
                        }
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Purpose Chips */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                Functional Purpose
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {allPurposes.map(p => {
                  const isSelected = selectedPurposes.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`chip ${isSelected ? 'chip-active' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPurposes(selectedPurposes.filter(x => x !== p));
                        } else if (selectedPurposes.length < 2) {
                          setSelectedPurposes([...selectedPurposes, p]);
                        }
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tempo & Key */}
            <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Master Tempo</label>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{bpm} BPM</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="190"
                  value={bpm}
                  onChange={e => setBpm(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Musical Key & Scale
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="input-field"
                    value={rootKey}
                    onChange={e => setRootKey(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                      <option key={k} value={k}>Key {k}</option>
                    ))}
                  </select>
                  <select
                    className="input-field"
                    value={scale}
                    onChange={e => setScale(e.target.value)}
                    style={{ flex: 1.2 }}
                  >
                    <option value="major">Major Scale</option>
                    <option value="minor">Natural Minor</option>
                    <option value="harmonic_minor">Harmonic Minor</option>
                    <option value="phrygian">Phrygian Mode</option>
                    <option value="bhairav">Bhairav (Indian Raga)</option>
                    <option value="dorian">Dorian Mode</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Song Identity Card */}
          <div style={{ position: 'sticky', top: '96px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '24px', border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-l2)' }}>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Compound Identity
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4, marginBottom: '16px' }}>
                {identityLine}
              </div>

              <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Genre:</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{genre}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Tempo:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{bpm} BPM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Key:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{rootKey} {scale}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Est. Duration:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>~03:05</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLockStyle}
                className="btn btn-gradient"
                style={{ width: '100%', marginTop: '24px', height: '48px', fontSize: '15px' }}
              >
                <span>Lock Style and Continue</span>
                <span className="material-icons-round">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: LYRICS & TUNE
          ========================================================================= */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Lyrics & Phrasing</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
              Written by the AI and timed with millisecond cues. Edit any line or ask the AI to revise sections.
            </p>
          </div>

          {/* Structure Timeline Bar (48px) */}
          <div
            style={{
              height: '48px',
              backgroundColor: 'var(--color-container)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-outline)',
              display: 'flex',
              overflow: 'hidden',
              padding: '4px',
              gap: '3px',
            }}
          >
            {(activeChat?.sections || []).map(sec => {
              const colorMap: Record<string, string> = {
                intro: 'var(--section-intro)',
                verse: 'var(--section-verse)',
                'pre-chorus': 'var(--section-prechorus)',
                chorus: 'var(--section-chorus)',
                bridge: 'var(--section-bridge)',
                instrumental_break: 'var(--section-break)',
                outro: 'var(--section-outro)',
              };
              const bg = colorMap[sec.type] || 'var(--color-primary)';

              return (
                <div
                  key={sec.name}
                  onClick={() => setActiveSectionScroll(sec.name)}
                  title={`${sec.name} (${sec.bars} bars)`}
                  style={{
                    flex: sec.bars,
                    backgroundColor: bg,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0F0E15',
                    cursor: 'pointer',
                    userSelect: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                  }}
                >
                  {sec.name}
                </div>
              );
            })}
          </div>

          {/* Section Lyrics Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isGeneratingLyrics ? (
              <div
                className="card card-specular animate-pop-in"
                style={{
                  padding: '48px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, rgba(31, 29, 41, 0.95) 0%, rgba(22, 21, 29, 0.98) 100%)',
                  border: '1px solid var(--color-primary)',
                  boxShadow: '0 16px 48px rgba(107, 78, 255, 0.28)',
                }}
              >
                {/* Holographic Glowing AI Orb */}
                <div
                  className="animate-orb-pulse"
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'var(--gradient-signature)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <span className="material-icons-round" style={{ fontSize: '32px', color: '#ffffff' }}>
                    auto_awesome
                  </span>
                </div>

                {/* Animated Equalizer Rhythmic Visualizer */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '34px', marginBottom: '18px' }}>
                  <div className="eq-bar-1" style={{ width: '5px', background: 'var(--color-primary)', borderRadius: '3px' }} />
                  <div className="eq-bar-2" style={{ width: '5px', background: 'var(--color-warning, #FFB020)', borderRadius: '3px' }} />
                  <div className="eq-bar-3" style={{ width: '5px', background: '#FF4FA3', borderRadius: '3px' }} />
                  <div className="eq-bar-4" style={{ width: '5px', background: 'var(--color-primary)', borderRadius: '3px' }} />
                  <div className="eq-bar-2" style={{ width: '5px', background: '#3CC4B2', borderRadius: '3px' }} />
                  <div className="eq-bar-1" style={{ width: '5px', background: '#8E9BFF', borderRadius: '3px' }} />
                </div>

                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
                  AI Co-Writer Composing Lyrics & Phrasing
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '440px', lineHeight: 1.5, marginBottom: '18px' }}>
                  Structuring melodic hook lines, internal rhymes, and emotional contour for <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>"{topic || 'Your Song'}"</span>.
                </div>

                {/* Sleek typing bounce dots */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="typing-dot-1" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                  <div className="typing-dot-2" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF4FA3' }} />
                  <div className="typing-dot-3" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-warning, #FFB020)' }} />
                </div>
              </div>
            ) : (
              Object.entries(lyrics).map(([secName, lines]) => (
                <div
                  key={secName}
                  className={`card card-specular animate-pop-in ${recentEditedSection === 'ALL' || recentEditedSection === secName ? 'animate-text-pulse' : ''}`}
                  style={{
                    padding: '20px 24px',
                    borderLeft: `4px solid ${
                      secName.toLowerCase().includes('chorus')
                        ? 'var(--section-chorus)'
                        : secName.toLowerCase().includes('verse')
                        ? 'var(--section-verse)'
                        : secName.toLowerCase().includes('bridge')
                        ? 'var(--section-bridge)'
                        : 'var(--color-primary)'
                    }`,
                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{secName}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className="animate-lyric-reveal"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          animationDelay: `${lIdx * 60}ms`,
                        }}
                      >
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '24px' }}>
                          0{lIdx + 1}
                        </span>
                        <input
                          type="text"
                          className="input-field"
                          value={line}
                          onChange={e => {
                            const updated = { ...lyrics };
                            updated[secName][lIdx] = e.target.value;
                            setLyrics(updated);
                          }}
                          style={{ height: '38px', fontSize: '14px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI Chat Dock for Quick Refinement */}
          <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>chat</span>
              <span>Ask the AI for revisions</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {['Punchier chorus', 'More internal rhymes', 'Make Verse 2 darker', 'Increase emotional tension'].map(chip => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => handleSendChatInstruction(chip)}
                  style={{ height: '26px', fontSize: '11px' }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Rewrite the chorus to emphasize the night drive..."
                value={chatPrompt}
                onChange={e => setChatPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendChatInstruction();
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSendChatInstruction()}
                style={{ width: '48px', height: '48px', padding: 0 }}
              >
                <span className="material-icons-round">send</span>
              </button>
            </div>
          </div>

          {/* Navigation Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button type="button" className="btn btn-outlined" onClick={() => setCurrentStep(1)}>
              <span className="material-icons-round">arrow_back</span>
              <span>Back to Style</span>
            </button>

            <button type="button" className="btn btn-gradient" onClick={() => setCurrentStep(3)}>
              <span>Looks Good: Review</span>
              <span className="material-icons-round">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: REVIEW (Side-by-Side Comparison & Python Code Customizer)
          ========================================================================= */}
      {currentStep === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Review & Finalize</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
                Compare musical styling, review synchronized lyrics, and customize the AI Python composition script.
              </p>
            </div>

            {/* Subtab Toggle Buttons */}
            <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '3px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setReviewSubTab('blueprint')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: reviewSubTab === 'blueprint' ? 'var(--color-primary)' : 'transparent',
                  color: reviewSubTab === 'blueprint' ? '#000' : 'var(--color-text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>tune</span>
                <span>Musical Blueprint</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReviewSubTab('code');
                  if (!customPythonCode) {
                    handleGenerateCode();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: reviewSubTab === 'code' ? 'var(--color-primary)' : 'transparent',
                  color: reviewSubTab === 'code' ? '#000' : 'var(--color-text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span className="material-icons-round" style={{ fontSize: '16px' }}>code</span>
                <span>Python Composition Script</span>
                {customPythonCode && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: reviewSubTab === 'code' ? 'rgba(0,0,0,0.2)' : 'var(--color-primary)',
                      color: reviewSubTab === 'code' ? '#000' : '#000',
                      fontWeight: 700,
                    }}
                  >
                    +{codeLinesAdded || customPythonCode.split('\n').length}L
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Subtab 1: Blueprint View */}
          {reviewSubTab === 'blueprint' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Left: Style Card */}
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-outline)', paddingBottom: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>Musical Styling</span>
                  <span className="chip chip-active" style={{ height: '24px', fontSize: '11px', textTransform: 'capitalize' }}>
                    {genre}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Song Topic:</span>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>{topic || activeChat?.name}</div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Identity Formula:</span>
                    <div style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{identityLine}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-outline)' }}>
                    <span>Tempo & Key:</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{bpm} BPM · Key {rootKey} {scale}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vocal Delivery:</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{vocalDelivery}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Humanization:</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Natural (Active)</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Python Composition:</span>
                    <span style={{ color: codeAccepted ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {codeAccepted ? 'Custom Script Ready' : 'Standard Synthesizer'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Lyrics with Timestamps Card */}
              <div className="card" style={{ padding: '24px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-outline)', paddingBottom: '12px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>Lyrical Synchronization</span>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                    ~03:05 Total
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(lyrics).map(([sec, lines]) => (
                    <div key={sec}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {sec}
                      </div>
                      {lines.map((l, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontSize: '13px', padding: '3px 0' }}>
                          <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', minWidth: '60px' }}>
                            [{Math.floor(idx * 4)}s]
                          </span>
                          <span style={{ color: 'var(--color-text)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Python Code & Composition Engine */}
          {reviewSubTab === 'code' && (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-outline)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>terminal</span>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>composition.py · Multi-Track MIDI Architecture</span>
                  {customPythonCode && (
                    <span className="chip chip-active" style={{ height: '22px', fontSize: '11px' }}>
                      +{codeLinesAdded || 180} lines · {customPythonCode.split('\n').length} lines
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="btn btn-outlined"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <span className="material-icons-round">smart_toy</span>
                    <span>{isGeneratingCode ? 'Writing Python...' : 'Regenerate Script'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCodeAccepted(true);
                      showSnackbar('Accepted Python script: will be executed upon rendering');
                    }}
                    className={`btn ${codeAccepted ? 'btn-primary' : 'btn-outlined'}`}
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <span className="material-icons-round">check_circle</span>
                    <span>{codeAccepted ? 'Script Accepted' : 'Accept Script'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCodeAccepted(false);
                      showSnackbar('Reverted to standard procedural synthesizer');
                    }}
                    className="btn btn-outlined"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <span className="material-icons-round">close</span>
                    <span>Use Standard Synth</span>
                  </button>
                </div>
              </div>

              {codeDiffSummary && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(110, 68, 255, 0.1)', border: '1px solid rgba(110, 68, 255, 0.25)', fontSize: '12px', color: 'var(--color-text)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Tension & Arrangement Architecture: </span>
                  {codeDiffSummary}
                </div>
              )}

              {/* Code Textarea Editor */}
              <div style={{ position: 'relative' }}>
                <textarea
                  value={customPythonCode}
                  onChange={e => setCustomPythonCode(e.target.value)}
                  placeholder="Click 'AI Write Python Script' to have the AI write a custom composition script for this track..."
                  spellCheck={false}
                  style={{
                    width: '100%',
                    height: '380px',
                    backgroundColor: '#07060A',
                    color: '#E2E8F0',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    tabSize: 4,
                    whiteSpace: 'pre',
                  }}
                />
              </div>

              {/* AI Code Tweak Box */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={codeTweakInput}
                  onChange={e => setCodeTweakInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEditCode()}
                  placeholder='Ask AI to adjust script: e.g. "Add a heavier beat drop", "Double-time snare in climb", "Change BPM to 128"...'
                  className="input"
                  style={{ flex: 1, height: '40px', fontSize: '13px' }}
                />
                <button
                  type="button"
                  onClick={handleEditCode}
                  disabled={isEditingCode || !codeTweakInput.trim()}
                  className="btn btn-primary"
                  style={{ height: '40px', padding: '0 18px', fontSize: '13px' }}
                >
                  <span className="material-icons-round">auto_fix_high</span>
                  <span>{isEditingCode ? 'Adjusting...' : 'Tweak Script'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Full-Width Generate Action */}
          <div
            className="card"
            style={{
              padding: '24px',
              backgroundColor: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Ready to render multi-track master</span>
                <span className="chip chip-active" style={{ height: '22px', fontSize: '11px' }}>
                  {customPythonCode && codeAccepted ? 'Custom Python Engine Active' : 'Standard Synthesizer'}
                </span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Creates 5 Standard MIDI tracks (Chords, Bass, Lead, Percussion) and renders a 192k MP3 master via FluidSynth.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setRoute('video')}
                className="btn btn-outlined"
                style={{ height: '52px', padding: '0 18px', fontSize: '14px' }}
              >
                <span className="material-icons-round">movie_filter</span>
                <span>Open 3D Studio</span>
              </button>

              <button
                type="button"
                onClick={handleStartMusicGeneration}
                className="btn btn-gradient"
                style={{ height: '56px', padding: '0 32px', fontSize: '16px', fontWeight: 700 }}
              >
                <span className="material-icons-round">graphic_eq</span>
                <span>Generate Music Track</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: GENERATING (Background Progress Wheel)
          ========================================================================= */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 0' }}>
          <div
            style={{
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              border: '3px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
              boxShadow: 'var(--gradient-glow)',
            }}
            className="pulse-ring"
          >
            <span className="material-icons-round" style={{ fontSize: '64px', color: 'var(--color-primary)' }}>
              music_note
            </span>
          </div>

          <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>
            {stages[genStage]}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '480px', marginBottom: '32px' }}>
            Stage {genStage + 1} of {stages.length}. Applying human timing jitter and velocity swing to bypass AI detection filters.
          </p>

          <div style={{ width: '100%', maxWidth: '420px', height: '6px', backgroundColor: 'var(--color-container)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${((genStage + 1) / stages.length) * 100}%`,
                height: '100%',
                background: 'var(--gradient-signature)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 5: RESULT & SYNCHRONIZED KARAOKE
          ========================================================================= */}
      {currentStep === 5 && (
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '32px', alignItems: 'flex-start' }}>
          {/* Left Column: Player & Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '22px', marginBottom: '4px' }}>{topic || activeChat?.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {latestVersion?.version || 'v1'} · {bpm} BPM · Key {rootKey}
                  </div>
                </div>

                <div className="chip chip-active">
                  <span className="material-icons-round" style={{ fontSize: '14px' }}>check</span>
                  <span>Humanized Arrangement</span>
                </div>
              </div>

              {/* Waveform Player */}
              <div style={{ margin: '20px 0' }}>
                <WaveformVisualizer
                  peaks={peaks}
                  currentTime={currentTime}
                  duration={latestVersion?.durationSec || 180}
                  onSeek={seekTrack}
                  height={120}
                />
              </div>

              {/* Playback Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '16px 0' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeChatId && latestVersion) {
                      if (currentTrack && currentTrack.chatId === activeChatId) {
                        togglePlayback();
                      } else {
                        const mp3File = latestVersion.mp3File || (latestVersion.midiFile ? latestVersion.midiFile.replace(/\.mid$/, '.mp3') : `${activeChat?.folderName || 'song'}_${latestVersion.version || 'v1'}.mp3`);
                        playTrack({
                          chatId: activeChatId,
                          songName: topic || activeChat?.name || 'Untitled',
                          artist: 'AI Studio Producer',
                          album: 'Studio Master Compositions',
                          coverArtUrl: activeChat?.coverArtUrl || `/api/audio/${activeChatId}/cover?title=${encodeURIComponent(topic || activeChat?.name || 'Untitled')}`,
                          version: latestVersion.version,
                          mp3Url: `/api/audio/${activeChatId}/${mp3File}`,
                          midiUrl: `/api/audio/${activeChatId}/${latestVersion.midiFile}`,
                          durationSec: latestVersion.durationSec || 180,
                          lyrics,
                          bpm,
                        });
                      }
                    }
                  }}
                  className="btn btn-gradient"
                  style={{ height: '54px', padding: '0 32px', fontSize: '15px' }}
                >
                  <span className="material-icons-round" style={{ fontSize: '24px' }}>
                    {isPlaying && currentTrack?.chatId === activeChatId ? 'pause' : 'play_arrow'}
                  </span>
                  <span>
                    {isPlaying && currentTrack?.chatId === activeChatId ? 'Pause Master Audio' : 'Play Master Audio'}
                  </span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Button 1: Do the Vocals */}
              <button
                type="button"
                onClick={() => setRoute('vocals')}
                className="btn btn-gradient"
                style={{ height: '52px', fontSize: '14px', gridColumn: 'span 2' }}
              >
                <span className="material-icons-round">mic</span>
                <span>Do the Vocals (Open Vocal Studio)</span>
              </button>

              {/* Button 2: Stage Scrolling Lyrics */}
              <button
                type="button"
                onClick={() => setRoute('lyrics')}
                className="btn btn-tonal"
                style={{ height: '48px', fontSize: '14px' }}
              >
                <span className="material-icons-round">subtitles</span>
                <span>Stage Scrolling Lyrics & Syncer</span>
              </button>

              {/* Button 3: Continue to Iterate */}
              <button
                type="button"
                onClick={() => setRoute('iterate')}
                className="btn btn-tonal"
                style={{ height: '48px', fontSize: '14px' }}
              >
                <span className="material-icons-round">replay</span>
                <span>Continue to Iterate</span>
              </button>

              {/* Button 4: Open 3D Video Studio */}
              <button
                type="button"
                onClick={() => setRoute('video')}
                className="btn btn-outlined"
                style={{ height: '48px', fontSize: '14px', borderColor: 'var(--color-primary)' }}
              >
                <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>movie_filter</span>
                <span>Open in 3D Video Studio</span>
              </button>

              {/* Button 5: Edit Python Code */}
              <button
                type="button"
                onClick={() => setRoute('code')}
                className="btn btn-outlined"
                style={{ height: '48px', fontSize: '14px' }}
              >
                <span className="material-icons-round">terminal</span>
                <span>Edit Python Script</span>
              </button>

              {/* Button 6: Re-Render Master */}
              <button
                type="button"
                onClick={handleStartMusicGeneration}
                className="btn btn-tonal"
                style={{ height: '48px', fontSize: '14px' }}
              >
                <span className="material-icons-round">refresh</span>
                <span>Re-Render Track Master</span>
              </button>

              {/* Button 7: Download MP3 */}
              {latestVersion && activeChatId && (
                <a
                  href={`/api/chats/${activeChatId}/download/${latestVersion.mp3File}`}
                  download
                  className="btn btn-outlined"
                  style={{ height: '48px', fontSize: '14px', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <span className="material-icons-round">download</span>
                  <span>Download MP3</span>
                </a>
              )}

              {/* Button 8: Export Project (.zip) */}
              {activeChatId && (
                <a
                  href={`/api/projects/${activeChatId}/export`}
                  download
                  className="btn btn-outlined"
                  style={{ height: '48px', fontSize: '14px', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <span className="material-icons-round">archive</span>
                  <span>Export Project (.zip)</span>
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Synced Karaoke Lyrics Panel with Live Waveform Animation */}
          <div className="card card-specular animate-pop-in" style={{ padding: '28px', maxHeight: '540px', overflowY: 'auto' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>lyrics</span>
                <span>Live Singing Teleprompter</span>
              </div>
              {isPlaying && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px' }}>
                  <div className="eq-bar-1" style={{ width: '3px', background: 'var(--color-primary)', borderRadius: '2px' }} />
                  <div className="eq-bar-2" style={{ width: '3px', background: '#FF4FA3', borderRadius: '2px' }} />
                  <div className="eq-bar-3" style={{ width: '3px', background: 'var(--color-warning, #FFB020)', borderRadius: '2px' }} />
                  <div className="eq-bar-4" style={{ width: '3px', background: '#3CC4B2', borderRadius: '2px' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(lyrics).map(([sec, lines], sIdx) => (
                <div key={sec} className="animate-pop-in" style={{ animationDelay: `${sIdx * 80}ms` }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '8px',
                    }}
                  >
                    {sec}
                  </div>
                  {lines.map((line, idx) => {
                    // Estimate active line based on playback time
                    const totalSecLines = Object.values(lyrics).reduce((acc, l) => acc + l.length, 0);
                    const lineDuration = (latestVersion?.durationSec || 180) / Math.max(1, totalSecLines);
                    const globalLineIdx = Object.values(lyrics).slice(0, sIdx).reduce((acc, l) => acc + l.length, 0) + idx;
                    const isLineActive = isPlaying && currentTime >= globalLineIdx * lineDuration && currentTime < (globalLineIdx + 1) * lineDuration;

                    return (
                      <div
                        key={idx}
                        className={`animate-lyric-reveal ${isLineActive ? 'animate-karaoke-active' : ''}`}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: isLineActive ? 'rgba(183, 166, 255, 0.16)' : 'var(--color-container)',
                          borderLeft: isLineActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: isLineActive ? 600 : 400,
                          color: isLineActive ? '#FFFFFF' : 'var(--color-text)',
                          lineHeight: 1.5,
                          animationDelay: `${idx * 40}ms`,
                          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
                        }}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

