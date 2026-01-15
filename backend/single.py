from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
import time   
from bs4 import BeautifulSoup
import sys



def productdetail(link):
    time.sleep(2)  # wait for the page to load
    # get content = page.content()
    with sync_playwright() as p:
        browser = p.chromium.launch(
        headless=False,   # Cloudflare hates headless. Keep it visible.
        args=[
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox"
        ]
        )

        context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1200, "height": 800},
        java_script_enabled=True,
        locale="en-US",
        timezone_id="Asia/Kathmandu"
        )

        page = context.new_page()

        # Apply stealth
        stealth = Stealth()
        stealth.apply_stealth_sync(page)
        page.goto(link)
        content = page.content()
         # click cookie 
        # <button id="onetrust-accept-btn-handler">Accept All Cookies</button>
        page.get_by_role("button", name="Accept All Cookies").click()
        # save html to content.html

        soup = BeautifulSoup(content, "html.parser")
        # space-y-space-400 md:space-y-space-500 lg:space-y-space-600 flex w-full flex-col items-start self-stretch lg:w-[26rem] lg:flex-shrink-0
        desc_div = soup.find("div", class_="space-y-space-400 md:space-y-space-500 lg:space-y-space-600 flex w-full flex-col items-start self-stretch lg:w-[26rem] lg:flex-shrink-0")
        if desc_div:
            rrp = desc_div.find("h2" , class_="display-l text-colour-title-light").text.strip()
            print(rrp)

                    

def main():
#    get url from input 
    url = sys.argv[1]
    productdetail(url)
   
if __name__ == "__main__":
    main()