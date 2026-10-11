"""Who is asking: the real client address, whether it is this PC, a short device name, and the
site's own address (for OAuth callbacks and same-site checks)."""

import ipaddress
import re
from urllib.parse import urlparse

from fastapi import Request


def client_ip(request: Request) -> str:
    """The real client: Vite's proxy and Cloudflare both append it as the last X-Forwarded-For entry."""
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[-1].strip() if forwarded else (request.client.host if request.client else "")


def is_local(request: Request) -> bool:
    """A request from this PC. Tunnel traffic also reaches us from localhost (cloudflared), so
    anything carrying Cloudflare's Cf-Connecting-IP header is remote, whatever its address."""
    if "cf-connecting-ip" in request.headers:
        return False
    try:
        return ipaddress.ip_address(client_ip(request).removeprefix("::ffff:")).is_loopback
    except ValueError:
        return False


def is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


def origin(request: Request) -> str:
    """This site as the browser sees it (the tunnel's domain, or the Vite address), from the Host header."""
    return f"{'https' if is_https(request) else 'http'}://{request.headers.get('host', request.url.netloc)}"


def same_site(request: Request) -> bool:
    """A state-changing request must come from a page of this site (blocks forged cross-site posts)."""
    sent = request.headers.get("origin")
    return bool(sent) and urlparse(sent).netloc == request.headers.get("host", request.url.netloc)


_OS = [("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"), ("Windows", "Windows"),
       ("Macintosh", "Mac"), ("Linux", "Linux")]
_BROWSER = [("Edg/", "Edge"), ("SamsungBrowser", "Samsung Internet"), ("Firefox/", "Firefox"),
            ("CriOS", "Chrome"), ("Chrome/", "Chrome"), ("Safari/", "Safari")]


def device(request: Request) -> str:
    """"Android · Chrome", from the User-Agent (for the access log only, never for decisions)."""
    ua = request.headers.get("user-agent", "")
    os_name = next((name for key, name in _OS if key in ua), "")
    browser = next((name for key, name in _BROWSER if key in ua), "")
    return " · ".join(x for x in (os_name, browser) if x) or re.sub(r"\s+", " ", ua)[:60] or "unknown"
