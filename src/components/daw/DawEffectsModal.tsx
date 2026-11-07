import React, { useState } from 'react';
import { ChannelEffectsConfig } from '../../utils/daw/effectsRack';

interface DawEffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  config: ChannelEffectsConfig;
  onUpdateConfig: (config: ChannelEffectsConfig) => void;
}

export const DawEffectsModal: React.FC<DawEffectsModalProps> = ({
  isOpen,
  onClose,
  channelName,
  config,
  onUpdateConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'comp' | 'delay' | 'reverb' | 'dist'>('eq');

  if (!isOpen) return null;

  const updateEq = (updates: Partial<ChannelEffectsConfig['eq']>) => {
    onUpdateConfig({
      ...config,
      eq: { ...config.eq, ...updates },
    });
  };

  const updateComp = (updates: Partial<ChannelEffectsConfig['compressor']>) => {
    onUpdateConfig({
      ...config,
      compressor: { ...config.compressor, ...updates },
    });
  };

  const updateDelay = (updates: Partial<ChannelEffectsConfig['delay']>) => {
    onUpdateConfig({
      ...config,
      delay: { ...config.delay, ...updates },
    });
  };

  const updateReverb = (updates: Partial<ChannelEffectsConfig['reverb']>) => {
    onUpdateConfig({
      ...config,
      reverb: { ...config.reverb, ...updates },
    });
  };

  const updateDist = (updates: Partial<ChannelEffectsConfig['distortion']>) => {
    onUpdateConfig({
      ...config,
      distortion: { ...config.distortion, ...updates },
    });
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
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        userSelect: 'none',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '640px',
          maxWidth: '100%',
          backgroundColor: '#17191E',
          border: '1px solid #252932',
          borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            height: '44px',
            backgroundColor: '#1D2027',
            borderBottom: '1px solid #252932',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-round" style={{ color: '#8B78FF', fontSize: '18px' }}>tune</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
              Insert Effects Rack · {channelName}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', backgroundColor: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}
          >
            <span className="material-icons-round" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Plugin Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #252932', backgroundColor: '#101114', padding: '0 12px' }}>
          {[
            { id: 'eq' as const, label: '3-Band EQ', bypassed: config.eq.bypass },
            { id: 'comp' as const, label: 'Compressor', bypassed: config.compressor.bypass },
            { id: 'delay' as const, label: 'Stereo Delay', bypassed: config.delay.bypass },
            { id: 'reverb' as const, label: 'Convolution Reverb', bypassed: config.reverb.bypass },
            { id: 'dist' as const, label: 'Distortion / Saturation', bypassed: config.distortion.bypass },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px',
                fontSize: '11px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? '#8B78FF' : tab.bypassed ? '#697180' : '#F3F4F6',
                borderBottom: activeTab === tab.id ? '2px solid #8B78FF' : '2px solid transparent',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.label} {!tab.bypassed ? '●' : ''}
            </button>
          ))}
        </div>

        {/* Plugin Controls Body */}
        <div style={{ padding: '20px', minHeight: '260px' }}>
          {/* 1. EQUALIZER */}
          {activeTab === 'eq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                  3-Band Parametric Equalizer
                </span>
                <button
                  onClick={() => updateEq({ bypass: !config.eq.bypass })}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: config.eq.bypass ? '#252932' : '#35C9A5',
                    color: config.eq.bypass ? '#9CA3AF' : '#101114',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {config.eq.bypass ? 'Bypassed' : 'Active'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Low Shelf */}
                <div style={{ backgroundColor: '#101114', padding: '12px', borderRadius: '6px', border: '1px solid #252932' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#35C9A5', marginBottom: '8px' }}>LOW SHELF</div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Gain: {config.eq.lowGainDb.toFixed(1)} dB</label>
                  <input
                    type="range"
                    min="-24"
                    max="24"
                    step="0.5"
                    value={config.eq.lowGainDb}
                    onChange={(e) => updateEq({ lowGainDb: parseFloat(e.target.value) })}
                    style={{ width: '100%', margin: '6px 0 10px' }}
                  />
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Freq: {config.eq.lowFreq} Hz</label>
                  <input
                    type="range"
                    min="30"
                    max="450"
                    step="5"
                    value={config.eq.lowFreq}
                    onChange={(e) => updateEq({ lowFreq: parseInt(e.target.value, 10) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Mid Bell */}
                <div style={{ backgroundColor: '#101114', padding: '12px', borderRadius: '6px', border: '1px solid #252932' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8B78FF', marginBottom: '8px' }}>MID PEAK / BELL</div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Gain: {config.eq.midGainDb.toFixed(1)} dB</label>
                  <input
                    type="range"
                    min="-24"
                    max="24"
                    step="0.5"
                    value={config.eq.midGainDb}
                    onChange={(e) => updateEq({ midGainDb: parseFloat(e.target.value) })}
                    style={{ width: '100%', margin: '6px 0 10px' }}
                  />
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Freq: {config.eq.midFreq} Hz</label>
                  <input
                    type="range"
                    min="250"
                    max="6000"
                    step="20"
                    value={config.eq.midFreq}
                    onChange={(e) => updateEq({ midFreq: parseInt(e.target.value, 10) })}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* High Shelf */}
                <div style={{ backgroundColor: '#101114', padding: '12px', borderRadius: '6px', border: '1px solid #252932' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#F5C451', marginBottom: '8px' }}>HIGH SHELF</div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Gain: {config.eq.highGainDb.toFixed(1)} dB</label>
                  <input
                    type="range"
                    min="-24"
                    max="24"
                    step="0.5"
                    value={config.eq.highGainDb}
                    onChange={(e) => updateEq({ highGainDb: parseFloat(e.target.value) })}
                    style={{ width: '100%', margin: '6px 0 10px' }}
                  />
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Freq: {config.eq.highFreq} Hz</label>
                  <input
                    type="range"
                    min="3000"
                    max="18000"
                    step="100"
                    value={config.eq.highFreq}
                    onChange={(e) => updateEq({ highFreq: parseInt(e.target.value, 10) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. COMPRESSOR */}
          {activeTab === 'comp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                  Dynamics Compressor
                </span>
                <button
                  onClick={() => updateComp({ bypass: !config.compressor.bypass })}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: config.compressor.bypass ? '#252932' : '#35C9A5',
                    color: config.compressor.bypass ? '#9CA3AF' : '#101114',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {config.compressor.bypass ? 'Bypassed' : 'Active'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Threshold: {config.compressor.thresholdDb} dB</label>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    value={config.compressor.thresholdDb}
                    onChange={(e) => updateComp({ thresholdDb: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Ratio: {config.compressor.ratio.toFixed(1)}:1</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={config.compressor.ratio}
                    onChange={(e) => updateComp({ ratio: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Attack: {Math.round(config.compressor.attackSec * 1000)} ms</label>
                  <input
                    type="range"
                    min="0.001"
                    max="0.5"
                    step="0.005"
                    value={config.compressor.attackSec}
                    onChange={(e) => updateComp({ attackSec: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Release: {Math.round(config.compressor.releaseSec * 1000)} ms</label>
                  <input
                    type="range"
                    min="0.02"
                    max="1.0"
                    step="0.02"
                    value={config.compressor.releaseSec}
                    onChange={(e) => updateComp({ releaseSec: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. STEREO DELAY */}
          {activeTab === 'delay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                  Stereo Echo / Delay
                </span>
                <button
                  onClick={() => updateDelay({ bypass: !config.delay.bypass })}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: config.delay.bypass ? '#252932' : '#35C9A5',
                    color: config.delay.bypass ? '#9CA3AF' : '#101114',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {config.delay.bypass ? 'Bypassed' : 'Active'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Time: {config.delay.timeSec.toFixed(2)}s</label>
                  <input
                    type="range"
                    min="0.05"
                    max="1.5"
                    step="0.02"
                    value={config.delay.timeSec}
                    onChange={(e) => updateDelay({ timeSec: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Feedback: {Math.round(config.delay.feedback * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="0.88"
                    step="0.02"
                    value={config.delay.feedback}
                    onChange={(e) => updateDelay({ feedback: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Wet Mix: {Math.round(config.delay.wetMix * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.delay.wetMix}
                    onChange={(e) => updateDelay({ wetMix: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. CONVOLUTION REVERB */}
          {activeTab === 'reverb' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                  Algorithmic Convolution Reverb
                </span>
                <button
                  onClick={() => updateReverb({ bypass: !config.reverb.bypass })}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: config.reverb.bypass ? '#252932' : '#35C9A5',
                    color: config.reverb.bypass ? '#9CA3AF' : '#101114',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {config.reverb.bypass ? 'Bypassed' : 'Active'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Decay Time: {config.reverb.decaySec.toFixed(1)}s</label>
                  <input
                    type="range"
                    min="0.4"
                    max="6.0"
                    step="0.2"
                    value={config.reverb.decaySec}
                    onChange={(e) => updateReverb({ decaySec: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Wet Mix: {Math.round(config.reverb.wetMix * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.reverb.wetMix}
                    onChange={(e) => updateReverb({ wetMix: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. DISTORTION */}
          {activeTab === 'dist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F6' }}>
                  Sigmoid Soft-Clip Saturation
                </span>
                <button
                  onClick={() => updateDist({ bypass: !config.distortion.bypass })}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: config.distortion.bypass ? '#252932' : '#35C9A5',
                    color: config.distortion.bypass ? '#9CA3AF' : '#101114',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {config.distortion.bypass ? 'Bypassed' : 'Active'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Drive / Saturation: {Math.round(config.distortion.drive * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={config.distortion.drive}
                    onChange={(e) => updateDist({ drive: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Wet Mix: {Math.round(config.distortion.wetMix * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.distortion.wetMix}
                    onChange={(e) => updateDist({ wetMix: parseFloat(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

