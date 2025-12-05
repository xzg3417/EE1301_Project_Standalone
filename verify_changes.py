import os
from playwright.sync_api import sync_playwright

def verify_ui(page):
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"
    page.goto(file_path)

    # Listen to console
    page.on("console", lambda msg: print(f"PAGE CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    print("Simulating Chart Data...")
    page.evaluate("""
        () => {
            window.liveChartData = new Array(150).fill(0).map((_, i) => -80 + Math.sin(i/10)*20);
            window.drawLiveChart();
        }
    """)
    page.wait_for_timeout(500)

    os.makedirs("/home/jules/verification", exist_ok=True)
    page.screenshot(path="/home/jules/verification/live_tab.png")
    print("Live tab screenshot saved.")

    print("Switching to Map Tab...")
    page.evaluate("switchTab('map')")
    # Force layout recalc?
    page.wait_for_timeout(500)

    print("Updating Table...")
    # Wrap in try-catch to debug
    page.evaluate("""
        () => {
            try {
                console.log("Setting mapData...");
                window.mapData = [{ id: 1, angle: 90, rssi: -50, rawSamples: [-50, -51] }];
                console.log("Calling updateTable...");
                window.updateTable();
                console.log("Table updated. Rows: " + document.querySelectorAll('#dataTableBody tr').length);
            } catch(e) {
                console.error("Error in evaluate: " + e.message);
            }
        }
    """)
    page.wait_for_timeout(500)

    page.screenshot(path="/home/jules/verification/map_tab_before_click.png")

    print("Clicking [+]...")
    # Check if button exists
    count = page.locator("#dataTableBody button").count()
    print(f"Buttons found: {count}")

    if count > 0:
        page.locator("#dataTableBody button").first.click()
        page.wait_for_timeout(500)
        page.screenshot(path="/home/jules/verification/map_tab_expanded.png")
        print("Map tab screenshot saved.")
    else:
        print("Button not found, skipping click.")

    print("Switching to Light Mode...")
    page.click("#themeBtn")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/light_mode.png")
    print("Light mode screenshot saved.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        try:
            verify_ui(page)
        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path="/home/jules/verification/error_state.png")
            except:
                pass
        finally:
            browser.close()
