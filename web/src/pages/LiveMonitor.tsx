import React from 'react';
import { ProCard, ProList, StatisticCard } from '@ant-design/pro-components';
import { Tag, Button, Empty } from 'antd';
import { ReloadOutlined, DownloadOutlined, WifiOutlined } from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import LiveChart from '../components/LiveChart';

const LiveMonitor: React.FC = () => {
  const { networks, liveChartData, liveTarget, setLiveTarget, sendCommand } = useApp();

  const handleScan = () => {
    sendCommand("SCAN");
  };

  const handleTrack = (ssid: string, ch: number) => {
    setLiveTarget({ ssid, channel: ch });
    sendCommand(`TRACK:${ssid}:${ch}`);
  };

  const currentRssi = liveChartData[liveChartData.length - 1];

  return (
    <div className="h-full flex flex-row gap-4 p-4 overflow-hidden">
      {/* Network List */}
      <ProCard
        title="NETWORKS"
        className="h-full w-1/4 min-w-[320px]"
        extra={<Button type="text" icon={<ReloadOutlined />} onClick={handleScan} />}
        bodyStyle={{ padding: 0, overflowY: 'auto' }}
        bordered
        headerBordered
      >
        <ProList<{ ssid: string; rssi: number; channel: number; security: string }>
            rowKey="ssid"
            dataSource={networks}
            renderItem={(item) => (
                <div
                    className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${liveTarget?.ssid === item.ssid ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : ''}`}
                    onClick={() => handleTrack(item.ssid, item.channel)}
                >
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 overflow-hidden">
                             <WifiOutlined className={item.rssi > -60 ? "text-green-500" : "text-gray-500"} />
                             <span className="font-bold text-gray-200 truncate">{item.ssid}</span>
                        </div>
                        <Tag color={item.rssi > -60 ? 'success' : item.rssi > -80 ? 'warning' : 'error'}>{item.rssi} dBm</Tag>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 font-mono pl-6">
                        <span>CH: {item.channel}</span>
                        <span>{item.security}</span>
                    </div>
                </div>
            )}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Waiting for scan..." /> }}
        />
      </ProCard>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Stats */}
        <div className="flex gap-4 h-24 shrink-0">
             <StatisticCard
                statistic={{
                    title: 'Live RSSI',
                    value: currentRssi,
                    suffix: 'dBm',
                    precision: 0,
                    valueStyle: { color: currentRssi > -60 ? '#52c41a' : '#f5222d' }
                }}
                chart={
                    <div className="text-gray-500 text-xs mt-2">Target: {liveTarget ? liveTarget.ssid : '--'}</div>
                }
                className="flex-1"
                bordered
             />
             <StatisticCard
                statistic={{
                    title: 'Update Rate',
                    value: 0,
                    suffix: 'Hz',
                }}
                className="flex-1"
                bordered
             />
        </div>

        {/* Live Chart */}
        <ProCard
            className="flex-1 flex flex-col min-h-0 relative"
            title="LIVE SIGNAL PLOT"
            extra={<Button size="small" icon={<DownloadOutlined />}>Export PNG</Button>}
            bodyStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}
            bordered
            headerBordered
        >
            <LiveChart data={liveChartData} />
        </ProCard>
      </div>
    </div>
  );
};

export default LiveMonitor;
