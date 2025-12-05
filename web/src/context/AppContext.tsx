import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { message } from 'antd';

// --- Types ---

export interface Network {
  ssid: string;
  rssi: number;
  channel: number;
  bssid?: string;
  security: string;
  lastSeen: number;
}

export interface Measurement {
  id: number;
  angle: number;
  rssi: number;
  rawSamples: number[];
}

export interface DeviceStatus {
  state: string;
  ssid: string;
  ip: string;
  rssi: string;
}

interface AppContextType {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendCommand: (cmd: string) => Promise<void>;

  logs: string[];
  addLog: (source: string, msg: string) => void;
  clearLogs: () => void;

  networks: Network[];
  liveChartData: number[];

  mapData: Measurement[];
  addMeasurement: (angle: number, rssi: number, samples: number[]) => void;
  deleteMeasurement: (id: number) => void;
  clearMapData: () => void;

  deviceStatus: DeviceStatus;

  // Measurement State
  isMeasuring: boolean;
  measureProgress: { current: number; total: number };
  startMeasurement: (ssid: string, channel: number, count: number, angle: number) => void;

  // Target for live tracking
  liveTarget: { ssid: string; channel: number } | null;
  setLiveTarget: (target: { ssid: string; channel: number } | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [liveChartData, setLiveChartData] = useState<number[]>(new Array(150).fill(-120));
  const [mapData, setMapData] = useState<Measurement[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ state: 'OFFLINE', ssid: '--', ip: '--', rssi: '--' });
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureProgress, setMeasureProgress] = useState({ current: 0, total: 0 });
  const [liveTarget, setLiveTarget] = useState<{ ssid: string; channel: number } | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);

  // Measurement refs to handle logic inside async loop
  const measurementRef = useRef<{
    active: boolean;
    samples: number[];
    required: number;
    angle: number;
  }>({ active: false, samples: [], required: 0, angle: 0 });

  const measurementIdRef = useRef(1);

  const addLog = useCallback((source: string, msg: string) => {
    // Determine if we show raw logs? For now just store them formatted
    const logLine = `[${source}] ${msg}`;
    setLogs(prev => {
        const newLogs = [...prev, logLine];
        if (newLogs.length > 500) return newLogs.slice(newLogs.length - 500);
        return newLogs;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const sendCommand = useCallback(async (cmd: string) => {
    if (writerRef.current) {
      try {
        await writerRef.current.write(cmd + "\n");
      } catch (e: any) {
        addLog("ERR", `Send Failed: ${e.message}`);
      }
    }
  }, [addLog]);

  const processLine = useCallback((line: string) => {
    if (!line) return;

    if (line.startsWith("DATA:")) {
      const parts = line.substring(5).split(',');
      const rssi = parseInt(parts[0]);

      // Update Live Chart
      setLiveChartData(prev => {
        const newData = [...prev, rssi];
        if (newData.length > 150) newData.shift();
        return newData;
      });

      // Handle Measurement
      if (measurementRef.current.active) {
         if (rssi > -100) {
             measurementRef.current.samples.push(rssi);
             setMeasureProgress({
                 current: measurementRef.current.samples.length,
                 total: measurementRef.current.required
             });

             if (measurementRef.current.samples.length >= measurementRef.current.required) {
                 const avg = Math.round(measurementRef.current.samples.reduce((a, b) => a + b, 0) / measurementRef.current.samples.length);
                 const newMeasurement: Measurement = {
                     id: measurementIdRef.current++,
                     angle: measurementRef.current.angle,
                     rssi: avg,
                     rawSamples: [...measurementRef.current.samples]
                 };
                 setMapData(prev => [...prev, newMeasurement]);
                 measurementRef.current.active = false;
                 setIsMeasuring(false);
                 addLog("MAP", `Saved: ${avg}dBm @ ${measurementRef.current.angle}°`);
             }
         }
      }

    } else if (line.startsWith("LIST:")) {
      const p = line.substring(5).split(',');
      if (p.length >= 3) {
        const ssid = p[0];
        const rssi = parseInt(p[1]);
        const ch = parseInt(p[2]);
        const sec = p[4] || '';

        setNetworks(prev => {
            const existingIdx = prev.findIndex(n => n.ssid === ssid);
            const now = Date.now();
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = { ...updated[existingIdx], rssi, channel: ch, lastSeen: now };
                return updated;
            } else {
                return [...prev, { ssid, rssi, channel: ch, security: sec, lastSeen: now }];
            }
        });
      }
    } else if (line.startsWith("STATUS:DEVICE:CONNECTED")) {
       const parts = line.split(",");
       if (parts.length >= 4) {
           setDeviceStatus({
               state: "ONLINE",
               ssid: parts[1] || "",
               ip: parts[2] || "--",
               rssi: (parts[3] || "--") + "dBm"
           });
       }
    } else if (line.includes("DISCONNECTED")) {
        setDeviceStatus(prev => ({ ...prev, state: "OFFLINE" }));
    } else if (line.startsWith("STATUS:SCAN_START")) {
        setNetworks([]);
        addLog("SYS", "SCANNING...");
    } else if (line.startsWith("LOG:")) {
        addLog("DEV", line.substring(4));
    }
  }, [addLog]);

  const readLoop = async () => {
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await readerRef.current!.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep incomplete line
        lines.forEach(l => {
            const line = l.trim();
            // if (line) addLog("RAW", line, true); // Too noisy usually
            processLine(line);
        });
      }
    } catch (e: any) {
      addLog("ERR", "DISCONNECTED");
      setIsConnected(false);
      setDeviceStatus(prev => ({ ...prev, state: "OFFLINE" }));
    } finally {
      if (readerRef.current) readerRef.current.releaseLock();
    }
  };

  const connect = async () => {
    if ("serial" in navigator) {
      try {
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 115200 });
        portRef.current = port;

        const td = new TextDecoderStream();
        port.readable.pipeTo(td.writable);
        readerRef.current = td.readable.getReader();

        const te = new TextEncoderStream();
        te.readable.pipeTo(port.writable);
        writerRef.current = te.writable.getWriter();

        setIsConnected(true);
        addLog("SYS", "CONNECTED");

        // Start read loop
        readLoop();

        // Init commands
        setTimeout(() => {
            sendCommand("GET_STATUS");
            sendCommand("SCAN");
        }, 500);

      } catch (e: any) {
        addLog("ERR", e.message);
        message.error(`Connection failed: ${e.message}`);
      }
    } else {
      message.error("Web Serial API not supported in this browser.");
    }
  };

  const disconnect = async () => {
    if (readerRef.current) await readerRef.current.cancel();
    if (writerRef.current) await writerRef.current.close();
    if (portRef.current) await portRef.current.close();
    setIsConnected(false);
    addLog("SYS", "DISCONNECTED");
  };

  const startMeasurement = (ssid: string, channel: number, count: number, angle: number) => {
      measurementRef.current = {
          active: true,
          samples: [],
          required: count,
          angle: angle
      };
      setIsMeasuring(true);
      setMeasureProgress({ current: 0, total: count });
      sendCommand(`TRACK:${ssid}:${channel}`);
  };

  const addMeasurement = (angle: number, rssi: number, samples: number[]) => {
      const newMeasurement: Measurement = {
          id: measurementIdRef.current++,
          angle,
          rssi,
          rawSamples: samples
      };
      setMapData(prev => [...prev, newMeasurement]);
  };

  const deleteMeasurement = (id: number) => {
      setMapData(prev => prev.filter(m => m.id !== id));
  };

  const clearMapData = () => {
      setMapData([]);
      measurementIdRef.current = 1;
  };

  return (
    <AppContext.Provider value={{
      isConnected, connect, disconnect, sendCommand,
      logs, addLog, clearLogs,
      networks, liveChartData,
      mapData, addMeasurement, deleteMeasurement, clearMapData,
      deviceStatus,
      isMeasuring, measureProgress, startMeasurement,
      liveTarget, setLiveTarget
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};
