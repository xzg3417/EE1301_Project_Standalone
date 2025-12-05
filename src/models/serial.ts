// src/models/serial.ts
import { useState, useCallback } from 'react';

export default () => {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter<string> | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [rssi, setRssi] = useState<number | null>(null);
  const [scanResults, setScanResults] = useState<any[]>([]);

  const log = useCallback((type: string, msg: string) => {
    setLogs((prev) => [...prev, `[${type}] ${msg}`]);
  }, []);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert('No Serial API');
      return;
    }
    try {
      const p = await navigator.serial.requestPort();
      await p.open({ baudRate: 115200 });
      setPort(p);

      const td = new TextDecoderStream();
      p.readable?.pipeTo(td.writable);
      const reader = td.readable.getReader();

      const te = new TextEncoderStream();
      te.readable.pipeTo(p.writable!);
      const w = te.writable.getWriter();
      setWriter(w);
      setIsConnected(true);
      log('SYS', 'CONNECTED');

      // Start read loop
      readLoop(reader);
    } catch (e: any) {
      log('ERR', e.message);
    }
  }, [log]);

  const readLoop = async (reader: ReadableStreamDefaultReader<string>) => {
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => processLine(line.trim()));
      }
    } catch (e) {
      log('ERR', 'DISCONNECTED');
      setIsConnected(false);
    }
  };

  const processLine = (line: string) => {
    if (!line) return;
    if (line.startsWith('DATA:')) {
      const parts = line.substring(5).split(',');
      const val = parseInt(parts[0], 10);
      setRssi(val);
    } else if (line.startsWith('LIST:')) {
        const p = line.substring(5).split(',');
        if (p.length >= 3) {
            setScanResults(prev => {
                // Avoid duplicates or update existing? The original script appends.
                // We'll append for now, or maybe unshift to show newest.
                // Format: SSID, RSSI, CH, BSSID, SEC
                return [...prev, { ssid: p[0], rssi: p[1], channel: p[2], bssid: p[3], sec: p[4] }];
            });
        }
    } else if (line.startsWith('LOG:')) {
      log('DEV', line.substring(4));
    }
  };

  const sendCommand = useCallback(async (cmd: string) => {
    if (writer) {
      await writer.write(cmd + '\n');
    }
  }, [writer]);

  return {
    isConnected,
    connect,
    sendCommand,
    logs,
    rssi,
    scanResults,
    setScanResults, // Exposed to clear it
  };
};
