import React, { useEffect, useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, List, Button, Statistic } from 'antd';
import { Line } from '@ant-design/plots';
import { useModel } from '@umijs/max';

const LiveMonitor: React.FC = () => {
  const { isConnected, rssi, scanResults, sendCommand, setScanResults, connect } = useModel('serial');
  const [data, setData] = useState<{ time: number; value: number }[]>([]);
  const chartRef = useRef<any>(null);

  // Buffer for chart data
  useEffect(() => {
    if (rssi !== null) {
      setData((prev) => {
        const newData = [...prev, { time: Date.now(), value: rssi }];
        if (newData.length > 100) newData.shift(); // Keep last 100 points
        return newData;
      });
    }
  }, [rssi]);

  const handleScan = () => {
    setScanResults([]);
    sendCommand('SCAN');
  };

  const handleConnect = () => {
      connect();
  };

  const config = {
    data,
    xField: 'time',
    yField: 'value',
    smooth: true,
    animation: false, // Disable animation for performance
    xAxis: {
      type: 'time',
      mask: 'HH:mm:ss',
    },
    yAxis: {
      max: -20,
      min: -120,
    },
  };

  return (
    <PageContainer
        extra={[
            <Button key="connect" type="primary" onClick={handleConnect} disabled={isConnected}>
                {isConnected ? 'LINKED' : 'CONNECT SERIAL'}
            </Button>
        ]}
    >
      <Row gutter={16} style={{ height: 'calc(100vh - 200px)' }}>
        <Col span={6} style={{ height: '100%', overflow: 'auto' }}>
          <Card title="NETWORKS" extra={<Button type="link" onClick={handleScan}>REFRESH</Button>} style={{ height: '100%' }} bodyStyle={{ padding: 0, height: 'calc(100% - 57px)', overflowY: 'auto' }}>
            <List
              dataSource={scanResults}
              renderItem={(item) => (
                <List.Item
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                        sendCommand(`TRACK:${item.ssid}:${item.channel}`);
                    }}
                    style={{ padding: '10px 20px', borderBottom: '1px solid #f0f0f0' }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.ssid}</span>
                        <span style={{ color: '#1890ff', fontFamily: 'monospace' }}>{item.rssi}dBm</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                        <span>CH:{item.channel}</span>
                        <span>{item.sec}</span>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={18} style={{ height: '100%' }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                    <Card>
                        <Statistic title="Live RSSI" value={rssi ?? '--'} suffix="dBm" valueStyle={{ color: '#1890ff' }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card>
                         {/* Rate calculation is omitted for brevity, can add later */}
                        <Statistic title="Rate" value={0} suffix="Hz" valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
            </Row>
          <Card title="LIVE PLOT" style={{ height: 'calc(100% - 130px)' }} bodyStyle={{ height: '100%' }}>
             <div style={{ height: '100%', minHeight: 300 }}>
                <Line {...config} />
             </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default LiveMonitor;
