/*
 * Project: Web_Serial_WiFi_Tester_v2
 * Hardware: Particle Photon 2
 * Description: Outputs structured data and logs for Web Serial API
 */

#include "Particle.h"

SYSTEM_THREAD(ENABLED);

// --- 函数声明 ---
void performScan();
void performTracking();
void sendLog(String level, String msg);

// 状态定义
enum State {
  STATE_IDLE,
  STATE_SCANNING,
  STATE_TRACKING
};

State currentState = STATE_IDLE;
String targetSSID = "";
WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;

void setup() {
  Serial.begin(115200);
  // 强制使用外部天线接口 (连接 W24P-U)
  WiFi.selectAntenna(ANT_EXTERNAL);
  
  // 等待一小会儿确保串口稳定
  delay(2000);
  sendLog("INFO", "System Booted. Antenna: EXTERNAL (W24P-U)");
}

void loop() {
  // 处理来自网页的指令
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "SCAN") {
      sendLog("INFO", "Command received: SCAN");
      currentState = STATE_SCANNING;
    } 
    else if (cmd.startsWith("TRACK:")) {
      String newTarget = cmd.substring(6);
      if (newTarget.length() > 0) {
        targetSSID = newTarget;
        sendLog("INFO", "Command received: TRACK target [" + targetSSID + "]");
        currentState = STATE_TRACKING;
      } else {
        sendLog("ERROR", "Invalid TRACK command: Empty SSID");
      }
    }
    else if (cmd == "STOP") {
      sendLog("INFO", "Command received: STOP");
      currentState = STATE_IDLE;
    }
    else {
      sendLog("WARN", "Unknown command: " + cmd);
    }
  }

  // 状态机逻辑
  switch (currentState) {
    case STATE_SCANNING:
      performScan();
      currentState = STATE_IDLE; 
      break;

    case STATE_TRACKING:
      // 这里的间隔不宜过短，因为WiFi.scan本身是阻塞的
      if (millis() - lastUpdate > 100) { 
        performTracking();
        lastUpdate = millis();
      }
      break;

    case STATE_IDLE:
      // 空闲状态
      break;
  }
}

// 辅助函数：发送格式化日志
// 格式: LOG:LEVEL:Message
void sendLog(String level, String msg) {
  Serial.print("LOG:");
  Serial.print(level);
  Serial.print(":");
  Serial.println(msg);
}

void performScan() {
  Serial.println("STATUS:SCAN_START");
  sendLog("INFO", "Starting WiFi Scan...");
  
  // 执行扫描
  int found = WiFi.scan(aps, 50);
  
  if (found < 0) {
    sendLog("ERROR", "WiFi Scan failed with error code: " + String(found));
    Serial.println("STATUS:SCAN_END");
    return;
  }

  sendLog("INFO", "Scan complete. Found " + String(found) + " networks.");
  
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
  // 硬件限制：WiFi.scan 必须扫描所有信道，这是一个物理阻塞过程(约1-3秒)
  int found = WiFi.scan(aps, 50); 
  
  int max_rssi = -120;
  bool found_target = false;

  for (int i = 0; i < found; i++) {
    if (String(aps[i].ssid) == targetSSID) {
      found_target = true;
      // 取最强的一个（应对 Mesh 网络有多个同名 AP 的情况）
      if (aps[i].rssi > max_rssi) {
        max_rssi = aps[i].rssi;
      }
    }
  }

  if (found_target) {
    // 找到目标
    Serial.print("DATA:");
    Serial.println(max_rssi);
  } else {
    // 本次扫描未发现目标
    // 原因可能是：1. 信号太弱 2. 天线背对目标 3. 扫描瞬间丢包
    Serial.println("DATA:-120");
    sendLog("WARN", "Target [" + targetSSID + "] not found in this sweep.");
  }
}