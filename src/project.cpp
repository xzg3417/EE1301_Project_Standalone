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
/**
 * @brief Enum representing the device's operational states.
 */
enum State {
    STATE_IDLE,     /**< Device is waiting for commands. */
    STATE_SCANNING, /**< Device is performing a full WiFi scan. */
    STATE_TRACKING  /**< Device is actively tracking a specific target SSID. */
};

State currentState = STATE_IDLE;

// Tracking Target Information
String targetSSID = "";
int targetChannel = 0;

WiFiAccessPoint aps[50];
unsigned long lastUpdate = 0;
unsigned long lastStatusReport = 0;

/**
 * @brief Initializes the device hardware and settings.
 *
 * Sets up the Serial communication at 115200 baud, selects the external antenna,
 * and sends an initial boot message.
 */
void setup() {
    Serial.begin(115200);
    WiFi.selectAntenna(ANT_EXTERNAL);
    delay(2000);
    sendLog("INFO", "System Booted. Radar Engine v10.");
}

/**
 * @brief Main execution loop of the firmware.
 *
 * This function handles serial command parsing, executes the state machine logic,
 * and manages periodic status reporting.
 */
void loop() {
    // 1. Process Serial Commands
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "SCAN") {
            sendLog("INFO", "Command: FULL SCAN");
            currentState = STATE_SCANNING;
        } else if (cmd.startsWith("TRACK:")) {
            int firstColon = cmd.indexOf(':');
            int lastColon = cmd.lastIndexOf(':');
            if (lastColon > firstColon) {
                targetSSID = cmd.substring(firstColon + 1, lastColon);
                targetChannel = cmd.substring(lastColon + 1).toInt();
                sendLog("INFO", "TARGET LOCKED: [" + targetSSID + "]");
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

/**
 * @brief Reports the current device status via Serial.
 *
 * Sends a CSV-formatted string containing connection status, SSID, IP address,
 * RSSI (normalized), Gateway IP, Subnet Mask, and MAC address.
 * Format: STATUS:DEVICE:CONNECTED,SSID,IP,RSSI,GW,MASK,MAC
 */
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

/**
 * @brief Sends a log message via Serial.
 *
 * Formats the message as "LOG:<level>:<msg>".
 *
 * @param level The severity level of the log (e.g., "INFO", "ERROR").
 * @param msg The log message content.
 */
void sendLog(String level, String msg) {
    Serial.print("LOG:");
    Serial.print(level);
    Serial.print(":");
    Serial.println(msg);
}

/**
 * @brief Performs a full WiFi spectrum scan.
 *
 * Scans for available WiFi networks and prints the results via Serial.
 * Each network is printed with the format: LIST:SSID,RSSI,CHANNEL,BSSID,SECURITY.
 * Sends "STATUS:SCAN_START" before starting and "STATUS:SCAN_END" after completion.
 */
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

/**
 * @brief Pings a target host a specified number of times.
 *
 * Sends ICMP ping requests to the target and logs the result.
 *
 * @param target The hostname or IP address to ping.
 * @param count The number of ping attempts (default is 5 if count <= 0).
 */
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

/**
 * @brief Tracks a specific WiFi network target.
 *
 * Performs a scan and filters for the target SSID. If found, sends the
 * strongest signal data via Serial.
 * Format: DATA:RSSI,CHANNEL,BSSID
 */
void performStableTracking() {
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

/**
 * @brief Converts a MAC address array to a string.
 *
 * @param mac A pointer to the 6-byte MAC address array.
 * @return A String representation of the MAC address (e.g., "00:11:22:33:44:55").
 */
String macToString(const uint8_t* mac) {
    char buf[20];
    snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1],
             mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

/**
 * @brief Converts a WiFi security integer to a string description.
 *
 * @param security The integer representing the security type.
 * @return A String describing the security type (e.g., "WPA2", "OPEN").
 */
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
