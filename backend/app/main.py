import os
import asyncio
import json
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import (
    init_db, get_game_progress, reset_game_progress,
    get_recent_decisions, get_nights_history
)
from .ai_brain import AIBrain
from .animatronics.registry import AnimatronicRegistry
from .game_state import GameManager
from .models import (
    GameProgressResponse, ResetProgressResponse, StartNightRequest,
    StartNightResponse, AIAnalyticsResponse
)

# Root directory of the UCN project
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEXTURES_DIR = BASE_DIR / "Textures"
AUDIO_DIR = BASE_DIR / "Audio"

# Core singletons
ai_brain = AIBrain()
registry = AnimatronicRegistry()
game_manager = GameManager(ai_brain, registry)

# Active WebSocket connections
connected_clients: list[WebSocket] = []

async def game_tick_loop():
    """
    High-frequency game tick loop (runs at 10 Hz = 0.1s dt).
    Calculates power drain, animatronics, AI reactions, and pushes to client.
    """
    dt = 0.1
    while True:
        try:
            if game_manager.is_active:
                events = game_manager.tick(dt)
                snapshot = game_manager.get_snapshot()
                
                # Broadcast payload to connected clients
                message = json.dumps({
                    "type": "GAME_TICK",
                    "state": snapshot,
                    "events": events
                })
                
                dead_clients = []
                for client in connected_clients:
                    try:
                        await client.send_text(message)
                    except Exception:
                        dead_clients.append(client)
                        
                for dead in dead_clients:
                    if dead in connected_clients:
                        connected_clients.remove(dead)
        except Exception as e:
            print(f"[Game Loop Error] {e}")
            
        await asyncio.sleep(dt)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and background tick task
    init_db()
    tick_task = asyncio.create_task(game_tick_loop())
    yield
    # Shutdown
    tick_task.cancel()

app = FastAPI(
    title="UCN Fanmade - AI Learning Experience",
    description="FNAF/UCN Fanmade backend with Adaptive Reinforcement Learning AI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files mounts
if TEXTURES_DIR.exists():
    app.mount("/assets/textures", StaticFiles(directory=str(TEXTURES_DIR)), name="textures")

if AUDIO_DIR.exists():
    app.mount("/assets/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

# Mount root directory for specific root images like 62eemvldff341.jpg
app.mount("/assets/root", StaticFiles(directory=str(BASE_DIR)), name="root")

# --- REST Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "UCN Fanmade AI Backend"}

@app.get("/api/game/progress", response_model=GameProgressResponse)
async def get_progress():
    progress = get_game_progress()
    return GameProgressResponse(**progress)

@app.post("/api/game/reset", response_model=ResetProgressResponse)
async def reset_progress():
    reset_game_progress()
    # Also reset in-memory brain
    ai_brain.q_table.clear()
    ai_brain.action_counts = {a: 0 for a in ai_brain.actions}
    ai_brain.action_successes = {a: 0 for a in ai_brain.actions}
    ai_brain.session_ticks = 0
    return ResetProgressResponse(status="success", message="Progreso y memoria de la IA restablecidos a cero.")

@app.post("/api/game/start-night", response_model=StartNightResponse)
async def start_night(req: StartNightRequest):
    session_id = game_manager.start_night(req.night_number)
    return StartNightResponse(
        session_id=session_id,
        night_number=req.night_number,
        initial_power=100.0,
        message=f"Noche {req.night_number} iniciada con éxito."
    )

@app.get("/api/ai/analytics")
async def get_ai_analytics():
    return ai_brain.get_analytics()

@app.get("/api/ai/decisions")
async def get_decisions(limit: int = 50):
    return get_recent_decisions(limit=limit)

@app.get("/api/nights")
async def get_nights(limit: int = 30):
    return get_nights_history(limit=limit)

# --- Real-Time WebSocket Endpoint ---

@app.websocket("/ws/game")
async def websocket_game(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send initial state immediately
        await websocket.send_text(json.dumps({
            "type": "INITIAL_STATE",
            "state": game_manager.get_snapshot()
        }))
        
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)
            msg_type = data.get("type")
            
            if msg_type == "TELEMETRY":
                telemetry = data.get("telemetry", {})
                game_manager.update_telemetry(telemetry)
            elif msg_type == "REACTION":
                action_name = data.get("action")
                # Immediate player reaction trigger
                special = registry.get("Shadow Acoustic Stalker")
                if special:
                    special.on_player_reaction(action_name, game_manager)
            elif msg_type == "CONTROLLED_SHOCK":
                res = game_manager.trigger_controlled_shock()
                if res:
                    await websocket.send_text(json.dumps({
                        "type": "SHOCK_EVENT",
                        "event": res
                    }))
            elif msg_type == "DEFUSE_BONNET":
                res = game_manager.defuse_bonnet()
                if res:
                    await websocket.send_text(json.dumps({
                        "type": "GAME_EVENT",
                        "event": res
                    }))
            elif msg_type == "DEFUSE_LOLBIT":
                res = game_manager.defuse_lolbit()
                if res:
                    await websocket.send_text(json.dumps({
                        "type": "GAME_EVENT",
                        "event": res
                    }))
            elif msg_type == "START_NIGHT":
                night = data.get("night", 1)
                game_manager.start_night(night)
            elif msg_type == "PING":
                await websocket.send_text(json.dumps({"type": "PONG"}))
                
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)

