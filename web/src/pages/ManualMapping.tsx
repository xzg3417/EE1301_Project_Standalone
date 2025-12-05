import React, { useState } from 'react';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Button, InputNumber, Progress, Table, Alert } from 'antd';
import { AimOutlined, ClearOutlined, DownloadOutlined } from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import Dial from '../components/Dial';
import Radar from '../components/Radar';

const ManualMapping: React.FC = () => {
    const {
        liveTarget, isConnected,
        startMeasurement, isMeasuring, measureProgress,
        mapData, deleteMeasurement, clearMapData
    } = useApp();

    const [angle, setAngle] = useState(0);
    const [samples, setSamples] = useState(2);
    const [predictedAngle, setPredictedAngle] = useState<number | null>(null);
    const [radarMode, setRadarMode] = useState<'rssi'|'quality'>('rssi');

    const handleMeasure = () => {
        if (!liveTarget) return;
        startMeasurement(liveTarget.ssid, liveTarget.channel, samples, angle);
    };

    const calculateSource = () => {
        const validPoints = mapData.filter(d => d.rssi > -100);
        if(validPoints.length < 3) return;
        let sumSin = 0, sumCos = 0;
        validPoints.forEach(d => {
            const w = Math.pow(10, (d.rssi + 100) / 20);
            const r = (d.angle - 90) * Math.PI / 180;
            sumSin += Math.sin(r) * w;
            sumCos += Math.cos(r) * w;
        });
        let deg = Math.round(Math.atan2(sumSin, sumCos) * 180 / Math.PI + 90);
        if (deg < 0) deg += 360;
        setPredictedAngle(deg);
    };

    const columns = [
        { title: 'Ang', dataIndex: 'angle', width: 60, render: (v: number) => <b>{v}°</b> },
        { title: 'RSSI', dataIndex: 'rssi', width: 80, render: (v: number) => <span className="text-blue-400 font-mono font-bold">{v}</span> },
        { title: '#', dataIndex: 'rawSamples', width: 50, render: (v: number[]) => v.length },
        { title: 'Act', width: 50, render: (_: any, record: any) => (
                <Button type="text" danger size="small" onClick={() => deleteMeasurement(record.id)}>x</Button>
            )
        }
    ];

    return (
        <div className="h-full flex gap-4 p-4">
            {/* Left Control Panel */}
            <div className="w-1/4 min-w-[280px] flex flex-col gap-4 overflow-y-auto">
                <ProCard title="DIRECTION CONTROL" bordered headerBordered>
                    <div className="flex flex-col items-center">
                        <div className="aspect-square w-full relative mb-4 max-w-[200px]">
                            <Dial angle={angle} setAngle={setAngle} />
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-bold pointer-events-none text-white drop-shadow-md">
                                {angle}°
                            </div>
                        </div>
                        <InputNumber
                            min={0} max={360} step={22.5}
                            value={angle} onChange={(v) => setAngle(v || 0)}
                            className="w-full"
                            addonAfter="deg"
                            size="large"
                        />
                    </div>
                </ProCard>

                <ProCard title="MEASUREMENT" bordered headerBordered>
                     {!liveTarget ? (
                         <Alert message="Select a target in Live Monitor first" type="warning" showIcon className="mb-4" />
                     ) : (
                         <div className="mb-4 text-xs font-mono text-blue-400 font-bold text-center bg-gray-900/50 border border-blue-900/30 p-2 rounded">
                             TARGET: {liveTarget.ssid} (CH:{liveTarget.channel})
                         </div>
                     )}

                     <div className="flex justify-between items-center mb-4">
                         <span className="text-gray-400">Sample Count:</span>
                         <InputNumber min={1} max={50} value={samples} onChange={v => setSamples(v || 2)} className="w-24" />
                     </div>

                     <Button
                        type="primary" block size="large"
                        icon={<AimOutlined />}
                        disabled={!liveTarget || !isConnected || isMeasuring}
                        loading={isMeasuring}
                        onClick={handleMeasure}
                        className="mb-2"
                     >
                        {isMeasuring ? 'SAMPLING...' : 'START MEASURE'}
                     </Button>

                     {isMeasuring && (
                        <Progress percent={(measureProgress.current / measureProgress.total) * 100} size="small" status="active" />
                     )}
                </ProCard>

                <StatisticCard
                    title="ANALYTICS"
                    bordered
                    statistic={{
                        title: 'Estimated Source',
                        value: predictedAngle !== null ? `${predictedAngle}°` : '--',
                        valueStyle: { color: predictedAngle !== null ? '#faad14' : '#gray' }
                    }}
                    footer={
                        <div className="flex gap-2 mt-2">
                            <Button size="small" onClick={calculateSource}>Calculate</Button>
                            <Button size="small" icon={<DownloadOutlined />}>CSV</Button>
                            <Button size="small" danger icon={<ClearOutlined />} onClick={clearMapData}>Clear</Button>
                        </div>
                    }
                />
            </div>

            {/* Center Radar */}
            <ProCard
                className="flex-1 bg-black"
                bordered
                headerBordered
                title="RADAR VISUALIZATION"
                extra={
                    <Button size="small" onClick={() => setRadarMode(m => m === 'rssi' ? 'quality' : 'rssi')}>
                        MODE: {radarMode.toUpperCase()}
                    </Button>
                }
                bodyStyle={{ padding: 0, height: '100%', position: 'relative' }}
            >
                <div className="absolute inset-0">
                    <Radar data={mapData} predictedAngle={predictedAngle} mode={radarMode} />
                </div>
            </ProCard>

            {/* Right Data Table */}
            <ProCard title="DATA LOG" className="w-1/4 min-w-[220px]" bodyStyle={{ padding: 0 }} bordered headerBordered>
                <Table
                    dataSource={[...mapData].reverse()}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 600 }}
                />
            </ProCard>
        </div>
    );
};

export default ManualMapping;
