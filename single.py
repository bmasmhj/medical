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
        time.sleep(2)  # Wait for page to load
        
        # Click cookie button first
        try:
            try:
                page.get_by_role("button", name="Accept All Cookies").click(timeout=0)
            except:
                try:
                    page.get_by_role("button", name="Close").click(timeout=0)
                except:
                    pass

        except Exception as e:
            print(f"Cookie button not found or already accepted: {e}")
        
        # Get initial content
        content = page.content()
        soup = BeautifulSoup(content, "html.parser")
        
        # space-y-space-400 md:space-y-space-500 lg:space-y-space-600 flex w-full flex-col items-start self-stretch lg:w-[26rem] lg:flex-shrink-0
        desc_div = soup.find("div", class_="space-y-space-400 md:space-y-space-500 lg:space-y-space-600 flex w-full flex-col items-start self-stretch lg:w-[26rem] lg:flex-shrink-0")
        
        # Click eligibility dropdown - use .first() to select the combobox button (not the listbox menu)
        try:
            # page.get by class
            locator = page.locator(
                ".rounded-b-shape-button-input.ring-1.px-space-400.text-colour-body-light."
                "rounded-t-shape-button-input.flex.h-\\[60px\\].items-center."
                "justify-between.border-0.ring-inset.ring-offset-0."
                "ring-neutral-300.bg-white"
            )

            locator.wait_for(state="visible", timeout=2000)
            locator.click()
            #
            #  Get updated content after clicking
            content = page.content()
            soup = BeautifulSoup(content, "html.parser")
            ul_elibility = soup.find("ul", class_="h-max max-h-[316px] overflow-y-auto bg-white p-0")
            
            if ul_elibility:
                # Get all li text
                li_elibility = ul_elibility.find_all("li", class_="p-space-400 flex flex-col aria-disabled:text-gray-500")
                for li in li_elibility:
                    if li.text.strip() == "No Medicare card":
                       page.get_by_role("option", name="No Medicare card").click()
                       time.sleep(1)
                       content = page.content()
                       soup = BeautifulSoup(content, "html.parser")
                       desc_div = soup.find("div", class_="space-y-space-400 md:space-y-space-500 lg:space-y-space-600 flex w-full flex-col items-start self-stretch lg:w-[26rem] lg:flex-shrink-0")
                       if desc_div:
                            rrp = desc_div.find("h2" , class_="display-l text-colour-title-light").text.strip()
                            print(rrp)

            else:
                if desc_div:
                    rrp = desc_div.find("h2" , class_="display-l text-colour-title-light").text.strip()
                    print(rrp)
        except Exception as e:
            if desc_div:
                rrp = desc_div.find("h2" , class_="display-l text-colour-title-light").text.strip()
                print(rrp)
                browser.close()
                return
            else :
                print("0")
                browser.close()
                return
        browser.close()

       

def main():
#    get url from input 
    url = sys.argv[1]
    productdetail(url)
   
if __name__ == "__main__":
    main()