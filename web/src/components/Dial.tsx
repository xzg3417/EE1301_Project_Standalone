import React, { useRef, useEffect, useState } from 'react';
import { theme } from 'antd';

interface DialProps {
  angle: number;
  setAngle: (angle: number) => void;
}

const Dial: React.FC<DialProps> = ({ angle, setAngle }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { token } = theme.useToken();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }
    const w = canvas.width;
    const h = canvas.height;
    if (w < 1) return;

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(0, Math.min(w, h) / 2 - 15);

    const C = {
        bg1: token.colorFillSecondary,
        bg2: token.colorFillQuaternary,
        ring: token.colorBorder,
        stroke: token.colorPrimary,
        tickM: token.colorText,
        tickm: token.colorTextSecondary,
        needle: token.colorError
    };

    ctx.clearRect(0, 0, w, h);

    // Background Gradient
    const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grd.addColorStop(0, C.bg1);
    grd.addColorStop(1, C.bg2);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();

    // Ring
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = 6;
    ctx.stroke();

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
    ctx.fillStyle = token.colorWhite;
    ctx.fill();
    ctx.restore();

  }, [angle, token]);

  const updateAngle = (e: MouseEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    let deg = Math.atan2(e.clientY - rect.top - rect.height / 2, e.clientX - rect.left - rect.width / 2) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    deg = Math.round(deg / 22.5) * 22.5;
    setAngle(deg % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      updateAngle(e);
  };

  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (isDragging) updateAngle(e);
      };
      const handleGlobalMouseUp = () => setIsDragging(false);

      if (isDragging) {
          window.addEventListener('mousemove', handleGlobalMouseMove);
          window.addEventListener('mouseup', handleGlobalMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [isDragging]);

  return <div style={{ width: '100%', height: '100%' }}><canvas ref={canvasRef} onMouseDown={handleMouseDown} style={{ cursor: 'pointer' }} /></div>;
};

export default Dial;
