/**
 * MusicSkills Professional DAW - Studio Documentation & Reference Modal
 * Comprehensive workflows, DSP routing explanations, MIDI techniques, and keyboard shortcuts.
 * Strictly zero-emoji.
 */

import React, { useState } from 'react';

interface DawDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DawDocModal: React.FC<DawDocModalProps> = ({ isOpen, onClose }) => {
  const [selectedSection, setSelectedSection] = useState<'tour' | 'arranger' | 'midi' | 'sequencer' | 'dsp' | 'export'>('tour');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '840px',
          height: '580px',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1D2027',
            borderBottom: '1px solid #252932',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#F3F4F6' }}>
              MusicSkills DAW Studio Manual & Reference Guide
            </h3>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
              Professional Digital Audio Workstation documentation and DSP architecture
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>

        {/* Body Split */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Navigation Sidebar */}
          <div
            style={{
              width: '210px',
              backgroundColor: '#13151A',
              borderRight: '1px solid #252932',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {[
              { id: 'tour', label: 'Studio Architecture' },
              { id: 'arranger', label: 'Arranger & Clip Editing' },
              { id: 'midi', label: 'MIDI & Virtual Synths' },
              { id: 'sequencer', label: 'Beat Step Sequencer' },
              { id: 'dsp', label: 'DSP Effects & Mixing' },
              { id: 'export', label: 'WAV & Stems Export' },
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSelectedSection(sec.id as any)}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  backgroundColor: selectedSection === sec.id ? '#252932' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: selectedSection === sec.id ? '#8B78FF' : '#9CA3AF',
                  fontSize: '12px',
                  fontWeight: selectedSection === sec.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Documentation Content */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', color: '#D1D5DB', fontSize: '12px', lineHeight: 1.6 }}>
            {selectedSection === 'tour' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>Studio Architecture & Layout</h4>
                <p>
                  MusicSkills DAW is a high-performance, client-side digital audio workstation running directly in the browser on Web Audio API and Web MIDI API.
                </p>
                <p>
                  The interface is divided into primary functional zones:
                </p>
                <ul>
                  <li><strong>Title Bar:</strong> Displays project session name, dirty indicator, workspace selector, and active USB MIDI controllers.</li>
                  <li><strong>Menu Bar:</strong> Standard desktop menus (File, Edit, View, Track, Clip, Mixer, Help) with keyboard shortcuts.</li>
                  <li><strong>Transport Bar:</strong> Playhead controls, BPM, time signature, key, snap resolution, and audio recording toggles.</li>
                  <li><strong>Left Browser:</strong> Curated sample library categorized into Kicks, Snares, Hi-Hats, Basslines, and Chords with instant auditioning.</li>
                  <li><strong>Center Workspace:</strong> Interactive timeline arranger, multi-octave piano roll, or 8-voice drum step sequencer.</li>
                  <li><strong>Right Inspector:</strong> Detailed parameters for selected tracks, audio waveforms, MIDI note quantization, and clip volume.</li>
                  <li><strong>Bottom Mixer:</strong> Professional multi-track console with stereo faders, panning, solo/mute matrix, and insert effects racks.</li>
                </ul>
              </div>
            )}

            {selectedSection === 'arranger' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>Arranger Timeline & Clip Manipulation</h4>
                <p>
                  The arranger timeline allows precise placement and editing of audio and MIDI clips across bars:
                </p>
                <ul>
                  <li><strong>Moving Clips:</strong> Click and drag the clip body to slide horizontally across bars with magnetic grid snapping.</li>
                  <li><strong>Resizing Clips:</strong> Click and drag the right edge handle to smoothly extend or shorten clip duration in bars.</li>
                  <li><strong>Splitting Clips:</strong> Position the playhead scrubber at the desired cut point and press [S] or click [Clip &gt; Split at Playhead].</li>
                  <li><strong>Reversing Audio:</strong> Select an audio clip and click &quot;Reverse Audio Buffer&quot; in the Inspector or Clip menu to invert the sample waveform.</li>
                  <li><strong>Peak Normalization:</strong> Select an audio clip and click &quot;Normalize Audio (0 dBFS)&quot; to scale peak levels to 98% full-scale without distortion.</li>
                  <li><strong>Double-Clicking:</strong> Double-clicking any MIDI clip opens the Piano Roll; double-clicking an audio clip opens the Inspector.</li>
                </ul>
              </div>
            )}

            {selectedSection === 'midi' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>MIDI Editing & Polyphonic Synthesizers</h4>
                <p>
                  The DAW includes a built-in virtual polyphonic synthesizer engine supporting 8 specialized instrument presets:
                </p>
                <ul>
                  <li><strong>Grand Piano:</strong> Clean acoustic piano synthesis with dual harmonic detune.</li>
                  <li><strong>Rhodes Keys:</strong> Warm bell-like electric piano with gentle chorus modulation.</li>
                  <li><strong>808 Sub Bass:</strong> Deep low-end fundamental with resonant saturation and glide.</li>
                  <li><strong>Analog Synth:</strong> Rich sawtooth poly-synth with 4-pole low-pass ladder filter.</li>
                  <li><strong>Ambient Pad:</strong> Slow-attack lush atmospheric textures.</li>
                  <li><strong>Short Pluck:</strong> Punchy, percussive string pluck for fast arpeggios.</li>
                  <li><strong>Brass Section:</strong> Resonant brass with expressive filter sweep.</li>
                  <li><strong>Tubular Bells:</strong> Crisp metallic physical modeling tones.</li>
                </ul>
                <p>
                  <strong>Hardware MIDI Integration:</strong> Connect any USB MIDI keyboard or controller. The DAW automatically detects it via Web MIDI, routes Note On/Off events directly into armed tracks, and records takes to the timeline in real time.
                </p>
              </div>
            )}

            {selectedSection === 'sequencer' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>LMMS & FL Studio Style Beat Sequencer</h4>
                <p>
                  Create rhythmic patterns quickly using the dedicated 8-voice drum matrix:
                </p>
                <ul>
                  <li><strong>8 Drum Channels:</strong> Kick Drum, Snare, Closed Hat, Open Hat, Hand Clap, 808 Sub, Percussion, and Crash Cymbal.</li>
                  <li><strong>Step Grid:</strong> 16-step matrix grouped in 4/4 beats with high-visibility downbeat indicators.</li>
                  <li><strong>Genre Presets:</strong> Instant one-click pattern generators for Trap / Hip-Hop, Lo-Fi Chill, House 4/4, and Phonk.</li>
                  <li><strong>Quick Tools:</strong> Fill Every 4 Steps, Fill Every 2 Steps, Shift Pattern Left/Right, and Clear.</li>
                  <li><strong>Commit to Timeline:</strong> Click &quot;Commit Pattern to Timeline&quot; to stamp your drum sequence into an active timeline track at any bar.</li>
                </ul>
              </div>
            )}

            {selectedSection === 'dsp' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>DSP Effects Rack & Mixing Console</h4>
                <p>
                  Every channel strip and master bus features a real-time Web Audio DSP insert chain:
                </p>
                <ul>
                  <li><strong>3-Band Parametric EQ:</strong> Low shelf (80 Hz), Mid peaking (1000 Hz, Q 1.2), and High shelf (8000 Hz) with +/- 18 dB gain.</li>
                  <li><strong>Dynamics Compressor:</strong> Threshold (-60 dB to 0 dB), Ratio (1:1 to 20:1), Attack (1 ms to 200 ms), and Release (10 ms to 1000 ms).</li>
                  <li><strong>Saturation / Distortion:</strong> Sigmoid non-linear curve adding warm tape drive or aggressive harmonic distortion.</li>
                  <li><strong>Stereo Delay:</strong> Time (50 ms to 1000 ms), Feedback (0% to 90%), and Wet/Dry balance.</li>
                  <li><strong>Synthetic Reverb:</strong> Algorithmic convolution engine generating custom decay impulse responses (0.5 s to 6.0 s).</li>
                  <li><strong>Master Limiter:</strong> Brickwall peak limiter with 0 dBFS true-peak lookahead preventing digital clipping.</li>
                </ul>
              </div>
            )}

            {selectedSection === 'export' && (
              <div>
                <h4 style={{ color: '#F3F4F6', fontSize: '14px', marginTop: 0 }}>Exporting Master WAV, Stems & MIDI</h4>
                <p>
                  The DAW provides professional offline rendering pipelines:
                </p>
                <ul>
                  <li><strong>Master Audio (WAV):</strong> Renders the entire timeline at 44.1 kHz 24-bit stereo quality using an isolated OfflineAudioContext, applying all channel EQ, compression, effects, volume faders, and mastering limiter.</li>
                  <li><strong>Track Stems (.zip / multitrack):</strong> Iteratively renders each active track into its own standalone WAV file, ideal for mixing or mastering in external software.</li>
                  <li><strong>Standard MIDI File (.mid):</strong> Exports all timeline MIDI notes into a standard SMF Type 1 multi-track MIDI file with tempo and time signature metadata.</li>
                  <li><strong>Session Backup (.musicskills.json):</strong> Saves the entire DAW project state to disk for backup, sharing, or later loading.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#14161B',
            borderTop: '1px solid #252932',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#8B78FF',
              border: 'none',
              borderRadius: '4px',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
