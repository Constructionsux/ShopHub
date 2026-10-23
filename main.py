from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os

# Initialize FastAPI
app = FastAPI(
    title="ShopHub E-Commerce API",
    description="A modern full-stack e-commerce platform",
    version="1.0.0"
)

# CORS Middleware (Useful when we add frontend frameworks later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define base directory (points to the root 'ecommerce_portfolio' folder)
BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files (CSS, JS, Images)
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend" / "static"), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory=BASE_DIR / "frontend" / "templates")

# --- ROUTES ---

@app.get("/", response_class=HTMLResponse)
async def serve_landing_page(request: Request):
    """Renders the main landing page"""
    return templates.TemplateResponse("index.html", {"request": request})



if __name__ == "__main__":
    import uvicorn
    # uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
