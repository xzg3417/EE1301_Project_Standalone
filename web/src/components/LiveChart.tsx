import React, { useRef, useEffect } from 'react';
import { theme } from 'antd';

const LiveChart: React.FC<{ data: number[] }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { token } = theme.useToken();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handling
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }

    const w = canvas.width;
    const h = canvas.height;

    // Theme Colors
    const bgColor = token.colorBgContainer;
    const strokeColor = token.colorPrimary;
    const gridColor = token.colorBorder;
    const textColor = token.colorTextSecondary;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Auto Scale
    let minVal = Math.min(...data, -100);
    let maxVal = Math.max(...data, -30);
    if (maxVal - minVal < 20) { maxVal += 10; minVal -= 10; }
    const pRange = maxVal - minVal;
    const xOffset = 30;
    const yMargin = 10;
    const drawW = w - xOffset;
    const drawH = h - 2 * yMargin;

    // Grid & Labels
    ctx.fillStyle = textColor;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    const stepY = pRange / 5;
    for (let i = 0; i <= 5; i++) {
        const val = minVal + i * stepY;
        const y = yMargin + drawH - ((val - minVal) / pRange * drawH);
        ctx.beginPath();
        ctx.moveTo(xOffset, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillText(Math.round(val).toString(), xOffset - 4, y);
    }

    // Plot
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const stepX = drawW / (data.length - 1);
    data.forEach((v, i) => {
        const y = yMargin + drawH - ((v - minVal) / pRange * drawH);
        if (i === 0) ctx.moveTo(xOffset, y);
        else ctx.lineTo(xOffset + i * stepX, y);
    });
    ctx.stroke();

  }, [data, token]);

  return <div style={{ width: '100%', height: '100%' }}><canvas ref={canvasRef} /></div>;
};

export default LiveChart;
