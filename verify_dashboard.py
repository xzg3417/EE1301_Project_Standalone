from playwright.sync_api import sync_playwright

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PageError: {err}"))
        try:
            # Navigate to dashboard
            page.goto("http://localhost:5173/dashboard")

            # Wait for key elements to ensure render
            page.wait_for_selector("text=Overview Information")
            page.wait_for_selector("text=Signal Strength")
            page.wait_for_selector("text=Networks Found")
            page.wait_for_selector("text=Signal Quality")

            # Allow time for charts to render animation
            page.wait_for_timeout(2000)

            # Take screenshot
            page.screenshot(path="dashboard_verification.png")
            print("Screenshot saved to dashboard_verification.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="dashboard_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_dashboard()
