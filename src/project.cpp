#include "Particle.h"
#include <vector>

// 【关键】使用手动模式，完全接管网络控制权
// 不会自动连接 Particle Cloud，排除云端干扰
SYSTEM_MODE(MANUAL);
SYSTEM_THREAD(ENABLED);

const unsigned long SAMPLE_INTERVAL_MS = 20; // 尝试推到极限 50Hz
unsigned long lastSampleTime = 0;

// 还是需要 UDP 刺激
UDP udp;
IPAddress gatewayIP;
unsigned long lastTriggerTime = 0;

void setup() {
    Serial.begin(115200);
    Serial.println("System Starting in MANUAL mode...");
    
    // 1. 显式开启 Wi-Fi
    WiFi.on();
    WiFi.clearCredentials(); // (可选) 如果需要清除旧数据
    
    // 2. 这里请填入您的 Wi-Fi 信息，确保连接最快建立
    // 如果设备已经存有密码，可以直接调用 WiFi.connect()
    if (!WiFi.hasCredentials()) {
        WiFi.setCredentials("Hiveton-H5000M", "happy@1001");
    }
    
    WiFi.connect();
    
    Serial.println("Connecting to WiFi...");
    while(!WiFi.ready()) {
        Serial.print(".");
        delay(100);
    }
    Serial.println("\nWiFi Connected!");
    
    gatewayIP = WiFi.gatewayIP();
    udp.begin(8888);
}

void loop() {
    unsigned long currentMillis = millis();

    // 疯狂发包模式 (每 50ms)
    if (currentMillis - lastTriggerTime >= 50) {
        lastTriggerTime = currentMillis;
        if (WiFi.ready()) {
            udp.beginPacket(gatewayIP, 8888);
            udp.write((uint8_t)0xFF); 
            udp.endPacket();
        }
    }

    if (currentMillis - lastSampleTime >= SAMPLE_INTERVAL_MS) {
        lastSampleTime = currentMillis;
        
        if (WiFi.ready()) {
            // 直接读取，不做滤波，看最原始的反应
            int rssi = WiFi.RSSI().getStrengthValue();
            
            // 为了调试，我们只打印发生变化的数值
            // 或者打印高频数据看是否有重复
            static int lastRssi = 0;
            if (rssi != lastRssi) {
                Serial.printf("CHANGE: %lu ms, RSSI: %d dBm\n", currentMillis, rssi);
                lastRssi = rssi;
            } else {
                // 如果您想看重复频率，取消下面这行的注释
                 Serial.printf("SAME:   %lu ms, RSSI: %d dBm\n", currentMillis, rssi);
            }
        }
    }
}