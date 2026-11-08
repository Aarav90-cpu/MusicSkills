import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const WelcomePage: React.FC = () => {
  const { setRoute, hasApiKey } = useApp();
  const [humanizeSlider, setHumanizeSlider] = useState(65);
  const [isCheckingKey, setIsCheckingKey] = useState(false);

  const handleGetStarted = async () => {
    setIsCheckingKey(true);
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data.hasApiKey) {
          setRoute('home');
        } else {
          setRoute('setup');
        }
      } else {
        setRoute('setup');
      }
    } catch {
      setRoute('setup');
    } finally {
      setIsCheckingKey(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      {/* STICKY TOP BAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          height: '72px',
          backgroundColor: 'rgba(15, 14, 21, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-outline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          zIndex: 1000,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px' }}>
            <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '4px', height: '22px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '4px', height: '10px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
            <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: 'var(--gradient-signature)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px' }}>
            MusicSkills
          </span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a
            href="#how-it-works"
            className="btn-text"
            style={{ textDecoration: 'none' }}
          >
            How it works
          </a>
          <a
            href="https://github.com/Aarav90-cpu/MusicSkills"
            target="_blank"
            rel="noreferrer"
            className="btn-text"
            style={{ textDecoration: 'none' }}
          >
            GitHub
          </a>
          <button
            onClick={handleGetStarted}
            className="btn btn-gradient"
            style={{ height: '40px', padding: '0 20px', fontSize: '13px' }}
          >
            {isCheckingKey ? 'Checking...' : 'Get Started'}
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section
        style={{
          minHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px',
          position: 'relative',
        }}
      >
        {/* Eyebrow Chip */}
        <div
          className="chip"
          style={{
            marginBottom: '24px',
            backgroundColor: 'var(--color-container)',
            borderColor: 'var(--color-outline)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Open source / MIT License</span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 'clamp(42px, 7vw, 76px)',
            lineHeight: 1.05,
            maxWidth: '900px',
            marginBottom: '24px',
          }}
        >
          Describe a song.<br />
          <span className="gradient-text">Watch it get made.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(17px, 2.5vw, 22px)',
            color: 'var(--color-text-secondary)',
            maxWidth: '640px',
            lineHeight: 1.5,
            marginBottom: '40px',
          }}
        >
          An AI songwriter, a humanized band, and a vocal recording booth, all running locally on your machine.
        </p>

        {/* Button Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleGetStarted}
            className="btn btn-gradient"
            style={{
              height: '56px',
              padding: '0 36px',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            <span>{isCheckingKey ? 'Verifying...' : 'Get Started'}</span>
            <span className="material-icons-round">arrow_forward</span>
          </button>

          <a
            href="https://github.com/Aarav90-cpu/MusicSkills"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outlined"
            style={{ height: '56px', padding: '0 28px', fontSize: '15px' }}
          >
            <span className="material-icons-round">code</span>
            <span>View on GitHub</span>
          </a>
        </div>

        <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          Takes about 2 minutes to set up / your API key stays stored on your device
        </div>
      </section>

      {/* 5 WONDERS OF MUSICSKILLS */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 24px', display: 'flex', flexDirection: 'column', gap: '80px' }}>
        
        {/* Wonder 01: Style & Multi-Dimensional Composition */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ color: 'var(--section-verse)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              01 / MULTI-DIMENSIONAL STYLE
            </div>
            <h2 style={{ fontSize: '38px', lineHeight: 1.2, marginBottom: '16px' }}>
              Any style.<br />Any mood.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', lineHeight: 1.6 }}>
              We organize music across five orthogonal dimensions: Genre, Mood, Purpose, Instrumentation, and Vocal Delivery. Combine them to create incredibly specific sound identities.
            </p>
          </div>

          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {['Dark Phonk', 'Brazilian Funk', 'Aggressive', 'Night Drive', 'Cowbell', '808 Bass', 'Lo-Fi', 'Bollywood', 'Indie Rock'].map((chip, idx) => (
                <span
                  key={chip}
                  className={`chip ${idx < 5 ? 'chip-active' : ''}`}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-container)',
                border: '1px solid var(--color-primary)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Live Song Identity
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px' }}>
                Dark Phonk + Brazilian Funk + Aggressive + Night Drive + Cowbell
              </div>
            </div>
          </div>
        </div>

        {/* Wonder 02: AI-Written Lyrics with Exact Timestamps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span className="chip" style={{ backgroundColor: 'var(--section-chorus)', color: '#000', fontWeight: 700 }}>
                CHORUS 1
              </span>
              <span className="mono" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                [00:28.444 - 00:42.667]
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { time: '[00:28.444]', text: 'This is our time, living for the neon rain!', dyn: 'ff' },
                { time: '[00:30.222]', text: 'Nothing can hold us down, we break the atmosphere', dyn: 'ff' },
                { time: '[00:32.000]', text: 'Feel the thunder roll, a fire in the heart', dyn: 'ff' },
              ].map(line => (
                <div key={line.time} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0', borderBottom: '1px solid var(--color-outline)' }}>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--color-primary)', minWidth: '85px' }}>{line.time}</span>
                  <span style={{ fontSize: '14px', flex: 1 }}>{line.text}</span>
                  <span className="chip" style={{ fontSize: '10px', height: '22px', padding: '0 6px', fontWeight: 700 }}>{line.dyn}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{ color: 'var(--section-chorus)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              02 / AI-WRITTEN LYRICS
            </div>
            <h2 style={{ fontSize: '38px', lineHeight: 1.2, marginBottom: '16px' }}>
              Lyrics written for your song.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', lineHeight: 1.6 }}>
              The AI actively crafts rhythmic, rhymed, and poetic lyrics tailored to your topic, with millisecond singing timestamps and guide pitches automatically synchronized with the backing tracks.
            </p>
          </div>
        </div>

        {/* Wonder 03: Anti-AI Humanization */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ color: 'var(--section-prechorus)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              03 / ANTI-AI DETECTION
            </div>
            <h2 style={{ fontSize: '38px', lineHeight: 1.2, marginBottom: '16px' }}>
              Music that sounds played, not programmed.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', lineHeight: 1.6 }}>
              Perfect quantization and flat velocity trigger AI audio detection. We inject organic timing jitter, dynamic beat accents, and legato duration offsets so every note breathes like a real performance.
            </p>
          </div>

          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Humanize Jitter & Dynamics</span>
              <span className="mono" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{humanizeSlider}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={humanizeSlider}
              onChange={e => setHumanizeSlider(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', marginBottom: '24px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: 'var(--color-container)', borderRadius: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Timing Jitter:</span>
                <span className="mono" style={{ color: 'var(--color-success)' }}>+/-{Math.round(humanizeSlider * 0.1)} ticks (~{Math.round(humanizeSlider * 0.1 * 1.04)} ms)</span>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'var(--color-container)', borderRadius: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Dynamic Velocity Swing:</span>
                <span className="mono" style={{ color: 'var(--color-success)' }}>+/-{Math.round(humanizeSlider * 0.16)} MIDI velocity</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wonder 04: Local-First Storage */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div className="card" style={{ padding: '28px', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>folder</span>
              <span className="mono" style={{ fontWeight: 600, fontSize: '14px' }}>.chats/neon-rain-a1b2/</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-success)' }}>audiotrack</span>
                <span className="mono">song.mp3 (192 kbps Master)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>piano</span>
                <span className="mono">song.mid (5-Track Standard MIDI)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--section-break)' }}>description</span>
                <span className="mono">lead_sheet.md (Timed Singer Sheet)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-round" style={{ fontSize: '16px', color: 'var(--section-chorus)' }}>mic</span>
                <span className="mono">vocals/take_1.wav (Your Recording)</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mono" style={{ color: 'var(--section-break)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              04 / LOCAL-FIRST
            </div>
            <h2 style={{ fontSize: '38px', lineHeight: 1.2, marginBottom: '16px' }}>
              Yours, locally.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', lineHeight: 1.6 }}>
              Every conversation, MIDI arrangement, rendered MP3, and vocal recording is saved into clear, accessible local directories under <code>.chats/</code>. No proprietary cloud locks.
            </p>
          </div>
        </div>

        {/* Wonder 05: You Bring The Voice */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ color: 'var(--section-bridge)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              05 / VOCAL STUDIO
            </div>
            <h2 style={{ fontSize: '38px', lineHeight: 1.2, marginBottom: '16px' }}>
              You bring the voice.
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', lineHeight: 1.6 }}>
              MusicSkills does not generate fake vocals. You get the humanized band, the custom words, and a built-in vocal recording studio with teleprompter and pitch guide ribbons.
            </p>
          </div>

          <div className="card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'var(--gradient-signature)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                marginBottom: '20px',
                boxShadow: 'var(--gradient-glow)',
              }}
            >
              <span className="material-icons-round" style={{ fontSize: '54px' }}>mic</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
              Built-In Vocal Studio
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
              Plug in your headphones, record takes against the backing track, and export your master.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (4 STEPS) */}
      <section id="how-it-works" style={{ backgroundColor: 'var(--color-surface)', padding: '80px 24px', borderTop: '1px solid var(--color-outline)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: '36px', marginBottom: '12px' }}>How It Works</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px' }}>
              Four simple stages from raw prompt to polished song.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {[
              { num: '01', title: 'Choose Style', desc: 'Pick your genre, mood, purpose, tempo, and key, or let the AI suggest them.', icon: 'tune' },
              { num: '02', title: 'Shape Lyrics', desc: 'Watch the AI write original, singable lyrics with exact timestamps for each section.', icon: 'lyrics' },
              { num: '03', title: 'Generate Track', desc: 'The engine creates 5 humanized MIDI tracks and renders a 192k stereo MP3 master.', icon: 'graphic_eq' },
              { num: '04', title: 'Sing & Iterate', desc: 'Use the Vocal Studio to sing along, or chat with the AI to refine any element.', icon: 'mic' },
            ].map(step => (
              <div key={step.num} className="card" style={{ padding: '28px', backgroundColor: 'var(--color-container)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span className="mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {step.num}
                  </span>
                  <span className="material-icons-round" style={{ color: 'var(--color-primary)' }}>
                    {step.icon}
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA & FOOTER */}
      <footer style={{ padding: '80px 24px 40px', maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            padding: '48px 24px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '60px',
          }}
        >
          <h2 style={{ fontSize: '36px', marginBottom: '16px' }}>Ready to make something?</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '17px', marginBottom: '32px' }}>
            No cloud subscription. Your music, arrangements, and recordings stay yours.
          </p>
          <button onClick={handleGetStarted} className="btn btn-gradient" style={{ height: '52px', padding: '0 36px', fontSize: '16px' }}>
            Get Started Now
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--color-outline)', paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <div>
            <strong>DISCLAIMER:</strong> This library does not generate vocals. It creates complete musical arrangements and timing guides for human vocalists.
          </div>
          <div>
            MusicSkills Studio / MIT License / Built with Material 3 and Vercel AI SDK
          </div>
        </div>
      </footer>
    </div>
  );
};

