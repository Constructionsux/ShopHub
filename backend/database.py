import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    # High-performance: Pre-warm pool with min_size, scale up to max_size
    pool = await asyncpg.create_pool(
        DATABASE_URL, 
        min_size=1, 
        max_size=5,
        command_timeout=60,
        ssl="require"
    )
    yield
    await pool.close()

async def get_db():
    global pool
    async with pool.acquire() as connection:
        yield connection
