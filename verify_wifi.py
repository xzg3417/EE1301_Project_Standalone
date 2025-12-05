import os
from playwright.sync_api import sync_playwright

def verify_ui(page):
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # 1. Verify Text Selection (Check body class)
    print("Verifying Text Selection...")
    body_class = page.locator("body").get_attribute("class")
    if "select-none" in body_class:
        print("FAIL: select-none is still present in body class.")
    else:
        print("PASS: select-none removed.")

    # 2. Verify Status Parser Logic
    print("Verifying Status Parser...")
    page.evaluate("updateDeviceStatus('STATUS:DEVICE:CONNECTED,MyWiFi,192.168.1.100,-50,1.1.1.1,255.255.0.0,AA:BB')")
    page.wait_for_timeout(100)
    ssid = page.locator("#miniSSID").inner_text()
    ip = page.locator("#miniIP").inner_text()
    print(f"Status SSID: {ssid}, IP: {ip}")
    if ssid == "MyWiFi" and ip == "192.168.1.100":
        print("PASS: Status Parser working correctly.")
    else:
        print(f"FAIL: Status Parser failed. Got {ssid}, {ip}")

    # 3. Verify WiFi Config Tab
    print("Verifying WiFi Tab...")
    page.click("#tab-wifi")
    page.wait_for_timeout(500)

    # Simulate Scan Results
    print("Simulating Network List...")
    page.evaluate("addNetwork('TestNet', -60, 6, '00:11:22', 'WPA2')")
    page.wait_for_timeout(100)

    page.locator("#wifiList .list-item").first.click()
    sel_ssid = page.locator("#wifiSelectedSSID").inner_text()
    print(f"Selected SSID: {sel_ssid}")

    page.fill("#wifiPassInput", "password123")

    # Mock sendCommand - Ensure it overrides correctly
    page.evaluate("""
        window.isConnected = true;
        window.mockCmds = [];
        // Override global sendCommand
        window.sendCommand = async function(c) {
            console.log("MOCK CMD: " + c);
            window.mockCmds.push(c);
            return Promise.resolve();
        };
    """)
    page.wait_for_timeout(100)

    print("Clicking Connect...")
    page.on("dialog", lambda dialog: dialog.accept())

    # Debug console
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    page.click("#wifiConnectBtn")
    page.wait_for_timeout(1000) # Increased wait

    cmds = page.evaluate("window.mockCmds")
    print(f"Sent Commands: {cmds}")

    if "SET_SSID:TestNet" in cmds and "SET_PASS:password123" in cmds and "DO_CONNECT" in cmds:
         print("PASS: Connect sequence correct.")
    else:
         print("FAIL: Connect sequence incorrect.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_ui(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
