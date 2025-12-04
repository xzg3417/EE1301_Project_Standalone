/*
 * Project: Web_Serial_WiFi_Tester_v3_Fixed
 * Hardware: Particle Photon 2
 * Description: Fixed compilation errors (Removed unsupported WiFiScanParams)
 */

#include "Particle.h"

// Device OS 6.x 默认已开启系统线程，无需再显式调用 SYSTEM_THREAD(ENABLED);

// --- 函数声明 ---
void performFullScan();
void performFastTracking();
void sendLog(String level, String msg);
String macToString(const uint8_t* mac);
String securityToString(int security);

// 状态定义
enum State {
  STATE_IDLE,
  STATE_SCANNING,
  STATE_TRACKING
};

State currentState = STATE_IDLE;

// 追踪目标信息
String targetSSID = "";
int targetChannel = 0;
String targetBSSID = "";

WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;

void setup() {
  Serial.begin(115200);
  WiFi.selectAntenna(ANT_EXTERNAL);
  delay(2000);
  sendLog("INFO", "System Booted. Standard Mode Ready.");
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "SCAN") {
      sendLog("INFO", "Command: FULL SCAN");
      currentState = STATE_SCANNING;
    } 
    else if (cmd.startsWith("TRACK:")) {
      // 解析 TRACK:SSID:CHANNEL
      int firstColon = cmd.indexOf(':');
      int lastColon = cmd.lastIndexOf(':');
      
      if (lastColon > firstColon) {
        targetSSID = cmd.substring(firstColon + 1, lastColon);
        targetChannel = cmd.substring(lastColon + 1).toInt();
        sendLog("INFO", "TARGET LOCKED: [" + targetSSID + "]");
        currentState = STATE_TRACKING;
      } else {
        // 兼容旧指令
        targetSSID = cmd.substring(6);
        targetChannel = 0; 
        sendLog("WARN", "Legacy TRACK command.");
        currentState = STATE_TRACKING;
      }
    }
    else if (cmd == "STOP") {
      sendLog("INFO", "Command: STOP");
      currentState = STATE_IDLE;
    }
  }

  switch (currentState) {
    case STATE_SCANNING:
      performFullScan();
      currentState = STATE_IDLE; 
      break;

    case STATE_TRACKING:
      // P2 目前不支持用户层信道锁定，必须使用标准扫描
      // 这里的间隔不宜过短，因为 WiFi.scan 是阻塞的
      if (millis() - lastUpdate > 100) { 
        performFastTracking();
        lastUpdate = millis();
      }
      break;

    case STATE_IDLE:
      break;
  }
}

void sendLog(String level, String msg) {
  Serial.print("LOG:"); Serial.print(level); Serial.print(":"); Serial.println(msg);
}

// 全信道扫描
void performFullScan() {
  Serial.println("STATUS:SCAN_START");
  sendLog("INFO", "Scanning all channels...");
  
  int found = WiFi.scan(aps, 50);
  
  if (found < 0) {
    sendLog("ERROR", "Scan failed: " + String(found));
    Serial.println("STATUS:SCAN_END");
    return;
  }

  sendLog("INFO", "Scan done. Found " + String(found) + " APs.");
  
  for (int i = 0; i < found; i++) {
    // 协议: LIST:SSID,RSSI,CHANNEL,BSSID,SECURITY
    Serial.print("LIST:");
    Serial.print(aps[i].ssid);
    Serial.print(",");
    Serial.print(aps[i].rssi);
    Serial.print(",");
    Serial.print(aps[i].channel);
    Serial.print(",");
    Serial.print(macToString(aps[i].bssid));
    Serial.print(",");
    Serial.println(securityToString(aps[i].security));
  }
  Serial.println("STATUS:SCAN_END");
}

// 追踪模式 (已修复编译错误)
void performFastTracking() {
  // 修正：Photon 2 目前不支持 WiFiScanParams 结构体，必须回退到标准扫描
  // 虽然不能锁定信道加速，但依然可以正常获取 RSSI 数据
  int found = WiFi.scan(aps, 50);
  
  int max_rssi = -120;
  bool found_target = false;
  
  String currentBSSID = "";
  int currentChannel = 0;

  for (int i = 0; i < found; i++) {
    if (String(aps[i].ssid) == targetSSID) {
      found_target = true;
      if (aps[i].rssi > max_rssi) {
        max_rssi = aps[i].rssi;
        currentBSSID = macToString(aps[i].bssid);
        currentChannel = aps[i].channel;
      }
    }
  }

  if (found_target) {
    // DATA:RSSI,CHANNEL,BSSID
    Serial.print("DATA:");
    Serial.print(max_rssi);
    Serial.print(",");
    Serial.print(currentChannel);
    Serial.print(",");
    Serial.println(currentBSSID);
  } else {
    Serial.println("DATA:-120,0,LOST");
  }
}

// 辅助：格式化 MAC 地址
String macToString(const uint8_t* mac) {
  char buf[20];
  snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X", 
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

// 辅助：格式化加密类型
String securityToString(int security) {
  switch (security) {
    case WLAN_SEC_UNSEC: return "OPEN";
    case WLAN_SEC_WEP: return "WEP";
    case WLAN_SEC_WPA: return "WPA";
    case WLAN_SEC_WPA2: return "WPA2";
    case WLAN_SEC_WPA_ENTERPRISE: return "WPA-Ent";
    case WLAN_SEC_WPA2_ENTERPRISE: return "WPA2-Ent";
    case WLAN_SEC_WPA3: return "WPA3";
    default: return "UNKNOWN";
  }
}