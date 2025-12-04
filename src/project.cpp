/*
 * Project: Web_Serial_WiFi_Tester
 * Hardware: Particle Photon 2
 * Description: Outputs structured data for Web Serial API
 */

#include "Particle.h"

SYSTEM_THREAD(ENABLED);

// --- 函数声明 (Forward Declarations) ---
// 必须在 setup/loop 调用之前声明这些函数，否则编译会报错
void performScan();
void performTracking();

// 状态定义
enum State { STATE_IDLE, STATE_SCANNING, STATE_TRACKING };

State currentState = STATE_IDLE;
String targetSSID = "";
WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;

void setup() {
    Serial.begin(115200);
    // 强制使用外部天线接口 (连接 W24P-U)
    WiFi.selectAntenna(ANT_EXTERNAL);
}

void loop() {
    // 处理来自网页的指令
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "SCAN") {
            currentState = STATE_SCANNING;
        } else if (cmd.startsWith("TRACK:")) {
            targetSSID = cmd.substring(6);  // 提取 "TRACK:" 之后的内容
            currentState = STATE_TRACKING;
        } else if (cmd == "STOP") {
            currentState = STATE_IDLE;
        }
    }

    // 状态机逻辑
    switch (currentState) {
    case STATE_SCANNING:
        performScan();
        currentState = STATE_IDLE;  // 扫描完回到空闲，等待用户选择
        break;

    case STATE_TRACKING:
        if (millis() - lastUpdate > 100) {  // 100ms 刷新率 (高速)
            performTracking();
            lastUpdate = millis();
        }
        break;

    case STATE_IDLE:
        // 发送心跳包防止网页认为断开，或者什么都不做
        break;
    }
}

void performScan() {
    Serial.println("STATUS:SCAN_START");
    int found = WiFi.scan(aps, 50);

    for (int i = 0; i < found; i++) {
        // 数据格式: LIST:SSID,RSSI
        Serial.print("LIST:");
        Serial.print(aps[i].ssid);
        Serial.print(",");
        Serial.println(aps[i].rssi);
    }
    Serial.println("STATUS:SCAN_END");
}

void performTracking() {
    // 在追踪模式下，我们只关心目标 SSID 的最强信号
    int found = WiFi.scan(aps, 50);  // 注意：硬件限制 scan 仍然会扫所有
    int max_rssi = -120;
    bool found_target = false;

    for (int i = 0; i < found; i++) {
        if (String(aps[i].ssid) == targetSSID) {
            found_target = true;
            if (aps[i].rssi > max_rssi) {
                max_rssi = aps[i].rssi;
            }
        }
    }

    if (found_target) {
        // 数据格式: DATA:RSSI
        Serial.print("DATA:");
        Serial.println(max_rssi);
    } else {
        // 如果这一轮没扫到，发送极低值表示丢失
        Serial.println("DATA:-120");
    }
}