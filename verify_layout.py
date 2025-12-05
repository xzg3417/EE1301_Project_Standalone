import os
from playwright.sync_api import sync_playwright

def snapshot(page):
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # 1. Simulate Long SSID
    long_ssid = "MyVeryLongSSIDThatShouldNotBeTruncated"
    page.evaluate(f"addNetwork('{long_ssid}', -55, 6, '00:11:22', 'WPA2/AES')")

    # 2. Simulate Status Update with Long SSID
    page.evaluate(f"updateDeviceStatus('STATUS:DEVICE:CONNECTED,{long_ssid},192.168.1.50,-40')")

    # 3. Take Screenshot of Live Tab
    page.wait_for_timeout(500)
    os.makedirs("/home/jules/verification", exist_ok=True)
    page.screenshot(path="/home/jules/verification/long_ssid_live.png")

    # 4. Take Screenshot of WiFi Tab
    page.click("#tab-wifi")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/long_ssid_wifi.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        snapshot(page)
        browser.close()
