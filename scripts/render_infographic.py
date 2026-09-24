"""Render docs/infographic.html to the repo PNG and the public JPEG."""
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "docs" / "infographic.html"
PNG = ROOT / "docs" / "infographic.png"
JPG = ROOT / "public" / "assets" / "infographic.jpg"
FONT = Path.home() / "spectradesk-web" / "public" / "fonts" / "fontshare"


def font_css() -> str:
    clash = FONT / "clash-display" / "woff2" / "ClashDisplay-Semibold.woff2"
    satoshi = FONT / "satoshi" / "woff2" / "Satoshi-Medium.woff2"
    if not clash.is_file() or not satoshi.is_file():
        return ""
    return (
        "@font-face{font-family:'Clash Display';src:url('"
        + clash.as_uri()
        + "') format('woff2');font-weight:600;font-display:block;}"
        "@font-face{font-family:'Satoshi';src:url('"
        + satoshi.as_uri()
        + "') format('woff2');font-weight:500;font-display:block;}"
    )


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": 1200, "height": 1080},
            device_scale_factor=2,
        )
        page.goto(HTML.as_uri(), wait_until="networkidle")
        css = font_css()
        if css:
            page.add_style_tag(content=css)
            page.evaluate("() => document.fonts.ready")
        page.locator(".canvas").screenshot(path=str(PNG), type="png")
        browser.close()
    image = Image.open(PNG).convert("RGB")
    image.thumbnail((1200, 1080), Image.Resampling.LANCZOS)
    JPG.parent.mkdir(parents=True, exist_ok=True)
    image.save(JPG, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"wrote {PNG} ({PNG.stat().st_size} bytes)")
    print(f"wrote {JPG} ({JPG.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
