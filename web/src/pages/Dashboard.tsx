import React, { useMemo } from 'react';
import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components';
import { useApp } from '../context/AppContext';
import { Gauge, Area, Pie } from '@ant-design/plots';
import { Tag, Descriptions, Progress, Empty, Button, Space } from 'antd';
import { WifiOutlined, EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons';

const Dashboard: React.FC = () => {
  const {
    deviceStatus,
    liveChartData,
    networks,
    mapData,
    isConnected,
    connect,
    disconnect
  } = useApp();

  // Parse RSSI
  const rssiVal = useMemo(() => {
    if (!deviceStatus.rssi || deviceStatus.rssi === '--') return -100;
    const parsed = parseInt(deviceStatus.rssi.replace('dBm', ''));
    return isNaN(parsed) ? -100 : parsed;
  }, [deviceStatus.rssi]);

  // Determine signal color
  const signalColor = useMemo(() => {
      if (rssiVal > -60) return '#52c41a'; // Green
      if (rssiVal > -80) return '#faad14'; // Yellow
      return '#f5222d'; // Red
  }, [rssiVal]);

  // Gauge Config
  const gaugeConfig = {
    percent: Math.min(Math.max((rssiVal + 100) / 70, 0), 1), // Clamp 0-1
    range: {
      color: signalColor,
    },
    indicator: {
      pointer: {
        style: {
          stroke: '#D0D0D0',
        },
      },
      pin: {
        style: {
          stroke: '#D0D0D0',
        },
      },
    },
    statistic: {
      content: {
        formatter: () => `${rssiVal} dBm`,
        style: {
            fontSize: '24px',
            color: 'rgba(0,0,0,0.85)',
        }
      },
    },
    axis: {
        label: {
            formatter: (v: string) => Number(v) * 100,
        },
        subTickLine: {
            count: 3,
        },
    },
  };

  // Area Chart Config
  const areaData = useMemo(() => {
    return liveChartData.map((val, idx) => ({
      time: (idx || 0).toString(),
      value: val,
    }));
  }, [liveChartData]);

  const areaConfig = {
    data: areaData,
    xField: 'time',
    yField: 'value',
    smooth: true,
    height: 300,
    areaStyle: {
      fill: 'l(270) 0:#ffffff 0.5:#7ec2f3 1:#1890ff',
    },
    line: {
      color: '#1890ff',
    },
    yAxis: {
        min: -130,
        max: -30
    },
    xAxis: {
        range: [0, 1],
    }
  };

  // Pie Chart Config (Channel Distribution)
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(networks)) {
        networks.forEach(n => {
        if (n && n.channel !== undefined && n.channel !== null) {
            const ch = String(n.channel);
            counts[ch] = (counts[ch] || 0) + 1;
        }
        });
    }
    return Object.keys(counts).map(k => ({ type: `Ch ${k}`, value: counts[k] }));
  }, [networks]);

  const pieConfig = {
    appendPadding: 10,
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
    },
    interactions: [{ type: 'element-active' }],
    height: 300,
  };

  // Signal Bars Calculation
  const signalLevel = useMemo(() => {
      if (rssiVal > -50) return 4;
      if (rssiVal > -70) return 3;
      if (rssiVal > -85) return 2;
      return 1;
  }, [rssiVal]);

  return (
    <PageContainer
      title="Overview Information"
      extra={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>Refresh</Button>,
        <Button key="conn" type={isConnected ? 'primary' : 'default'} danger={isConnected} onClick={isConnected ? disconnect : connect}>
            {isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      ]}
      tags={[
        <Tag key="state" color={isConnected ? "green" : "red"}>{deviceStatus.state}</Tag>,
        <Tag key="ssid" color="blue">{deviceStatus.ssid !== '--' ? deviceStatus.ssid : 'No Connection'}</Tag>
      ]}
    >
      <ProCard gutter={[16, 16]} wrap ghost>

        {/* Row 1: Key Metrics */}
        <ProCard colSpan={{ xs: 24, md: 8 }} layout="center" bordered style={{ height: '100%', minHeight: 280 }}>
            <StatisticCard
                title="Signal Strength"
                chart={
                   <div style={{ height: 200, width: '100%', display: 'flex', justifyContent: 'center' }}>
                     <Gauge {...gaugeConfig} height={200} width={200} />
                   </div>
                }
            />
        </ProCard>

        <ProCard colSpan={{ xs: 24, md: 8 }} split="horizontal" bordered style={{ height: '100%', minHeight: 280 }}>
            <ProCard split="vertical">
                <StatisticCard
                    statistic={{
                        title: 'Networks Found',
                        value: networks.length,
                        icon: <WifiOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
                    }}
                />
                <StatisticCard
                    statistic={{
                        title: 'Mapped Points',
                        value: mapData.length,
                        icon: <EnvironmentOutlined style={{ color: '#52c41a', fontSize: 24 }} />,
                    }}
                />
            </ProCard>
             <ProCard>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                    <span style={{ color: '#888' }}>Target SSID:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{useApp().liveTarget?.ssid || 'None'}</span>
                 </div>
            </ProCard>
        </ProCard>

        <ProCard colSpan={{ xs: 24, md: 8 }} title="Connection Details" bordered style={{ height: '100%', minHeight: 280 }}>
             <Descriptions column={1} size="small" bordered>
                 <Descriptions.Item label="IP Address">{deviceStatus.ip}</Descriptions.Item>
                 <Descriptions.Item label="Current SSID">{deviceStatus.ssid}</Descriptions.Item>
                 <Descriptions.Item label="Signal Quality">
                     <Space>
                        <Progress percent={signalLevel * 25} steps={4} strokeColor={signalColor} showInfo={false} size="small" />
                        <span>{signalLevel}/4</span>
                     </Space>
                 </Descriptions.Item>
                 <Descriptions.Item label="RSSI">{deviceStatus.rssi}</Descriptions.Item>
             </Descriptions>
        </ProCard>

        {/* Row 2: Charts */}
        <ProCard split="vertical" bordered headerBordered>
             <ProCard title="RSSI Trend (Live)" colSpan="60%">
                 <Area {...areaConfig} />
             </ProCard>
             <ProCard title="Channel Distribution">
                 {pieData.length > 0 ? <Pie {...pieConfig} /> : <Empty description="No Networks Scanned" />}
             </ProCard>
        </ProCard>

      </ProCard>
    </PageContainer>
  );
};

export default Dashboard;
