import os

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import sources

app = FastAPI(title="Reval Scraper")

SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9",
}


class ExtractRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"status": "ok", "sources": sources.SUPPORTED_SOURCES}


@app.post("/extract")
async def extract(body: ExtractRequest, authorization: str = Header(default="")):
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(401, "Unauthorized")

    url = body.url.strip()
    async with httpx.AsyncClient(headers=_BROWSER_HEADERS, follow_redirects=True, timeout=20) as client:
        return await sources.extract(url, client)
