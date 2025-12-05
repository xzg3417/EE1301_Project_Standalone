// --- Globals ---
let currentTab = 'live';
let showRaw = false, showLogs = true;
let port, reader, writer, isConnected = false;
let radarMode = 'rssi';
let liveTarget = { ssid: "", channel: 0 };
let liveChartData = new Array(150).fill(-120);
let packetCount = 0, lastRateCheck = 0;
let mapTarget = { ssid: "", channel: 0 };
let mapData = [], measurementID = 1, isMeasuring = false, currentSamples = [], requiredSamples = 2;
let predictedAngle = null, radarPoints = [], hoveredPointId = null;
let isLightMode = true;

// --- DOM Elements ---
const els = {
    tabs: { live: document.getElementById('tab-live'), map: document.getElementById('tab-map'), wifi: document.getElementById('tab-wifi') },
    views: { live: document.getElementById('view-live'), map: document.getElementById('view-map'), wifi: document.getElementById('view-wifi') },
    panels: { left: document.getElementById('panel-left'), center: document.getElementById('panel-center'), right: document.getElementById('panel-right'), terminal: document.getElementById('panel-terminal') },
    list: document.getElementById('networkList'),
    liveChart: document.getElementById('signalChart'),
    disp: { rssi: document.getElementById('dispRSSI'), rate: document.getElementById('dispRate') },
    dial: document.getElementById('dialCanvas'),
    dialVal: document.getElementById('dialValueDisplay'),
    radar: document.getElementById('radarCanvas'),
    radarModeBtn: document.getElementById('radarModeBtn'),
    angleInput: document.getElementById('angleInput'),
    mapTarget: document.getElementById('mapTargetSSID'),
    sampleInput: document.getElementById('sampleCountInput'),
    measureBtn: document.getElementById('measureBtn'),
    progBar: document.getElementById('measureProgress'),
    statText: document.getElementById('measureStatus'),
    table: document.getElementById('dataTableBody'),
    tooltip: document.getElementById('radarTooltip'),
    predResult: document.getElementById('predictionResult'),
    connect: document.getElementById('connectBtn'),
    scan: document.getElementById('scanBtn'),
    log: document.getElementById('logConsole'),
    chkRaw: document.getElementById('chkShowRaw'),
    chkLog: document.getElementById('chkShowLog'),
    themeBtn: document.getElementById('themeBtn'),
    mini: { state: document.getElementById('miniState'), ip: document.getElementById('miniIP'), ssid: document.getElementById('miniSSID'), rssi2: document.getElementById('miniRSSI') }
};

// --- THEME LOGIC ---
const COLORS = {
    dark: { bg: "#000000", grid: "#1e293b", stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.2)", dialBg1: "#1e293b", dialBg2: "#0f172a", dialRing: "#334155", tickM: "#cbd5e1", tickm: "#475569", needle: "#e11d48", text: "#fff" },
    light: { bg: "#ffffff", grid: "#cbd5e1", stroke: "#0284c7", fill: "rgba(2, 132, 199, 0.2)", dialBg1: "#f1f5f9", dialBg2: "#e2e8f0", dialRing: "#94a3b8", tickM: "#334155", tickm: "#64748b", needle: "#dc2626", text: "#0f172a" }
};

if(els.chkRaw) els.chkRaw.addEventListener('change', (e) => showRaw = e.target.checked);
if(els.chkLog) els.chkLog.addEventListener('change', (e) => showLogs = e.target.checked);

if(els.themeBtn) els.themeBtn.addEventListener('click', () => {
    isLightMode = !isLightMode;
    if(isLightMode) {
        document.body.classList.add('light-mode');
        els.themeBtn.innerText = "🌙 MODE";
        els.themeBtn.classList.replace('text-yellow-500', 'text-slate-600');
        els.themeBtn.classList.replace('border-yellow-800/50', 'border-slate-400');
    } else {
        document.body.classList.remove('light-mode');
        els.themeBtn.innerText = "☀ MODE";
        els.themeBtn.classList.replace('text-slate-600', 'text-yellow-500');
        els.themeBtn.classList.replace('border-slate-400', 'border-yellow-800/50');
    }
    drawDial(); drawRadar(); drawLiveChart();
});
function getTheme() { return isLightMode ? COLORS.light : COLORS.dark; }

// --- LAYOUT RESIZING & COL RESIZING ---
function makeResizable(resizer, type, el1, el2, el3) {
    if (!resizer) return;
    let startPos, startSize1, startSize3;
    const onMouseMove = (e) => {
        if (type === 'h') {
            const dx = e.clientX - startPos;
            const parentW = el1.parentElement.offsetWidth;
            if(resizer.id === 'resizer-1') {
                const newW = ((startSize1 + dx) / parentW) * 100;
                if(newW > 10 && newW < 50) { el1.style.width = newW + '%'; drawDial(); resizeRadar(); }
            } else {
                const newW = ((startSize3 - dx) / parentW) * 100;
                if(newW > 10 && newW < 50) { el3.style.width = newW + '%'; resizeRadar(); }
            }
        } else {
            const dy = startPos - e.clientY;
            const newH = startSize1 + dy;
            if(newH > 40 && newH < window.innerHeight * 0.6) {
                el1.style.height = newH + 'px';
                resizeLiveChart(); resizeRadar();
            }
        }
    };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    resizer.addEventListener('mousedown', (e) => {
        startPos = type === 'h' ? e.clientX : e.clientY;
        if(type === 'h') { startSize1 = el1.offsetWidth; startSize3 = el3.offsetWidth; } else { startSize1 = el1.offsetHeight; }
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    });
}
makeResizable(document.getElementById('resizer-1'), 'h', els.panels.left, els.panels.center, els.panels.right);
makeResizable(document.getElementById('resizer-2'), 'h', els.panels.left, els.panels.center, els.panels.right);
makeResizable(document.getElementById('resizer-terminal'), 'v', els.panels.terminal);

// Column resizing logic
document.querySelectorAll('.col-resizer').forEach(resizer => {
    let startX, startW;
    const th = resizer.parentElement;
    resizer.addEventListener('mousedown', (e) => {
        startX = e.clientX; startW = th.offsetWidth;
        resizer.classList.add('resizing');
        const onColMove = (em) => {
            const w = startW + (em.clientX - startX);
            if(w > 20) th.style.width = w + 'px';
        };
        const onColUp = () => {
            document.removeEventListener('mousemove', onColMove); document.removeEventListener('mouseup', onColUp);
            resizer.classList.remove('resizing');
        };
        document.addEventListener('mousemove', onColMove); document.addEventListener('mouseup', onColUp);
        e.stopPropagation();
    });
});

// --- TABS ---
window.switchTab = (tab) => {
    currentTab = tab;
    ['live', 'map', 'wifi'].forEach(t => {
        const btn = els.tabs[t], view = els.views[t];
        if(t === tab) {
            btn.className = "px-4 py-1 text-xs font-bold rounded bg-indigo-600 text-white";
            view.style.display = 'flex'; view.classList.add('active');
        } else {
            btn.className = "px-4 py-1 text-xs font-bold rounded hover:bg-slate-700 text-slate-400";
            view.style.display = 'none'; view.classList.remove('active');
        }
    });
    if(tab === 'live') { setTimeout(resizeLiveChart, 50); if(liveTarget.ssid && isConnected) sendCommand(`TRACK:${liveTarget.ssid}:${liveTarget.channel}`); }
    else if(tab === 'map') { setTimeout(() => { drawDial(); resizeRadar(); }, 50); if(mapTarget.ssid && isConnected) sendCommand(`TRACK:${mapTarget.ssid}:${mapTarget.channel}`); else if(isConnected) sendCommand("STOP"); }
};

window.startPing = () => {
    if(!isConnected) { alert("Please connect serial first."); return; }
    const target = document.getElementById('pingTarget').value || "google.com";
    const count = document.getElementById('pingCount').value || 5;
    log("SYS", `Initiating Ping: ${target} (${count}x)...`);
    sendCommand(`PING:${target}:${count}`);
};

// --- SERIAL ---
if(els.connect) els.connect.addEventListener('click', async () => {
    if ("serial" in navigator) {
        try {
            port = await navigator.serial.requestPort(); await port.open({ baudRate: 115200 });
            const td = new TextDecoderStream(); port.readable.pipeTo(td.writable); reader = td.readable.getReader();
            const te = new TextEncoderStream(); te.readable.pipeTo(port.writable); writer = te.writable.getWriter();
            isConnected = true; log("SYS", "CONNECTED"); els.connect.innerText="LINKED"; els.connect.disabled=true;
            readLoop(); sendCommand("SCAN"); sendCommand("GET_STATUS");
        } catch(e) { log("ERR", e.message); }
    } else alert("No Serial API");
});
if(els.scan) els.scan.addEventListener('click', () => sendCommand("SCAN"));
async function readLoop() {
    let buffer = "";
    try {
        while(true) {
            const {value,done}=await reader.read(); if(done)break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            lines.forEach(l => {
                const line = l.trim();
                if(showRaw && line) log("RAW", line, true);
                try { processLine(line); } catch(e){ console.error(e); }
            });
        }
    } catch(e){ log("ERR", "DISCONNECTED"); isConnected=false; }
}
async function sendCommand(c) { if(writer) await writer.write(c+"\n"); }
function processLine(line) {
    if(!line) return;
    if(line.startsWith("DATA:")) {
        const parts=line.substring(5).split(','); const rssi=parseInt(parts[0]);
        if(currentTab==='live') { els.disp.rssi.innerText=rssi; liveChartData.push(rssi); liveChartData.shift(); drawLiveChart(); }
        else if(currentTab==='map') handleMapData(rssi);
    } else if(line.startsWith("LIST:")) {
        const p=line.substring(5).split(',');
        if(p.length>=5) addNetwork(p[0],p[1],p[2]);
    } else if(line.startsWith("STATUS:DEVICE:")) updateDeviceStatus(line);
    else if(line.startsWith("STATUS:SCAN_START")) {
        if(els.list) els.list.innerHTML = "";
        log("SYS", "SCANNING...");
    }
    else if(line.startsWith("LOG:")) log("DEV", line.substring(4));
}

function addNetwork(ssid, rssi, ch, bssid, sec) {
    // Add to Live List
    createListItem(els.list, ssid, rssi, ch, sec, () => {
        liveTarget={ssid,channel:ch}; mapTarget={ssid,channel:ch};
        els.disp.rssi.innerText="--";
        els.mapTarget.innerText = ssid;
        if(isConnected) sendCommand(`TRACK:${ssid}:${ch}`);
        // switchTab('live'); // Removed to prevent forced switching
    });
}

function createListItem(container, ssid, rssi, ch, sec, onClick) {
    if(!container) return;
    const d = document.createElement('div');
    d.className="list-item cursor-pointer group";
    d.innerHTML=`
        <div class="flex justify-between mb-1">
            <span class="font-bold text-slate-200 break-all pr-2">${ssid}</span>
            <span class="text-sky-400 font-mono text-xs whitespace-nowrap">${rssi}dBm</span>
        </div>
        <div class="text-[10px] text-slate-500 font-mono flex justify-between">
            <span>CH:${ch}</span>
            <span class="text-slate-400">${sec || ''}</span>
        </div>`;
    d.onclick = onClick;
    container.appendChild(d);
}

function updateDeviceStatus(line) {
    if (line.startsWith("STATUS:DEVICE:CONNECTED")) {
        // Split by comma. Expected: ["STATUS:DEVICE:CONNECTED", "SSID", "IP", "RSSI", "GW", "MASK", "MAC"]
        const parts = line.split(",");
        if (parts.length >= 4) { // At least up to RSSI
            els.mini.state.innerText = "ONLINE"; els.mini.state.className="text-green-500 font-bold";
            els.mini.ssid.innerText = parts[1] || "";
            els.mini.ip.innerText = parts[2] || "--";
            els.mini.rssi2.innerText = (parts[3] || "--") + "dBm";
        }
    } else if(line.includes("DISCONNECTED")) els.mini.state.innerText="OFFLINE";
}

// --- DATA ---
window.exportCSV = () => {
    let csv = "ID,Angle,AvgRSSI,Count,Raw_Samples\n";
    mapData.forEach(d => {
        const rawStr = d.rawSamples.join(';');
        csv += `${d.id},${d.angle},${d.rssi},${d.rawSamples.length},"${rawStr}"\n`;
    });
    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a'); a.href = url; a.download = "radar_data.csv"; a.click();
};
window.importCSV = (input) => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        mapData = []; measurementID = 1;
        let importedCount = 0;
        const startIdx = lines[0].includes("ID") ? 1 : 0;
        for(let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim(); if(!line) continue;
            const parts = line.split(',');
            if(parts.length >= 4) {
                const id = parseInt(parts[0]);
                const angle = parseInt(parts[1]);
                const rssi = parseInt(parts[2]);
                const count = parseInt(parts[3]);
                let rawSamples = [];
                if(parts.length >= 5) {
                    let rawStr = parts.slice(4).join(',');
                    rawStr = rawStr.replace(/"/g, '');
                    if(rawStr) rawSamples = rawStr.split(';').map(Number).filter(n => !isNaN(n));
                }
                if(rawSamples.length === 0) rawSamples = new Array(count).fill(rssi);
                mapData.push({ id: measurementID++, angle, rssi, rawSamples });
                importedCount++;
            }
        }
        updateTable(); drawRadar(); log("SYS", `Imported ${importedCount} records.`);
    };
    reader.readAsText(file); input.value = '';
};

// --- MAP & RADAR ---
function log(l,m, isRaw=false) {
    if(!isRaw && !showLogs) return;
    const d=document.createElement('div');
    d.innerText=`[${l}] ${m}`;
    if(isRaw) d.classList.add('text-slate-600');
    els.log.appendChild(d); els.log.scrollTop=els.log.scrollHeight;
}

let dialAngle = 0, isDraggingDial = false;
const dialCtx = els.dial.getContext('2d');
function drawDial() {
    if (!els.dial.parentElement || els.dial.parentElement.offsetWidth === 0) return;
    const rect = els.dial.parentElement.getBoundingClientRect();
    els.dial.width = rect.width; els.dial.height = rect.height;
    const ctx = dialCtx, w = els.dial.width, h = els.dial.height, cx = w/2, cy = h/2, r = Math.max(0, Math.min(w,h)/2 - 15);
    const C = getTheme();
    ctx.clearRect(0, 0, w, h);
    let grd = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r);
    grd.addColorStop(0, C.dialBg1); grd.addColorStop(1, C.dialBg2);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = C.dialRing; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = C.stroke; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r-5, 0, 2*Math.PI); ctx.stroke();
    for(let i=0; i<360; i+=22.5) {
        const rad = (i - 90) * Math.PI / 180, isMajor = (i % 45 === 0);
        const x1 = cx + (r - 10) * Math.cos(rad), y1 = cy + (r - 10) * Math.sin(rad);
        const x2 = cx + (r - 10 - (isMajor?12:6)) * Math.cos(rad), y2 = cy + (r - 10 - (isMajor?12:6)) * Math.sin(rad);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? C.tickM : C.tickm; ctx.lineWidth = isMajor ? 2 : 1; ctx.stroke();
        if(isMajor && r > 60) {
            const tx = cx + (r - 35) * Math.cos(rad), ty = cy + (r - 35) * Math.sin(rad);
            ctx.fillStyle = C.tickm; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(Math.round(i)+"°", tx, ty);
        }
    }
    const arrowRad = (dialAngle - 90) * Math.PI / 180;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(arrowRad); ctx.shadowBlur=5; ctx.shadowColor="rgba(0,0,0,0.5)";
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(r-15, 0); ctx.lineTo(0, 4); ctx.fillStyle = C.needle; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2*Math.PI); ctx.fillStyle = "#e2e8f0"; ctx.fill();
    ctx.restore();
}
function updateDialUI() { drawDial(); els.angleInput.value = dialAngle; els.dialVal.innerText = dialAngle + "°"; }
function setAngleFromEvent(e) {
    const rect = els.dial.getBoundingClientRect();
    let deg = Math.atan2(e.clientY - rect.top - rect.height/2, e.clientX - rect.left - rect.width/2) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360; deg = Math.round(deg / 22.5) * 22.5; dialAngle = deg % 360; updateDialUI();
}
if(els.dial) els.dial.addEventListener('mousedown', (e) => { isDraggingDial = true; setAngleFromEvent(e); });
window.addEventListener('mousemove', (e) => { if(isDraggingDial) setAngleFromEvent(e); });
window.addEventListener('mouseup', () => { isDraggingDial = false; });
if(els.angleInput) els.angleInput.addEventListener('change', () => { dialAngle = (parseFloat(els.angleInput.value)||0) % 360; updateDialUI(); });

if(els.measureBtn) els.measureBtn.addEventListener('click', () => {
    if(!isConnected || !mapTarget.ssid) { log("ERR", "Connect/Target req."); return; }
    isMeasuring = true; currentSamples = [];
    requiredSamples = parseInt(els.sampleInput.value) || 2;
    els.measureBtn.disabled = true; els.measureBtn.innerText = "SAMPLING...";
    els.statText.innerText = `0 / ${requiredSamples}`; els.progBar.style.width = "0%";
    sendCommand(`TRACK:${mapTarget.ssid}:${mapTarget.channel}`);
});
function handleMapData(rssi) {
    if(!isMeasuring || rssi <= -100) return;
    currentSamples.push(rssi);
    els.progBar.style.width = (currentSamples.length / requiredSamples) * 100 + "%";
    els.statText.innerText = `${currentSamples.length}/${requiredSamples}`;
    if(currentSamples.length >= requiredSamples) finishMeasurement();
}
function finishMeasurement() {
    isMeasuring = false; els.measureBtn.disabled = false; els.measureBtn.innerText = "START"; els.statText.innerText = "Done.";
    let avg = Math.round(currentSamples.reduce((a, b) => a + b, 0) / currentSamples.length);
    mapData.push({ id: measurementID++, angle: dialAngle, rssi: avg, rawSamples: [...currentSamples] });
    updateTable(); drawRadar(); log("MAP", `Saved: ${avg}dBm @ ${dialAngle}°`);
}

const radarCtx = els.radar.getContext('2d');
const getQuality = (rssi) => Math.max(0, Math.min(100, (rssi + 100) * 1.5));
if(els.radarModeBtn) els.radarModeBtn.addEventListener('click', () => {
    radarMode = radarMode === 'rssi' ? 'quality' : 'rssi';
    els.radarModeBtn.innerText = `MODE: ${radarMode.toUpperCase()}`;
    drawRadar();
});
function resizeRadar() {
    if (els.radar.parentElement.offsetWidth < 1) return;
    els.radar.width = els.radar.parentElement.offsetWidth; els.radar.height = els.radar.parentElement.offsetHeight;
    drawRadar();
}
function drawRadar() {
    const ctx = radarCtx, w = els.radar.width, h = els.radar.height;
    if (w < 1) return;
    const cx = w/2, cy = h/2, maxR = Math.max(0, Math.min(w,h)/2 - 20);
    const C = getTheme();
    radarPoints = [];
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(s => { ctx.beginPath(); ctx.arc(cx, cy, maxR*s, 0, 2*Math.PI); ctx.stroke(); });
    for(let i=0; i<360; i+=45) {
        const rad = (i - 90) * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad)); ctx.stroke();
    }
    if(predictedAngle !== null) {
        const pRad = (predictedAngle - 90) * Math.PI / 180;
        const endX = cx + maxR * Math.cos(pRad), endY = cy + maxR * Math.sin(pRad);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(endX, endY);
        ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "bold 12px sans-serif"; ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center"; ctx.fillText("TARGET", endX, endY - 10);
    }
    if(mapData.length > 0) {
        let uniqueAngles = {};
        mapData.forEach(d => { if(!uniqueAngles[d.angle]) uniqueAngles[d.angle] = []; uniqueAngles[d.angle].push(d.rssi); });
        let sortedAngles = Object.keys(uniqueAngles).map(Number).sort((a,b)=>a-b);
        ctx.beginPath();
        sortedAngles.forEach((ang, i) => {
            let avgRssi = uniqueAngles[ang].reduce((a,b)=>a+b,0) / uniqueAngles[ang].length;
            let r = radarMode==='rssi' ? (avgRssi + 95) / 70 : getQuality(avgRssi)/100;
            if(r<0)r=0; if(r>1)r=1;
            let rad = (ang - 90) * Math.PI / 180;
            let x = cx + r * maxR * Math.cos(rad), y = cy + r * maxR * Math.sin(rad);
            if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.closePath(); ctx.fillStyle = C.fill; ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 2; ctx.stroke();
        mapData.forEach(d => {
            let r = radarMode==='rssi' ? (d.rssi + 95) / 70 : getQuality(d.rssi)/100;
            if(r<0)r=0; if(r>1)r=1;
            let rad = (d.angle - 90) * Math.PI / 180;
            let x = cx + r * maxR * Math.cos(rad), y = cy + r * maxR * Math.sin(rad);
            radarPoints.push({ x, y, id: d.id, angle: d.angle, rssi: d.rssi, samples: d.rawSamples.length });
            const isHovered = (d.id === hoveredPointId);
            ctx.beginPath(); ctx.arc(x, y, isHovered ? 6 : 4, 0, 2*Math.PI);
            ctx.fillStyle = d.id === hoveredPointId ? "#ffff00" : (isLightMode ? "#334155" : "#fff"); ctx.fill();
            if(isHovered) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
        });
    }
}
if(els.radar) els.radar.addEventListener('mousemove', (e) => {
    const rect = els.radar.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    let hit = radarPoints.find(p => Math.sqrt(Math.pow(mouseX - p.x, 2) + Math.pow(mouseY - p.y, 2)) < 15);
    if(hit) {
        if(hoveredPointId !== hit.id) { hoveredPointId = hit.id; drawRadar(); highlightRow(hit.id); }
        els.tooltip.style.left = (e.clientX + 15) + 'px'; els.tooltip.style.top = (e.clientY + 15) + 'px';
        els.tooltip.innerHTML = `<div class='font-bold text-yellow-400'>#${hit.id}</div><div>${hit.angle}° | ${hit.rssi}dBm</div>`;
        els.tooltip.classList.remove('hidden'); els.radar.style.cursor = 'pointer';
    } else {
        if(hoveredPointId !== null) { hoveredPointId = null; drawRadar(); highlightRow(null); }
        els.tooltip.classList.add('hidden'); els.radar.style.cursor = 'crosshair';
    }
});
if(els.radar) els.radar.addEventListener('mouseleave', () => { if(hoveredPointId!==null) { hoveredPointId=null; drawRadar(); highlightRow(null); } els.tooltip.classList.add('hidden'); });

function updateTable() {
    els.table.innerHTML = "";
    [...mapData].reverse().forEach(d => {
        const row = document.createElement('tr'); row.id = `row-${d.id}`; row.className = "main-row border-b border-slate-800";
        row.innerHTML = `
            <td class="text-center"><button onclick="event.stopPropagation(); toggleSubRow(${d.id})" class="text-sky-500 font-mono text-[10px] hover:text-white">[+]</button></td>
            <td class="font-bold text-yellow-400">${d.angle}°</td>
            <td class="font-mono text-sky-400 font-bold">${d.rssi}</td>
            <td class="text-slate-400 text-center">${d.rawSamples.length}</td>
            <td class="text-center text-red-500 cursor-pointer" onclick="event.stopPropagation(); deleteMeasurement(${d.id})">x</td>
        `;
        const subRow = document.createElement('tr');
        subRow.id = `subrow-${d.id}`; subRow.className = "sub-row hidden";
        subRow.innerHTML = `<td colspan="5" class="p-1 bg-slate-900/50 inset-shadow"><div class="flex flex-wrap gap-1 text-[9px] font-mono text-slate-500"><span>RAW:</span>${d.rawSamples.map(v => `<span class="bg-slate-800 px-1 rounded text-slate-300">${v}</span>`).join('')}</div></td>`;
        row.addEventListener('mouseenter', () => { hoveredPointId = d.id; drawRadar(); });
        row.addEventListener('mouseleave', () => { hoveredPointId = null; drawRadar(); });
        els.table.appendChild(row); els.table.appendChild(subRow);
    });
}
window.toggleSubRow = (id) => { const sub = document.getElementById(`subrow-${id}`); if(sub) sub.classList.toggle('hidden'); };
window.deleteMeasurement = (id) => { mapData=mapData.filter(d=>d.id!==id); updateTable(); drawRadar(); };
window.clearMapData = () => { mapData=[]; predictedAngle=null; updateTable(); drawRadar(); els.predResult.innerText="--"; };
function highlightRow(id) { document.querySelectorAll('.active-row').forEach(r=>r.classList.remove('active-row')); if(id){ const r=document.getElementById(`row-${id}`); if(r) r.classList.add('active-row'); }}
window.generateTestData = () => {
    log("SIM", "Generating random sweep..."); mapData = []; measurementID = 1; predictedAngle = null;
    const centerAngle = Math.floor(Math.random() * 360);
    const peakRSSI = -40 - Math.random() * 20;
    log("SIM", `Sim Source: ${centerAngle}°`);
    for (let ang = 0; ang < 360; ang += 22.5) {
        let dist = Math.abs(ang - centerAngle); if (dist > 180) dist = 360 - dist;
        let signal = -95 + (peakRSSI + 95) * Math.exp(-(dist*dist)/(2*45*45));
        signal += (Math.random() - 0.5) * 8;
        let rssi = Math.round(signal);
        mapData.push({ id: measurementID++, angle: ang, rssi: rssi, rawSamples: [rssi, rssi-1, rssi+1] });
    }
    updateTable(); drawRadar();
};
window.calculateSource = () => {
    const validPoints = mapData.filter(d => d.rssi > -100);
    if(validPoints.length < 3) { els.predResult.innerText="NEED DATA"; return; }
    let sumSin=0, sumCos=0;
    validPoints.forEach(d => {
        let w = Math.pow(10, (d.rssi+100)/20);
        let r = (d.angle-90)*Math.PI/180;
        sumSin += Math.sin(r)*w; sumCos += Math.cos(r)*w;
    });
    let deg = Math.round(Math.atan2(sumSin,sumCos)*180/Math.PI + 90);
    if(deg<0) deg+=360; predictedAngle = deg;
    els.predResult.innerHTML = `<span class='text-yellow-400 font-bold'>EST: ${deg}°</span>`; drawRadar();
};

// Resize
const liveCtx = els.liveChart.getContext('2d');
function resizeLiveChart() { if(els.liveChart.parentElement.offsetWidth > 0) { els.liveChart.width = els.liveChart.parentElement.offsetWidth; els.liveChart.height = els.liveChart.parentElement.offsetHeight; drawLiveChart(); } }

window.openLiveChartImage = () => {
    const w = window.open("");
    w.document.write('<img src="' + els.liveChart.toDataURL() + '"/>');
};

function drawLiveChart() {
    if(currentTab!=='live') return;
    const w=els.liveChart.width, h=els.liveChart.height, C=getTheme();
    if(w<1) return;
    const ctx=liveCtx;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);

    // Auto Scale
    let minVal = Math.min(...liveChartData, -100);
    let maxVal = Math.max(...liveChartData, -30);
    if(maxVal - minVal < 20) { maxVal += 10; minVal -= 10; }
    const pRange = maxVal - minVal;
    const xOffset = 30;
    const yMargin = 10;
    const drawW = w - xOffset;
    const drawH = h - 2 * yMargin;

    // Grid & Labels
    ctx.fillStyle = C.text; ctx.font = "10px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const stepY = pRange / 5;
    for(let i=0; i<=5; i++) {
        let val = minVal + i*stepY;
        let y = yMargin + drawH - ((val - minVal) / pRange * drawH);
        ctx.beginPath(); ctx.moveTo(xOffset, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.fillText(Math.round(val), xOffset - 4, y);
    }

    // Plot
    ctx.strokeStyle = C.stroke; ctx.lineWidth = 2; ctx.beginPath();
    const stepX = drawW / (liveChartData.length - 1);
    liveChartData.forEach((v, i) => {
        let y = yMargin + drawH - ((v - minVal) / pRange * drawH);
        if (i === 0) ctx.moveTo(xOffset, y); else ctx.lineTo(xOffset + i * stepX, y);
    });
    ctx.stroke();
}
window.addEventListener('resize', () => { resizeLiveChart(); if(currentTab==='map') { drawDial(); resizeRadar(); } });
switchTab('live');
