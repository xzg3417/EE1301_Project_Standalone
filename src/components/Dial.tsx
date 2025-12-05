import React, { useRef, useEffect, useState } from 'react';

interface DialProps {
  angle: number;
  onChange: (angle: number) => void;
  width?: number;
  height?: number;
}

const COLORS = {
  dark: { dialBg1: "#1e293b", dialBg2: "#0f172a", dialRing: "#334155", tickM: "#cbd5e1", tickm: "#475569", needle: "#e11d48", stroke: "#38bdf8" },
  light: { dialBg1: "#f1f5f9", dialBg2: "#e2e8f0", dialRing: "#94a3b8", tickM: "#334155", tickm: "#64748b", needle: "#dc2626", stroke: "#0284c7" }
};

const Dial: React.FC<DialProps> = ({ angle, onChange, width = 250, height = 250 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Assume dark mode for now or pass as prop. Let's hardcode dark palette or detect system.
  // Ideally use Ant Design token.
  const theme = 'light'; // Default to light to match Ant Design Pro default, or make it dynamic.
  const C = theme === 'light' ? COLORS.light : COLORS.dark;

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2, cy = h / 2, r = Math.max(0, Math.min(w, h) / 2 - 15);
    ctx.clearRect(0, 0, w, h);

    // Background
    let grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grd.addColorStop(0, C.dialBg1);
    grd.addColorStop(1, C.dialBg2);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();

    // Ring
    ctx.strokeStyle = C.dialRing;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner circle
    ctx.strokeStyle = C.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, 2 * Math.PI);
    ctx.stroke();

    // Ticks
    for (let i = 0; i < 360; i += 22.5) {
      const rad = (i - 90) * Math.PI / 180;
      const isMajor = (i % 45 === 0);
      const x1 = cx + (r - 10) * Math.cos(rad);
      const y1 = cy + (r - 10) * Math.sin(rad);
      const x2 = cx + (r - 10 - (isMajor ? 12 : 6)) * Math.cos(rad);
      const y2 = cy + (r - 10 - (isMajor ? 12 : 6)) * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? C.tickM : C.tickm;
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();

      if (isMajor && r > 60) {
        const tx = cx + (r - 35) * Math.cos(rad);
        const ty = cy + (r - 35) * Math.sin(rad);
        ctx.fillStyle = C.tickm;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Math.round(i) + "°", tx, ty);
      }
    }

    // Needle
    const arrowRad = (angle - 90) * Math.PI / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(arrowRad);
    ctx.shadowBlur = 5;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(r - 15, 0);
    ctx.lineTo(0, 4);
    ctx.fillStyle = C.needle;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, width, height);
  }, [angle, width, height]);

  const setAngleFromEvent = (e: React.MouseEvent | MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      let deg = Math.atan2(clientY - rect.top - height/2, clientX - rect.left - width/2) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      // Snap to 22.5
      deg = Math.round(deg / 22.5) * 22.5;
      onChange(deg % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setAngleFromEvent(e);
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isDragging) setAngleFromEvent(e);
      };
      const handleMouseUp = () => setIsDragging(false);

      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging]);

  return <canvas ref={canvasRef} width={width} height={height} onMouseDown={handleMouseDown} style={{ cursor: 'pointer', display: 'block', margin: '0 auto' }} />;
};

export default Dial;
