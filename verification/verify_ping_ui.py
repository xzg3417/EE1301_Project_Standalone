from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1200, 'height': 800})
        page = context.new_page()

        # Load local index.html
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # 1. Verify PING TOOL Tab exists and WIFI CONFIG is gone
        print("Checking Tabs...")
        expect(page.locator("#tab-wifi")).to_have_text("PING TOOL")
        expect(page.get_by_role("button", name="WIFI CONFIG")).not_to_be_visible()

        # 2. Click PING TOOL Tab
        print("Switching to Ping Tool...")
        page.click("#tab-wifi")

        # 3. Verify Ping Tool UI Elements
        print("Verifying UI Elements...")
        expect(page.locator("#pingTarget")).to_be_visible()
        expect(page.locator("#pingTarget")).to_have_value("google.com")
        expect(page.locator("#pingCount")).to_be_visible()
        expect(page.locator("#pingCount")).to_have_value("5")
        expect(page.locator("#pingBtn")).to_be_visible()
        expect(page.locator("#pingBtn")).to_contain_text("START PING")

        # 4. Verify Text Selection in Log Console
        print("Verifying CSS...")
        log_console = page.locator("#logConsole")
        # Check computed style
        user_select = log_console.evaluate("el => window.getComputedStyle(el).userSelect")
        if user_select != 'text':
             # some browsers report 'auto' or 'text'.
             # Since we set it to 'text !important', it should be 'text'.
             # However, default might be 'auto' which allows selection.
             # But we want to ensure we added the class.
             print(f"Warning: user-select is {user_select}")

        import re
        expect(log_console).to_have_class(re.compile(r"select-text"))

        # 5. Take Screenshot of Ping Tool
        print("Taking Screenshot 1...")
        page.screenshot(path="verification/ping_tool_ui.png")

        # Enable connection mode to allow logging
        # isConnected is a global 'let', so it might not be on window.
        # But in a browser console, we can usually access it.
        # Let's try direct assignment in evaluate which executes in page context.
        page.evaluate("isConnected = true")

        # 6. Interact
        print("Interacting...")
        page.fill("#pingTarget", "8.8.8.8")
        page.fill("#pingCount", "3")
        page.click("#pingBtn")

        # 7. Check for log output (mocked execution)
        # Since 'sendCommand' is not mocked in the page context by default (serial is missing),
        # the 'log' function in startPing should still run before sendCommand fails.
        # "SYS: Initiating Ping..."
        print("Checking Logs...")
        expect(log_console).to_contain_text("Initiating Ping: 8.8.8.8 (3x)...")

        # 8. Take Screenshot after interaction
        print("Taking Screenshot 2...")
        page.screenshot(path="verification/ping_interaction.png")

        browser.close()

if __name__ == "__main__":
    run()
