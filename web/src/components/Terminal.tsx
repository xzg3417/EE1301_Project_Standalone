import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const Terminal: React.FC = () => {
    const { logs, clearLogs } = useApp();
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-black text-xs font-mono">
            <div className="flex justify-between items-center bg-gray-900 px-2 py-1 border-b border-gray-800">
                <span className="text-gray-500">SYSTEM LOG</span>
                <button onClick={clearLogs} className="text-gray-500 hover:text-white">CLEAR</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 text-gray-400">
                {logs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};

export default Terminal;
