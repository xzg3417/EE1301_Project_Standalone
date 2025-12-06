import React from 'react';
import { ProCard, ProForm, ProFormText, ProFormDigit } from '@ant-design/pro-components';
import { Alert } from 'antd';
import { useApp } from '../context/AppContext';

const PingTool: React.FC = () => {
    const { isConnected, sendCommand, addLog } = useApp();

    const handlePing = (values: { target: string; count: number }) => {
        if (!isConnected) {
            addLog("SYS", "Please connect serial first.");
            return;
        }
        addLog("SYS", `Initiating Ping: ${values.target} (${values.count}x)...`);
        sendCommand(`PING:${values.target}:${values.count}`);
    };

    return (
        <div className="h-full flex items-center justify-center p-4">
            <ProCard title="Network Diagnostics" className="max-w-md w-full" bordered headerBordered>
                {!isConnected && <Alert message="Serial connection required" type="error" showIcon className="mb-4" />}

                <ProForm
                    onFinish={async (values) => handlePing(values as { target: string; count: number })}
                    submitter={{
                        searchConfig: {
                            submitText: 'START PING',
                        },
                        submitButtonProps: {
                            size: 'large',
                            block: true,
                            disabled: !isConnected
                        },
                        resetButtonProps: {
                            style: { display: 'none' },
                        },
                    }}
                    initialValues={{
                        target: 'google.com',
                        count: 5
                    }}
                >
                    <ProFormText
                        name="target"
                        label="Target Host / IP"
                        placeholder="e.g. google.com"
                        rules={[{ required: true, message: 'Please enter a target' }]}
                    />
                    <ProFormDigit
                        name="count"
                        label="Ping Count"
                        min={1}
                        max={20}
                        fieldProps={{ precision: 0 }}
                    />
                </ProForm>

                <div className="text-center text-xs text-gray-500 mt-4 border-t border-gray-800 pt-2">
                    Results will appear in the System Log below.
                </div>
            </ProCard>
        </div>
    );
};

export default PingTool;
