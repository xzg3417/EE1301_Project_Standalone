import os
from playwright.sync_api import sync_playwright

def snapshot(page):
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # Populate some data
    page.evaluate("addNetwork('HomeWiFi', -55, 6, '00:11:22', 'WPA2')")
    page.evaluate("addNetwork('Guest', -80, 11, '00:33:44', 'OPEN')")

    # Go to WiFi Tab
    page.click("#tab-wifi")
    page.wait_for_timeout(500)

    # Select a network
    page.locator("#wifiList .list-item").first.click()
    page.fill("#wifiPassInput", "SuperSecret")

    # Take screenshot
    os.makedirs("/home/jules/verification", exist_ok=True)
    page.screenshot(path="/home/jules/verification/wifi_tab_final.png")
    print("Screenshot saved.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        snapshot(page)
        browser.close()
