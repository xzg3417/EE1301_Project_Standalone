import React, { useRef, useEffect } from 'react';

interface RadarPoint {
    id: number;
    angle: number;
    rssi: number;
    samples: number;
}

interface RadarProps {
  data: RadarPoint[];
  predictedAngle?: number | null;
  hoveredId?: number | null;
  onHover?: (id: number | null) => void;
  width?: number;
  height?: number;
}

const COLORS = {
  dark: { bg: "#000000", grid: "#1e293b", stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.2)" },
  light: { bg: "#ffffff", grid: "#cbd5e1", stroke: "#0284c7", fill: "rgba(2, 132, 199, 0.2)" }
};

const RadarPlot: React.FC<RadarProps> = ({ data, predictedAngle, hoveredId, onHover, width = 400, height = 400 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = 'light';
  const C = theme === 'light' ? COLORS.light : COLORS.dark;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2, cy = height / 2;
    const maxR = Math.max(0, Math.min(width, height) / 2 - 20);

    // Draw Grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(s => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * s, 0, 2 * Math.PI);
        ctx.stroke();
    });
    for (let i = 0; i < 360; i += 45) {
        const rad = (i - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad));
        ctx.stroke();
    }

    // Draw Prediction
    if (predictedAngle !== undefined && predictedAngle !== null) {
        const pRad = (predictedAngle - 90) * Math.PI / 180;
        const endX = cx + maxR * Math.cos(pRad);
        const endY = cy + maxR * Math.sin(pRad);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("TARGET", endX, endY - 10);
    }

    // Draw Data Area
    if (data.length > 0) {
        // We need to group by angle to average RSSI if multiple? Or assuming pre-processed.
        // The data passed here should be unique points per angle ideally, but let's handle it.
        // Assuming unique for now based on Mapping model.

        let uniqueAngles: {[key: number]: number[]} = {};
        data.forEach(d => { if(!uniqueAngles[d.angle]) uniqueAngles[d.angle] = []; uniqueAngles[d.angle].push(d.rssi); });
        let sortedAngles = Object.keys(uniqueAngles).map(Number).sort((a,b)=>a-b);

        ctx.beginPath();
        sortedAngles.forEach((ang, i) => {
            let avgRssi = uniqueAngles[ang].reduce((a,b)=>a+b,0) / uniqueAngles[ang].length;
            // Map RSSI (-100 to -30) to radius (0 to 1) roughly
            let r = (avgRssi + 100) / 70;
            if (r < 0) r = 0; if (r > 1) r = 1;

            let rad = (ang - 90) * Math.PI / 180;
            let x = cx + r * maxR * Math.cos(rad);
            let y = cy + r * maxR * Math.sin(rad);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = C.fill;
        ctx.fill();
        ctx.strokeStyle = C.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Points
        data.forEach(d => {
            let r = (d.rssi + 100) / 70;
            if (r < 0) r = 0; if (r > 1) r = 1;
            let rad = (d.angle - 90) * Math.PI / 180;
            let x = cx + r * maxR * Math.cos(rad);
            let y = cy + r * maxR * Math.sin(rad);

            ctx.beginPath();
            ctx.arc(x, y, d.id === hoveredId ? 6 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = d.id === hoveredId ? "#ffff00" : (theme === 'light' ? "#334155" : "#fff");
            ctx.fill();
            if (d.id === hoveredId) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

  }, [data, predictedAngle, hoveredId, width, height]);

  // Handle interactions for tooltip/hover
  // Simplification: We recalculate point positions on mouse move to find hit.
  // Optimization: Could cache point coordinates.
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!onHover) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cx = width / 2, cy = height / 2;
      const maxR = Math.max(0, Math.min(width, height) / 2 - 20);

      let foundId: number | null = null;
      // Reverse check for z-order
      for (let i = data.length - 1; i >= 0; i--) {
          const d = data[i];
          let r = (d.rssi + 100) / 70;
          if (r < 0) r = 0; if (r > 1) r = 1;
          let rad = (d.angle - 90) * Math.PI / 180;
          let px = cx + r * maxR * Math.cos(rad);
          let py = cy + r * maxR * Math.sin(rad);

          if (Math.sqrt(Math.pow(mouseX - px, 2) + Math.pow(mouseY - py, 2)) < 10) {
              foundId = d.id;
              break;
          }
      }
      onHover(foundId);
  };

  return <canvas
    ref={canvasRef}
    width={width}
    height={height}
    onMouseMove={handleMouseMove}
    onMouseLeave={() => onHover && onHover(null)}
    style={{ cursor: hoveredId ? 'pointer' : 'crosshair', display: 'block', margin: '0 auto' }}
  />;
};

export default RadarPlot;
