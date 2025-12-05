import React, { useState } from 'react';
import { ConfigProvider, theme, Button, FloatButton } from 'antd';
import {
  DashboardOutlined,
  RadarChartOutlined,
  ToolOutlined,
  DisconnectOutlined,
  ApiOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { ProConfigProvider, ProLayout } from '@ant-design/pro-components';
import { useApp } from './context/AppContext';
import { AppProvider } from './context/AppContext';
import Dashboard from './pages/Dashboard';
import ManualMapping from './pages/ManualMapping';
import PingTool from './pages/PingTool';
import Terminal from './components/Terminal';

const AppContent: React.FC = () => {
  const { isConnected, connect, disconnect } = useApp();
  const [pathname, setPathname] = useState('/dashboard');
  const [showTerminal, setShowTerminal] = useState(false);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <ProLayout
        title="SIGNAL_HUNTER"
        logo={null}
        layout="mix"
        navTheme="light"
        splitMenus={false}
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        location={{ pathname }}
        menuItemRender={(item, dom) => (
          <div onClick={() => setPathname(item.path || '/dashboard')}>{dom}</div>
        )}
        route={{
          path: '/',
          routes: [
            { path: '/dashboard', name: 'Overview', icon: <DashboardOutlined /> },
            { path: '/map', name: 'Mapping', icon: <RadarChartOutlined /> },
            { path: '/ping', name: 'Tools', icon: <ToolOutlined /> },
          ],
        }}
        actionsRender={() => [
           <Button
             key="connect"
             type={isConnected ? "default" : "primary"}
             danger={isConnected}
             icon={isConnected ? <DisconnectOutlined /> : <ApiOutlined />}
             onClick={isConnected ? disconnect : connect}
             size="small"
           >
             {isConnected ? 'DISCONNECT' : 'CONNECT SERIAL'}
           </Button>
        ]}
      >
        <div style={{ height: 'calc(100vh - 100px)', overflow: 'auto', position: 'relative' }}>
            {pathname === '/dashboard' && <Dashboard />}
            {pathname === '/map' && <ManualMapping />}
            {pathname === '/ping' && <PingTool />}
        </div>

        {/* Floating Terminal Toggle */}
        <FloatButton
            icon={<CodeOutlined />}
            type={showTerminal ? "primary" : "default"}
            onClick={() => setShowTerminal(!showTerminal)}
            tooltip="Toggle Terminal"
        />

        {/* Terminal Overlay */}
        {showTerminal && (
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '200px',
                zIndex: 1000,
                borderTop: '1px solid #d9d9d9',
                background: '#fff',
                boxShadow: '0 -2px 8px rgba(0,0,0,0.15)'
            }}>
                <Terminal />
            </div>
        )}

      </ProLayout>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#1890ff',
                },
            }}
        >
            <ProConfigProvider dark={false}>
                <AppProvider>
                    <AppContent />
                </AppProvider>
            </ProConfigProvider>
        </ConfigProvider>
    );
};

export default App;
