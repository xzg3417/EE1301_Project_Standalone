import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Button, InputNumber, Progress, Table, Tooltip, Alert } from 'antd';
import { useModel } from '@umijs/max';
import Dial from '@/components/Dial';
import RadarPlot from '@/components/RadarPlot';

const ManualMapping: React.FC = () => {
  const { isConnected, sendCommand, rssi, scanResults } = useModel('serial');
  const {
      mapData, isMeasuring, currentSamples, requiredSamples, dialAngle,
      setDialAngle, startMeasure, addSample, deleteMeasurement, clearMapData
  } = useModel('mapping');

  // Sync RSSI to mapping model
  useEffect(() => {
      if (rssi !== null) {
          addSample(rssi);
      }
  }, [rssi, addSample]);

  // Target selection state (could be moved to model if needed globally, but local is fine if we select here)
  const [targetSSID, setTargetSSID] = useState<string | null>(null);
  const [targetChannel, setTargetChannel] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [predictedAngle, setPredictedAngle] = useState<number | null>(null);

  // Auto-select first target if available and none selected
  useEffect(() => {
      if (!targetSSID && scanResults.length > 0) {
          setTargetSSID(scanResults[0].ssid);
          setTargetChannel(scanResults[0].channel);
      }
  }, [scanResults, targetSSID]);

  const handleMeasure = () => {
      if (targetSSID && isConnected) {
          sendCommand(`TRACK:${targetSSID}:${targetChannel}`);
          startMeasure(requiredSamples); // Use current input val
      }
  };

  const calculateSource = () => {
      const validPoints = mapData.filter(d => d.rssi > -100);
      if (validPoints.length < 3) {
          alert("Need more data points (>=3)");
          return;
      }
      let sumSin = 0, sumCos = 0;
      validPoints.forEach(d => {
          let w = Math.pow(10, (d.rssi + 100) / 20);
          let r = (d.angle - 90) * Math.PI / 180;
          sumSin += Math.sin(r) * w;
          sumCos += Math.cos(r) * w;
      });
      let deg = Math.round(Math.atan2(sumSin, sumCos) * 180 / Math.PI + 90);
      if (deg < 0) deg += 360;
      setPredictedAngle(deg);
  };

  const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 50 },
      { title: 'Angle', dataIndex: 'angle', key: 'angle', render: (val: number) => <b>{val}°</b> },
      { title: 'RSSI', dataIndex: 'rssi', key: 'rssi', render: (val: number) => <span style={{ color: '#1890ff' }}>{val}</span> },
      { title: 'Samples', dataIndex: 'rawSamples', key: 'samples', render: (val: number[]) => val.length },
      {
          title: 'Action',
          key: 'action',
          render: (_: any, record: any) => (
              <Button size="small" danger type="text" onClick={() => deleteMeasurement(record.id)}>Delete</Button>
          )
      }
  ];

  return (
    <PageContainer>
      <Row gutter={16} style={{ height: 'calc(100vh - 200px)' }}>
        {/* LEFT PANEL: CONTROLS */}
        <Col span={6} style={{ height: '100%', overflow: 'auto' }}>
            <Card title="DIRECTION" bordered={false} style={{ marginBottom: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Dial angle={dialAngle} onChange={setDialAngle} width={200} height={200} />
                    <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>{dialAngle}°</div>
                    <InputNumber min={0} max={360} value={dialAngle} onChange={(v) => setDialAngle(v || 0)} />
                </div>
            </Card>

            <Card title="MEASUREMENT" bordered={false} style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#888' }}>TARGET: </span>
                    <strong>{targetSSID || 'SELECT IN LIVE TAB'}</strong>
                </div>
                {/* Simplified sample count input - could be state controlled if needed */}
                <Button type="primary" block onClick={handleMeasure} loading={isMeasuring} disabled={!isConnected || !targetSSID}>
                    {isMeasuring ? 'SAMPLING...' : 'START MEASURE'}
                </Button>
                {isMeasuring && <Progress percent={Math.round((currentSamples.length / requiredSamples) * 100)} size="small" status="active" style={{ marginTop: 8 }} />}
            </Card>

            <Card title="ANALYTICS" bordered={false}>
                <Button block onClick={calculateSource} style={{ marginBottom: 8 }}>CALC SOURCE</Button>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    Result: {predictedAngle !== null ? <span style={{ color: '#faad14', fontWeight: 'bold' }}>{predictedAngle}°</span> : '--'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                     {/* Helpers */}
                    <Button size="small" onClick={clearMapData} danger>CLEAR ALL</Button>
                </div>
            </Card>
        </Col>

        {/* CENTER PANEL: RADAR */}
        <Col span={12} style={{ height: '100%' }}>
            <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                 <RadarPlot
                    data={mapData.map(d => ({...d, samples: d.rawSamples.length}))}
                    predictedAngle={predictedAngle}
                    hoveredId={hoveredId}
                    onHover={setHoveredId}
                    width={500}
                    height={500}
                 />
                 {hoveredId && (() => {
                     const pt = mapData.find(p => p.id === hoveredId);
                     if(pt) return <div style={{position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: 5, borderRadius: 4}}>
                         #{pt.id} | {pt.angle}° | {pt.rssi}dBm
                     </div>
                     return null;
                 })()}
            </Card>
        </Col>

        {/* RIGHT PANEL: DATA TABLE */}
        <Col span={6} style={{ height: '100%', overflow: 'auto' }}>
            <Card title="DATA LOG" style={{ height: '100%' }} bodyStyle={{ padding: 0 }}>
                <Table
                    dataSource={mapData}
                    columns={columns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    onRow={(record) => ({
                        onMouseEnter: () => setHoveredId(record.id),
                        onMouseLeave: () => setHoveredId(null),
                        style: { background: record.id === hoveredId ? '#e6f7ff' : '' }
                    })}
                />
            </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default ManualMapping;
