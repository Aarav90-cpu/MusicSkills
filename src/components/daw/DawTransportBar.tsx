import React, { useState, useRef } from 'react';

interface DawTransportBarProps {
  isPlaying: boolean;
  isRecording: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleRecord: () => void;
  onReturnToStart: () => void;
  currentStepIndex: number; // 0-based 16th note index
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  timeSigNumerator: number;
  timeSigDenominator: number;
  onChangeTimeSig: (num: number, den: number) => void;
  songKey: string;
  songScale: string;
  onChangeKey: (key: string, scale: string) => void;
  isLoopEnabled: boolean;
  onToggleLoop: () => void;
  metronomeEnabled: boolean;
  onToggleMetronome: () => void;
  snapResolution: string;
  onChangeSnap: (snap: string) => void;
  onJumpToBar: (bar: number) => void;
}

export const DawTransportBar: React.FC<DawTransportBarProps> = ({
  isPlaying,
  isRecording,
  onTogglePlay,
  onStop,
  onToggleRecord,
  onReturnToStart,
  currentStepIndex,
  bpm,
  onChangeBpm,
  timeSigNumerator,
  timeSigDenominator,
  onChangeTimeSig,
  songKey,
  songScale,
  onChangeKey,
  isLoopEnabled,
  onToggleLoop,
  metronomeEnabled,
  onToggleMetronome,
  snapResolution,
  onChangeSnap,
  onJumpToBar,
}) => {
  // Tap tempo tracking
  const lastTapRef = useRef<number>(0);
  const tapDiffsRef = useRef<number[]>([]);
  const [isEditingBar, setIsEditingBar] = useState(false);
  const [barInputVal, setBarInputVal] = useState('');

  const handleTapTempo = () => {
    const now = Date.now();
    if (lastTapRef.current > 0) {
      const diff = now - lastTapRef.current;
      if (diff > 180 && diff < 2200) {
        tapDiffsRef.current.push(diff);
        if (tapDiffsRef.current.length > 4) tapDiffsRef.current.shift();
        const avg = tapDiffsRef.current.reduce((a, b) => a + b, 0) / tapDiffsRef.current.length;
        const newBpm = Math.round(60000 / avg);
        onChangeBpm(Math.max(40, Math.min(240, newBpm)));
      }
    }
    lastTapRef.current = now;
  };

  // Calculate musical position: Bar.Beat.Sixteenth
  const currentBar = Math.floor(currentStepIndex / 16) + 1;
  const currentBeat = Math.floor((currentStepIndex % 16) / 4) + 1;
  const currentSub = (currentStepIndex % 4) + 1;

  // Approximate elapsed timecode in seconds: (step * (60 / bpm / 4))
  const stepDurationSec = 60 / bpm / 4;
  const elapsedSec = currentStepIndex * stepDurationSec;
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const millis = Math.floor((elapsedSec % 1) * 100);
  const timecodeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;

  return (
    <div
      style={{
        height: '46px',
        backgroundColor: '#17191E',
        borderBottom: '1px solid #1D2027',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        flexShrink: 0,
        gap: '12px',
        overflowX: 'auto',
      }}
    >
      {/* 1. Primary Playback & Recording Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onReturnToStart}
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#252932',
            border: 'none',
            borderRadius: '4px',
            color: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Return to Beginning (Enter)"
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>first_page</span>
        </button>

        <button
          onClick={onStop}
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#252932',
            border: 'none',
            borderRadius: '4px',
            color: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Stop Playback"
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>stop</span>
        </button>

        <button
          onClick={onTogglePlay}
          style={{
            width: '40px',
            height: '32px',
            backgroundColor: isPlaying ? '#35C9A5' : '#8B78FF',
            border: 'none',
            borderRadius: '4px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          title="Play / Pause (Space)"
        >
          <span className="material-icons-round" style={{ fontSize: '20px' }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <button
          onClick={onToggleRecord}
          style={{
            width: '34px',
            height: '32px',
            backgroundColor: isRecording ? '#FF5252' : '#252932',
            border: isRecording ? '1px solid #FF5252' : 'none',
            borderRadius: '4px',
            color: isRecording ? '#FFFFFF' : '#FF5252',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isRecording ? '0 0 10px rgba(255, 82, 82, 0.6)' : 'none',
          }}
          title="Record Audio into Armed Track (R)"
        >
          <span className="material-icons-round" style={{ fontSize: '16px' }}>fiber_manual_record</span>
        </button>

        <button
          onClick={onToggleLoop}
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: isLoopEnabled ? '#8B78FF' : '#252932',
            border: 'none',
            borderRadius: '4px',
            color: isLoopEnabled ? '#FFFFFF' : '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Toggle Loop Playback (L)"
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>repeat</span>
        </button>

        <button
          onClick={onToggleMetronome}
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: metronomeEnabled ? '#35C9A5' : '#252932',
            border: 'none',
            borderRadius: '4px',
            color: metronomeEnabled ? '#FFFFFF' : '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Toggle Metronome Click"
        >
          <span className="material-icons-round" style={{ fontSize: '18px' }}>alarm</span>
        </button>
      </div>

      {/* 2. Position Display (Bar.Beat.Subdivision & Seconds Timecode) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#101114',
          border: '1px solid #252932',
          borderRadius: '4px',
          padding: '2px 10px',
          gap: '12px',
          fontFamily: 'monospace',
        }}
      >
        {isEditingBar ? (
          <input
            autoFocus
            type="number"
            min="1"
            max="512"
            value={barInputVal}
            onChange={(e) => setBarInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const b = parseInt(barInputVal, 10);
                if (!isNaN(b) && b >= 1) onJumpToBar(b);
                setIsEditingBar(false);
              } else if (e.key === 'Escape') {
                setIsEditingBar(false);
              }
            }}
            onBlur={() => {
              const b = parseInt(barInputVal, 10);
              if (!isNaN(b) && b >= 1) onJumpToBar(b);
              setIsEditingBar(false);
            }}
            style={{
              width: '48px',
              height: '22px',
              backgroundColor: '#111216',
              border: '1px solid #8B78FF',
              borderRadius: '3px',
              color: '#F3F4F6',
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 800,
              textAlign: 'center',
              outline: 'none',
              padding: '0 2px',
            }}
          />
        ) : (
          <div
            style={{ display: 'flex', alignItems: 'baseline', gap: '2px', cursor: 'pointer' }}
            onClick={() => {
              setBarInputVal(String(currentBar));
              setIsEditingBar(true);
            }}
            title="Click to jump to bar"
          >
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#F3F4F6' }}>
              {String(currentBar).padStart(3, ' ')}
            </span>
            <span style={{ color: '#697180' }}>.</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#35C9A5' }}>
              {currentBeat}
            </span>
            <span style={{ color: '#697180' }}>.</span>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {currentSub}
            </span>
          </div>
        )}

        <div style={{ width: '1px', height: '14px', backgroundColor: '#252932' }} />

        <div style={{ fontSize: '13px', fontWeight: 700, color: '#9CA3AF' }}>
          {timecodeStr}
        </div>
      </div>

      {/* 3. Musical Controls (BPM, Tap Tempo, Time Sig, Key, Snap) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* BPM Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#101114',
            border: '1px solid #252932',
            borderRadius: '4px',
            padding: '2px 6px',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#697180', textTransform: 'uppercase' }}>
            BPM
          </span>
          <input
            type="number"
            min="40"
            max="260"
            value={bpm}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onChangeBpm(Math.max(40, Math.min(260, val)));
            }}
            style={{
              width: '48px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#F3F4F6',
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 800,
              textAlign: 'center',
              outline: 'none',
            }}
          />
          <button
            onClick={handleTapTempo}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 700,
              backgroundColor: '#252932',
              border: 'none',
              borderRadius: '2px',
              color: '#9CA3AF',
              cursor: 'pointer',
            }}
            title="Tap repeatedly to set tempo"
          >
            TAP
          </button>
        </div>

        {/* Time Signature */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#101114',
            border: '1px solid #252932',
            borderRadius: '4px',
            padding: '2px 8px',
            gap: '2px',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 700,
            color: '#F3F4F6',
          }}
          title="Time Signature (Click to change)"
          onClick={() => {
            const nextNumerator = timeSigNumerator === 4 ? 3 : timeSigNumerator === 3 ? 6 : 4;
            const nextDenominator = nextNumerator === 6 ? 8 : 4;
            onChangeTimeSig(nextNumerator, nextDenominator);
          }}
        >
          <span>{timeSigNumerator}</span>
          <span style={{ color: '#697180' }}>/</span>
          <span>{timeSigDenominator}</span>
        </div>

        {/* Key & Scale */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#101114',
            border: '1px solid #252932',
            borderRadius: '4px',
            padding: '2px 6px',
            gap: '4px',
          }}
        >
          <select
            value={songKey}
            onChange={(e) => onChangeKey(e.target.value, songScale)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#F3F4F6',
              fontSize: '12px',
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
              <option key={k} value={k} style={{ backgroundColor: '#1D2027' }}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={songScale}
            onChange={(e) => onChangeKey(songKey, e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '11px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="major" style={{ backgroundColor: '#1D2027' }}>maj</option>
            <option value="minor" style={{ backgroundColor: '#1D2027' }}>min</option>
            <option value="dorian" style={{ backgroundColor: '#1D2027' }}>dor</option>
            <option value="phrygian" style={{ backgroundColor: '#1D2027' }}>phr</option>
          </select>
        </div>

        {/* Grid Snap Resolution */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: '#697180', fontWeight: 600, textTransform: 'uppercase' }}>
            Snap
          </span>
          <select
            value={snapResolution}
            onChange={(e) => onChangeSnap(e.target.value)}
            style={{
              height: '26px',
              backgroundColor: '#101114',
              border: '1px solid #252932',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '11px',
              fontWeight: 600,
              padding: '0 6px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="1/1" style={{ backgroundColor: '#1D2027' }}>1 Bar</option>
            <option value="1/2" style={{ backgroundColor: '#1D2027' }}>1/2 Bar</option>
            <option value="1/4" style={{ backgroundColor: '#1D2027' }}>1/4 Note</option>
            <option value="1/8" style={{ backgroundColor: '#1D2027' }}>1/8 Note</option>
            <option value="1/16" style={{ backgroundColor: '#1D2027' }}>1/16 Note</option>
            <option value="free" style={{ backgroundColor: '#1D2027' }}>Free (No Snap)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
