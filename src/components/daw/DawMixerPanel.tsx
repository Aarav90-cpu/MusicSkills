import React, { useState, useEffect, useRef } from 'react';
import { DawTrack } from '../../utils/daw/projectModel';
import { MixerEngine, MeterReadout } from '../../utils/daw/mixerEngine';

interface DawMixerPanelProps {
  tracks: DawTrack[];
  mixerEngine: MixerEngine;
  masterVolumeDb: number;
  onChangeMasterVolume: (db: number) => void;
  onChangeTrackVolume: (trackId: string, db: number) => void;
  onChangeTrackPan: (trackId: string, pan: number) => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackSolo: (trackId: string) => void;
  onToggleTrackArm: (trackId: string) => void;
  onOpenEffectsRack: (trackId: string) => void;
  onOpenMasterEffects: () => void;
  onCloseMixer: () => void;
}

export const DawMixerPanel: React.FC<DawMixerPanelProps> = ({
  tracks,
  mixerEngine,
  masterVolumeDb,
  onChangeMasterVolume,
  onChangeTrackVolume,
  onChangeTrackPan,
  onToggleTrackMute,
  onToggleTrackSolo,
  onToggleTrackArm,
  onOpenEffectsRack,
  onOpenMasterEffects,
  onCloseMixer,
}) => {
  // Real-time meter states
  const [meters, setMeters] = useState<Record<string, MeterReadout>>({});
  const [masterMeter, setMasterMeter] = useState<MeterReadout>({
    peakDb: -100,
    rmsDb: -100,
    peakLinear: 0,
    rmsLinear: 0,
    isClipping: false,
    reductionDb: 0,
  });

  const animFrameRef = useRef<number | null>(null);

  // Poll true audio amplitude meters from AnalyserNodes
  useEffect(() => {
    const updateMeters = () => {
      const nextMeters: Record<string, MeterReadout> = {};
      tracks.forEach((t) => {
        nextMeters[t.id] = mixerEngine.readChannelMeter(t.id);
      });
      setMeters(nextMeters);
      setMasterMeter(mixerEngine.readMasterMeter());

      animFrameRef.current = requestAnimationFrame(updateMeters);
    };

    animFrameRef.current = requestAnimationFrame(updateMeters);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [tracks, mixerEngine]);

  return (
    <div
      style={{
        height: '240px',
        backgroundColor: '#101114',
        borderTop: '1px solid #1D2027',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Mixer Bar Header */}
      <div
        style={{
          height: '28px',
          backgroundColor: '#17191E',
          borderBottom: '1px solid #1D2027',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-icons-round" style={{ fontSize: '16px', color: '#8B78FF' }}>tune</span>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#F3F4F6', letterSpacing: '0.04em' }}>
            Mixer Console
          </span>
          <span style={{ fontSize: '11px', color: '#697180' }}>
            ({tracks.length} Channels + Master Bus)
          </span>
        </div>

        <button
          onClick={onCloseMixer}
          style={{ width: '22px', height: '22px', backgroundColor: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
          title="Close mixer panel"
        >
          <span className="material-icons-round" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>

      {/* Horizontal Channel Strips Container */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', padding: '8px' }}>
        {/* Track Channel Strips */}
        {tracks.map((track) => {
          const meter = meters[track.id] || { peakDb: -100, rmsDb: -100, peakLinear: 0, rmsLinear: 0, isClipping: false, reductionDb: 0 };
          const meterHeightPercent = Math.min(100, Math.max(0, (meter.peakDb + 60) * 1.5));

          return (
            <div
              key={track.id}
              style={{
                width: '92px',
                flexShrink: 0,
                backgroundColor: '#17191E',
                border: '1px solid #1D2027',
                borderRadius: '6px',
                marginRight: '6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '6px',
              }}
            >
              {/* Channel Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#F3F4F6',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                  title={track.name}
                >
                  {track.name}
                </span>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: track.color,
                  }}
                />
              </div>

              {/* Pan Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '8px', color: '#697180', fontWeight: 700 }}>PAN</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={track.pan}
                  onChange={(e) => onChangeTrackPan(track.id, parseFloat(e.target.value))}
                  style={{ flex: 1, height: '3px', cursor: 'pointer' }}
                  title={`Pan: ${track.pan === 0 ? 'Center' : track.pan < 0 ? `L ${Math.round(-track.pan * 100)}%` : `R ${Math.round(track.pan * 100)}%`}`}
                />
              </div>

              {/* Fader & Meter Area */}
              <div style={{ display: 'flex', height: '110px', gap: '6px', alignItems: 'flex-end', justifyContent: 'center' }}>
                {/* Vertical Volume Fader */}
                <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="-48"
                    max="6"
                    step="0.5"
                    value={track.volumeDb}
                    onChange={(e) => onChangeTrackVolume(track.id, parseFloat(e.target.value))}
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      width: '24px',
                      height: '100px',
                      cursor: 'pointer',
                    }}
                    title={`Fader: ${track.volumeDb.toFixed(1)} dB`}
                  />
                </div>

                {/* Vertical Stereo Peak/RMS Level Meter */}
                <div
                  style={{
                    width: '10px',
                    height: '100px',
                    backgroundColor: '#101114',
                    borderRadius: '2px',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #252932',
                  }}
                >
                  {/* Clipping Indicator at top */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      backgroundColor: meter.isClipping ? '#FF5252' : '#252932',
                    }}
                  />

                  {/* Level bar */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${meterHeightPercent}%`,
                      backgroundColor: meter.peakDb > -3 ? '#FF5252' : meter.peakDb > -12 ? '#F5C451' : '#35C9A5',
                      transition: 'height 0.05s ease',
                    }}
                  />
                </div>
              </div>

              {/* Mute, Solo & Effects Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  onClick={() => onToggleTrackMute(track.id)}
                  style={{
                    flex: 1,
                    height: '20px',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: track.isMuted ? '#F5C451' : '#252932',
                    color: track.isMuted ? '#101114' : '#9CA3AF',
                    cursor: 'pointer',
                  }}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={() => onToggleTrackSolo(track.id)}
                  style={{
                    flex: 1,
                    height: '20px',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: track.isSolo ? '#8B78FF' : '#252932',
                    color: track.isSolo ? '#FFFFFF' : '#9CA3AF',
                    cursor: 'pointer',
                  }}
                  title="Solo"
                >
                  S
                </button>
                <button
                  onClick={() => onOpenEffectsRack(track.id)}
                  style={{
                    flex: 1,
                    height: '20px',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '3px',
                    border: 'none',
                    backgroundColor: '#252932',
                    color: '#35C9A5',
                    cursor: 'pointer',
                  }}
                  title="Open Insert Effects Rack"
                >
                  FX
                </button>
              </div>

              {/* Decibel Display */}
              <span style={{ fontSize: '9px', textAlign: 'center', color: '#9CA3AF', fontFamily: 'monospace' }}>
                {track.volumeDb > 0 ? `+${track.volumeDb.toFixed(1)}` : track.volumeDb.toFixed(1)} dB
              </span>
            </div>
          );
        })}

        {/* Separator */}
        <div style={{ width: '2px', backgroundColor: '#252932', margin: '0 4px', alignSelf: 'stretch' }} />

        {/* Master Bus Channel Strip */}
        <div
          style={{
            width: '108px',
            flexShrink: 0,
            backgroundColor: '#1D2027',
            border: '1px solid #8B78FF',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#8B78FF' }}>MASTER</span>
            <span style={{ fontSize: '9px', color: '#35C9A5', fontWeight: 700 }}>24-BIT</span>
          </div>

          <div style={{ display: 'flex', height: '120px', gap: '6px', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* Master Fader */}
            <input
              type="range"
              min="-48"
              max="6"
              step="0.5"
              value={masterVolumeDb}
              onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                width: '26px',
                height: '110px',
                cursor: 'pointer',
              }}
              title={`Master Volume: ${masterVolumeDb.toFixed(1)} dB`}
            />

            {/* Dual Stereo Master Meters */}
            <div style={{ display: 'flex', gap: '2px', height: '110px' }}>
              {[0, 1].map((ch) => (
                <div
                  key={ch}
                  style={{
                    width: '8px',
                    height: '100%',
                    backgroundColor: '#101114',
                    borderRadius: '2px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      backgroundColor: masterMeter.isClipping ? '#FF5252' : '#252932',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${Math.min(100, Math.max(0, (masterMeter.peakDb + 60) * 1.5))}%`,
                      backgroundColor: masterMeter.peakDb > -3 ? '#FF5252' : masterMeter.peakDb > -12 ? '#F5C451' : '#35C9A5',
                      transition: 'height 0.05s ease',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenMasterEffects}
            style={{
              height: '22px',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '3px',
              border: 'none',
              backgroundColor: '#8B78FF',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
            title="Open Master FX (Brickwall Limiter, EQ)"
          >
            Master FX
          </button>

          <span style={{ fontSize: '9px', textAlign: 'center', color: '#F3F4F6', fontFamily: 'monospace', fontWeight: 700 }}>
            {masterVolumeDb > 0 ? `+${masterVolumeDb.toFixed(1)}` : masterVolumeDb.toFixed(1)} dB
          </span>
        </div>
      </div>
    </div>
  );
};
