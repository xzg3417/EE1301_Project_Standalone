import React, { useRef, useEffect, useState } from 'react';
import { theme } from 'antd';
import type { Measurement } from '../context/AppContext';

interface RadarProps {
  data: Measurement[];
  predictedAngle: number | null;
  mode: 'rssi' | 'quality';
}

const Radar: React.FC<RadarProps> = ({ data, predictedAngle, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { token } = theme.useToken();
  const [hoveredPoint, setHoveredPoint] = useState<Measurement | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const radarPointsRef = useRef<{x: number, y: number, data: Measurement}[]>([]);

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
    const maxR = Math.max(0, Math.min(w, h) / 2 - 20);

    const C = {
        bg: token.colorBgContainer,
        grid: token.colorBorder,
        stroke: token.colorPrimary,
        fill: token.colorPrimaryBg, // "rgba(24, 144, 255, 0.2)"
        target: token.colorWarning
    };

    radarPointsRef.current = [];

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid Rings
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(s => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * s, 0, 2 * Math.PI);
        ctx.stroke();
    });

    // Angle Lines
    for (let i = 0; i < 360; i += 45) {
        const rad = (i - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad));
        ctx.stroke();
    }

    // Predicted Angle
    if (predictedAngle !== null) {
        const pRad = (predictedAngle - 90) * Math.PI / 180;
        const endX = cx + maxR * Math.cos(pRad);
        const endY = cy + maxR * Math.sin(pRad);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = C.target;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = C.target;
        ctx.textAlign = "center";
        ctx.fillText("TARGET", endX, endY - 10);
    }

    // Data Plot
    const getQuality = (rssi: number) => Math.max(0, Math.min(100, (rssi + 100) * 1.5));

    if (data.length > 0) {
        const uniqueAngles: Record<number, number[]> = {};
        data.forEach(d => {
            if (!uniqueAngles[d.angle]) uniqueAngles[d.angle] = [];
            uniqueAngles[d.angle].push(d.rssi);
        });

        const sortedAngles = Object.keys(uniqueAngles).map(Number).sort((a, b) => a - b);

        ctx.beginPath();
        sortedAngles.forEach((ang, i) => {
            const avgRssi = uniqueAngles[ang].reduce((a, b) => a + b, 0) / uniqueAngles[ang].length;
            let r = mode === 'rssi' ? (avgRssi + 95) / 70 : getQuality(avgRssi) / 100;
            if (r < 0) r = 0; if (r > 1) r = 1;

            const rad = (ang - 90) * Math.PI / 180;
            const x = cx + r * maxR * Math.cos(rad);
            const y = cy + r * maxR * Math.sin(rad);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.closePath();
        ctx.fillStyle = C.fill;
        ctx.fill();
        ctx.strokeStyle = C.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Points
        data.forEach(d => {
            let r = mode === 'rssi' ? (d.rssi + 95) / 70 : getQuality(d.rssi) / 100;
            if (r < 0) r = 0; if (r > 1) r = 1;

            const rad = (d.angle - 90) * Math.PI / 180;
            const x = cx + r * maxR * Math.cos(rad);
            const y = cy + r * maxR * Math.sin(rad);

            radarPointsRef.current.push({ x, y, data: d });

            const isHovered = hoveredPoint && hoveredPoint.id === d.id;

            ctx.beginPath();
            ctx.arc(x, y, isHovered ? 6 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = isHovered ? C.target : token.colorText;
            ctx.fill();

            if (isHovered) {
                ctx.strokeStyle = token.colorWhite;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }
  }, [data, predictedAngle, mode, token, hoveredPoint]);

  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = radarPointsRef.current.find(p => Math.sqrt(Math.pow(mouseX - p.x, 2) + Math.pow(mouseY - p.y, 2)) < 15);

      if (hit) {
          if (hoveredPoint?.id !== hit.data.id) {
            setHoveredPoint(hit.data);
          }
          setTooltipPos({ x: e.clientX, y: e.clientY });
      } else {
          setHoveredPoint(null);
      }
  };

  return (
    <>
      <div style={{ width: '100%', height: '100%' }}>
        <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ cursor: hoveredPoint ? 'pointer' : 'crosshair' }}
        />
      </div>
      {hoveredPoint && (
          <div style={{
              position: 'fixed',
              left: tooltipPos.x + 15,
              top: tooltipPos.y + 15,
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorder}`,
              padding: 8,
              borderRadius: 4,
              boxShadow: token.boxShadow,
              zIndex: 9999,
              pointerEvents: 'none',
              fontSize: 12
          }}>
              <div style={{ fontWeight: 'bold', color: token.colorWarning }}>#{hoveredPoint.id}</div>
              <div>{hoveredPoint.angle}° | {hoveredPoint.rssi}dBm</div>
          </div>
      )}
    </>
  );
};

export default Radar;
