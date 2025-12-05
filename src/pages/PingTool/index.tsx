import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Input, InputNumber, Button, List, Typography } from 'antd';
import { useModel } from '@umijs/max';

const { Text } = Typography;

const PingTool: React.FC = () => {
  const { isConnected, sendCommand, logs } = useModel('serial');
  const [target, setTarget] = useState('google.com');
  const [count, setCount] = useState(5);

  const handlePing = () => {
      if (!isConnected) {
          alert("Connect Serial First");
          return;
      }
      sendCommand(`PING:${target}:${count}`);
  };

  return (
    <PageContainer>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Card title="Network Diagnostics" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 2 }}>
                      <label>Target Host / IP</label>
                      <Input value={target} onChange={e => setTarget(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                      <label>Count</label>
                      <InputNumber min={1} max={20} value={count} onChange={v => setCount(v || 5)} style={{ width: '100%' }} />
                  </div>
              </div>
              <Button type="primary" block size="large" onClick={handlePing} disabled={!isConnected}>
                  START PING
              </Button>
          </Card>

          <Card title="SYSTEM LOG" bodyStyle={{ padding: 0, height: 400, overflowY: 'auto', background: '#000' }}>
              <List
                  dataSource={logs}
                  renderItem={item => (
                      <div style={{ padding: '2px 10px', fontFamily: 'monospace', fontSize: 12 }}>
                          {item.includes('ERR') ? <Text type="danger">{item}</Text> : <Text style={{ color: '#ccc' }}>{item}</Text>}
                      </div>
                  )}
              />
          </Card>
      </div>
    </PageContainer>
  );
};

export default PingTool;
