#include "Particle.h"

// --- Function Declarations ---
void performFullScan();
void performStableTracking();
void performPing(String target, int count);
void sendLog(String level, String msg);
void reportDeviceStatus();
String macToString(const uint8_t* mac);
String securityToString(int security);

// State Definitions
enum State { STATE_IDLE, STATE_SCANNING, STATE_TRACKING };

State currentState = STATE_IDLE;

// Tracking Target Information
String targetSSID = "";
int targetChannel = 0;
int trackingMode = 0; // 0=Precise(Scan), 1=Fast(Connected)

WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;
unsigned long lastStatusReport = 0;

// Button Logic
const int BUTTON_PIN = D3;
bool buttonPressed = false;
unsigned long lastButtonPress = 0;

void setup() {
    Serial.begin(115200);
    WiFi.selectAntenna(ANT_EXTERNAL);
    pinMode(BUTTON_PIN, INPUT_PULLDOWN);
    delay(2000);
    sendLog("INFO", "System Booted. Radar Engine v10.");
}

void loop() {
    // 0. Button Logic
    if (digitalRead(BUTTON_PIN) == HIGH) {
        if (!buttonPressed && (millis() - lastButtonPress > 200)) {
            buttonPressed = true;
            Serial.println("EVENT:BUTTON_PRESSED");
            lastButtonPress = millis();
        }
    } else {
        buttonPressed = false;
    }

    // 1. Process Serial Commands
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "SCAN") {
            sendLog("INFO", "Command: FULL SCAN");
            currentState = STATE_SCANNING;
        } else if (cmd.startsWith("TRACK:")) {
            // TRACK:SSID:CH:MODE
            // We need to parse manually carefully.
            int firstColon = cmd.indexOf(':');
            int secondColon = cmd.indexOf(':', firstColon + 1);
            int thirdColon = cmd.indexOf(':', secondColon + 1);

            if (secondColon > firstColon) {
                targetSSID = cmd.substring(firstColon + 1, secondColon);

                if (thirdColon > secondColon) {
                    // We have 3 colons: TRACK:SSID:CH:MODE
                    targetChannel = cmd.substring(secondColon + 1, thirdColon).toInt();
                    trackingMode = cmd.substring(thirdColon + 1).toInt();
                } else {
                    // We have 2 colons: TRACK:SSID:CH
                    targetChannel = cmd.substring(secondColon + 1).toInt();
                    trackingMode = 0; // Default to precise
                }

                sendLog("INFO", "TARGET LOCKED: [" + targetSSID + "] Mode=" + String(trackingMode));
                currentState = STATE_TRACKING;
            }
        } else if (cmd == "GET_STATUS") {
            reportDeviceStatus();
        } else if (cmd == "STOP") {
            sendLog("INFO", "Command: STOP");
            currentState = STATE_IDLE;
        } else if (cmd.startsWith("PING:")) {
            // PING:target:count
            int first = cmd.indexOf(':');
            int last = cmd.lastIndexOf(':');
            if (last > first) {
                String target = cmd.substring(first + 1, last);
                int count = cmd.substring(last + 1).toInt();
                performPing(target, count);
            } else {
                sendLog("ERROR", "Invalid PING format");
            }
        }
    }

    // 2. State Machine Logic
    switch (currentState) {
    case STATE_SCANNING:
        performFullScan();
        currentState = STATE_IDLE;
        break;

    case STATE_TRACKING:
        // Maintain minimum 1ms interval, acquire data as fast as possible
        if (millis() - lastUpdate > 1) {
            performStableTracking();
            lastUpdate = millis();
        }
        break;

    case STATE_IDLE:
        break;
    }

    // 3. Report Device Status Periodically (Every 3 seconds)
    if (millis() - lastStatusReport > 3000) {
        reportDeviceStatus();
        lastStatusReport = millis();
    }
}

// Report device status (comma separated to avoid MAC address conflicts)
void reportDeviceStatus() {
    if (WiFi.ready()) {
        Serial.print("STATUS:DEVICE:CONNECTED,");
        Serial.print(WiFi.SSID());
        Serial.print(",");
        Serial.print(WiFi.localIP());
        Serial.print(",");

        // RSSI estimation conversion (0-100% -> -90dBm to -30dBm)
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
    Serial.print("LOG:");
    Serial.print(level);
    Serial.print(":");
    Serial.println(msg);
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
        // Protocol: LIST:SSID,RSSI,CHANNEL,BSSID,SECURITY
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
    if (count <= 0)
        count = 5;
    sendLog("INFO",
            "Pinging " + target + " with " + String(count) + " attempts...");

    int success = 0;
    for (int i = 0; i < count; i++) {
        unsigned long start = millis();
        // nTries=1. Returns number of successful packets (1 or 0) or error (<0)
        int result = WiFi.ping(target, 1);
        unsigned long duration = millis() - start;

        if (result > 0) {
            success++;
            Serial.println("LOG:RAW:Reply from " + target +
                           ": time=" + String(duration) + "ms");
        } else {
            Serial.println("LOG:RAW:Request timed out.");
        }
        // Small delay between pings
        if (i < count - 1)
            delay(1000);
    }

    sendLog("INFO", "Ping statistics: Sent=" + String(count) + ", Received=" +
                        String(success) + ", Lost=" + String(count - success));
}

void performStableTracking() {
    // Optimization: If mode is FAST (1) AND connected to target, use instant RSSI
    if (trackingMode == 1 && WiFi.ready() && String(WiFi.SSID()) == targetSSID) {
        int rssi = (int8_t)WiFi.RSSI();

        uint8_t bssid[6];
        WiFi.BSSID(bssid);
        String bssidStr = macToString(bssid);

        // DATA:RSSI,CHANNEL,BSSID
        Serial.print("DATA:");
        Serial.print(rssi);
        Serial.print(",");
        Serial.print(targetChannel);
        Serial.print(",");
        Serial.println(bssidStr);
        return;
    }

    // Core Tracking Logic: Full Channel Scan
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
        // Not found (signal might be too weak or beacon frame lost)
        // Continue sending heartbeat for frontend to judge connection status
        Serial.println("DATA:-120,0,SCANNING...");
    }
}

String macToString(const uint8_t* mac) {
    char buf[20];
    snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1],
             mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

String securityToString(int security) {
    switch (security) {
    case WLAN_SEC_UNSEC:
        return "OPEN";
    case WLAN_SEC_WEP:
        return "WEP";
    case WLAN_SEC_WPA:
        return "WPA";
    case WLAN_SEC_WPA2:
        return "WPA2";
    case WLAN_SEC_WPA3:
        return "WPA3";
    default:
        return "SECURE";
    }
}
