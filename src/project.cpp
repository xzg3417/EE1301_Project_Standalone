/*
 * Project: Web_Serial_Radar_v10_Mapping_Engine
 * Hardware: Particle Photon 2
 * Description: Stable scanning backend for Semi-Automated Mapping WebUI.
 */

#include "Particle.h"

// --- 函数声明 ---
void performFullScan();
void performStableTracking();
void performPing(String target, int count);
void sendLog(String level, String msg);
void reportDeviceStatus();
String macToString(const uint8_t* mac);
String securityToString(int security);
int parseSecurity(String sec);

// 状态定义
enum State {
  STATE_IDLE,
  STATE_SCANNING,
  STATE_TRACKING,
  STATE_CONNECTING_WIFI
};

State currentState = STATE_IDLE;

// 追踪目标信息
String targetSSID = "";
int targetChannel = 0;

// WiFi Config
String pendingSSID = "";
String pendingPass = "";
int pendingSec = WLAN_SEC_WPA2;

WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;
unsigned long lastStatusReport = 0; 
unsigned long connectionStartTime = 0;

void setup() {
  Serial.begin(115200);
  WiFi.selectAntenna(ANT_EXTERNAL);
  delay(2000);
  sendLog("INFO", "System Booted. Radar Engine v10.");
}

void loop() {
  // 1. 处理串口指令
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "SCAN") {
      sendLog("INFO", "Command: FULL SCAN");
      currentState = STATE_SCANNING;
    } 
    else if (cmd.startsWith("TRACK:")) {
      int firstColon = cmd.indexOf(':');
      int lastColon = cmd.lastIndexOf(':');
      if (lastColon > firstColon) {
        targetSSID = cmd.substring(firstColon + 1, lastColon);
        targetChannel = cmd.substring(lastColon + 1).toInt();
        sendLog("INFO", "TARGET LOCKED: [" + targetSSID + "]");
        currentState = STATE_TRACKING;
      }
    }
    else if (cmd == "GET_STATUS") {
      reportDeviceStatus();
    }
    else if (cmd == "STOP") {
      sendLog("INFO", "Command: STOP");
      currentState = STATE_IDLE;
    }
    else if (cmd.startsWith("SET_SSID:")) {
      pendingSSID = cmd.substring(9);
      sendLog("INFO", "Pending SSID set.");
    }
    else if (cmd.startsWith("SET_PASS:")) {
      pendingPass = cmd.substring(9);
      sendLog("INFO", "Pending Pass set.");
    }
    else if (cmd.startsWith("SET_SEC:")) {
      String s = cmd.substring(8);
      pendingSec = parseSecurity(s);
      sendLog("INFO", "Pending Security set to " + s);
    }
    else if (cmd == "DO_CONNECT") {
      sendLog("INFO", "Initiating connection sequence...");

      WiFi.on();
      WiFi.clearCredentials();
      sendLog("INFO", "Credentials cleared.");

      // Select appropriate overload based on security
      if (pendingSec == WLAN_SEC_UNSEC) {
          WiFi.setCredentials(pendingSSID);
          sendLog("INFO", "Credentials set for OPEN network.");
      } else {
          // Note: Photon 2 supports specific cipher selection,
          // but AES is standard for WPA2/3.
          WiFi.setCredentials(pendingSSID, pendingPass, pendingSec, WLAN_CIPHER_AES);
          sendLog("INFO", "Credentials set for SECURE network.");
      }

      WiFi.connect();
      sendLog("INFO", "WiFi.connect() called. Waiting for link...");

      currentState = STATE_CONNECTING_WIFI;
      connectionStartTime = millis();
      pendingPass = ""; // Clear pass from memory
    }
  }

  // 2. 状态机逻辑
  switch (currentState) {
    case STATE_SCANNING:
      performFullScan();
      currentState = STATE_IDLE; 
      break;

    case STATE_CONNECTING_WIFI:
      // Feedback & Timeout Logic
      if (WiFi.ready()) {
          sendLog("SUCCESS", "Connected! IP: " + WiFi.localIP().toString());
          currentState = STATE_IDLE;
      } else {
          // Provide periodic feedback every 1s
          if (millis() - lastUpdate > 1000) {
              int rssi = WiFi.RSSI();
              if (rssi > 0) rssi = -100; // Fix invalid RSSI during connect
              sendLog("INFO", "Negotiating... Signal: " + String(rssi) + "dBm");
              lastUpdate = millis();
          }

          // Timeout after 20 seconds
          if (millis() - connectionStartTime > 20000) {
              sendLog("ERROR", "Connection Timed Out.");
              currentState = STATE_IDLE;
          }
      }
      break;

    case STATE_TRACKING:
      // 保持 1ms 的最小间隔，尽可能快地获取数据
      if (millis() - lastUpdate > 1) { 
        performStableTracking();
        lastUpdate = millis();
      }
      break;

    case STATE_IDLE:
      break;
  }

  // 3. 定时报告设备状态 (3秒一次)
  if (millis() - lastStatusReport > 3000) {
    reportDeviceStatus();
    lastStatusReport = millis();
  }
}

// 报告设备状态 (使用逗号分隔，避免 MAC 地址冲突)
void reportDeviceStatus() {
  if (WiFi.ready()) {
    Serial.print("STATUS:DEVICE:CONNECTED,"); 
    Serial.print(WiFi.SSID());
    Serial.print(",");
    Serial.print(WiFi.localIP());
    Serial.print(",");
    
    // RSSI 估算转换 (0-100% -> -90dBm to -30dBm)
    WiFiSignal sig = WiFi.RSSI();
    int rssi = (int)((sig.getStrength() * 0.6) - 90);
    Serial.print(rssi);
    Serial.print(",");
    
    Serial.print(WiFi.gatewayIP());
    Serial.print(",");
    Serial.print(WiFi.subnetMask());
    Serial.print(",");
    
    uint8_t mac[6];
    WiFi.macAddress(mac);
    Serial.println(macToString(mac)); 
    
  } else {
    Serial.println("STATUS:DEVICE:DISCONNECTED");
  }
}

void sendLog(String level, String msg) {
  Serial.print("LOG:"); Serial.print(level); Serial.print(":"); Serial.println(msg);
}

void performFullScan() {
  Serial.println("STATUS:SCAN_START");
  sendLog("INFO", "Scanning spectrum...");
  int found = WiFi.scan(aps, 50);
  if (found < 0) {
    sendLog("ERROR", "Scan err: " + String(found));
    Serial.println("STATUS:SCAN_END");
    return;
  }
  
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

void performPing(String target, int count) {
  if (count <= 0) count = 5;
  sendLog("INFO", "Pinging " + target + " with " + String(count) + " attempts...");

  int success = 0;
  for (int i = 0; i < count; i++) {
    unsigned long start = millis();
    // nTries=1. Returns number of successful packets (1 or 0) or error (<0)
    int result = WiFi.ping(target, 1);
    unsigned long duration = millis() - start;

    if (result > 0) {
      success++;
      Serial.println("LOG:RAW:Reply from " + target + ": time=" + String(duration) + "ms");
    } else {
      Serial.println("LOG:RAW:Request timed out.");
    }
    // Small delay between pings
    if (i < count - 1) delay(1000);
  }

  sendLog("INFO", "Ping statistics: Sent=" + String(count) + ", Received=" + String(success) + ", Lost=" + String(count - success));
}

void performStableTracking() {
  // 核心追踪逻辑：全信道扫描
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
    // 没扫到 (可能信号太弱或信标帧丢失)
    // 仍然发送心跳，方便前端判断连接状态
    Serial.println("DATA:-120,0,SCANNING...");
  }
}

String macToString(const uint8_t* mac) {
  char buf[20];
  snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X", 
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

String securityToString(int security) {
  switch (security) {
    case WLAN_SEC_UNSEC: return "OPEN";
    case WLAN_SEC_WEP: return "WEP";
    case WLAN_SEC_WPA: return "WPA";
    case WLAN_SEC_WPA2: return "WPA2";
    case WLAN_SEC_WPA3: return "WPA3";
    default: return "SECURE";
  }
}

int parseSecurity(String sec) {
  sec.trim();
  sec.toUpperCase();
  if (sec == "OPEN") return WLAN_SEC_UNSEC;
  if (sec == "WEP") return WLAN_SEC_WEP;
  if (sec == "WPA") return WLAN_SEC_WPA;
  if (sec == "WPA2") return WLAN_SEC_WPA2;
  if (sec == "WPA3") return WLAN_SEC_WPA3;
  return WLAN_SEC_WPA2; // Default
}