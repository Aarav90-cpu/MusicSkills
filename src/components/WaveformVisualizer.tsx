import React, { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  peaks?: number[];
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  height?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  peaks,
  currentTime,
  duration,
  onSeek,
  height = 140,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate fallback peaks if none provided
  const barData = peaks && peaks.length > 0 ? peaks : Array.from({ length: 80 }, (_, i) => {
    const x = i / 80;
    return 0.2 + 0.6 * Math.sin(x * Math.PI * 3) * Math.sin(x * Math.PI * 7) ** 2 + Math.random() * 0.2;
  });

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const totalBars = barData.length;
    const barWidth = 3;
    const gap = 2;
    const barPitch = barWidth + gap;
    const actualBars = Math.min(totalBars, Math.floor(width / barPitch));

    ctx.clearRect(0, 0, width, height);

    // Create signature gradient for played portion
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#6B4EFF');
    grad.addColorStop(0.55, '#FF4FA3');
    grad.addColorStop(1.0, '#FFB020');

    const playedX = progress * width;

    for (let i = 0; i < actualBars; i++) {
      const x = i * barPitch;
      const barHeight = Math.max(6, barData[i] * (height - 16));
      const y = (height - barHeight) / 2;

      ctx.fillStyle = x <= playedX ? grad : 'rgba(202, 196, 214, 0.25)';

      // Draw rounded bar
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [barData, progress, height]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek(pct * duration);
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: '100%',
          height: `${height}px`,
          cursor: 'pointer',
          display: 'block',
        }}
      />
    </div>
  );
};
