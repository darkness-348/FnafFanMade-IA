import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "game_data.db")

def get_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Game progress table (Saved night, stars, stats)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS game_progress (
        id INTEGER PRIMARY KEY,
        current_night INTEGER DEFAULT 1,
        stars_unlocked INTEGER DEFAULT 0,
        total_nights_completed INTEGER DEFAULT 0,
        total_deaths INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Insert default progress if not exists
    cursor.execute("SELECT COUNT(*) FROM game_progress")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO game_progress (id, current_night, stars_unlocked) VALUES (1, 1, 0)")
        
    # 2. Night sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS night_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        night_number INTEGER NOT NULL,
        status TEXT NOT NULL, -- 'won', 'jumpscare', 'in_progress', 'aborted'
        cause_of_death TEXT,
        seconds_survived REAL DEFAULT 0,
        power_left REAL DEFAULT 100.0,
        ai_decisions_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 3. AI Decisions table (Full audit log for the backend analytics interface)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        night_session_id INTEGER,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        player_state_snapshot TEXT, -- JSON snapshot of doors, pan, habits
        outcome TEXT DEFAULT 'PENDING', -- 'SUCCESS', 'BLOCKED', 'IGNORED', 'EXPIRED'
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(night_session_id) REFERENCES night_sessions(id)
    )
    """)
    
    # 4. Player habit memory table (Persistent AI knowledge base)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_knowledge_base (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    conn.commit()
    conn.close()

# Ensure database tables exist automatically on startup
init_db()

# Helper queries
def get_game_progress() -> Dict[str, Any]:
    conn = get_db()
    row = conn.execute("SELECT * FROM game_progress WHERE id = 1").fetchone()
    conn.close()
    if row:
        return dict(row)
    return {"current_night": 1, "stars_unlocked": 0, "total_nights_completed": 0, "total_deaths": 0}

def save_game_progress(current_night: int, stars_unlocked: int, won: bool = False, died: bool = False):
    conn = get_db()
    if won:
        conn.execute("""
            UPDATE game_progress 
            SET current_night = ?, 
                stars_unlocked = MAX(stars_unlocked, ?),
                total_nights_completed = total_nights_completed + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """, (current_night, stars_unlocked))
    elif died:
        conn.execute("""
            UPDATE game_progress 
            SET total_deaths = total_deaths + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """)
    else:
        conn.execute("""
            UPDATE game_progress 
            SET current_night = ?, 
                stars_unlocked = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        """, (current_night, stars_unlocked))
    conn.commit()
    conn.close()

def reset_game_progress():
    conn = get_db()
    conn.execute("""
        UPDATE game_progress 
        SET current_night = 1, 
            stars_unlocked = 0,
            total_nights_completed = 0,
            total_deaths = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """)
    # Also reset ai knowledge base for a fresh run
    conn.execute("DELETE FROM ai_knowledge_base")
    conn.commit()
    conn.close()

def create_night_session(night_number: int) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO night_sessions (night_number, status) VALUES (?, 'in_progress')", (night_number,))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id

def finish_night_session(session_id: int, status: str, cause_of_death: Optional[str], seconds_survived: float, power_left: float, decisions_count: int):
    conn = get_db()
    conn.execute("""
        UPDATE night_sessions 
        SET status = ?,
            cause_of_death = ?,
            seconds_survived = ?,
            power_left = ?,
            ai_decisions_count = ?,
            created_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (status, cause_of_death, seconds_survived, power_left, decisions_count, session_id))
    conn.commit()
    conn.close()

def log_ai_decision(session_id: Optional[int], action: str, reason: str, confidence: float, player_snapshot: Dict[str, Any], outcome: str = 'PENDING') -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO ai_decisions (night_session_id, action, reason, confidence, player_state_snapshot, outcome)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (session_id, action, reason, confidence, json.dumps(player_snapshot), outcome))
    decision_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return decision_id

def update_decision_outcome(decision_id: int, outcome: str):
    conn = get_db()
    conn.execute("UPDATE ai_decisions SET outcome = ? WHERE id = ?", (outcome, decision_id))
    conn.commit()
    conn.close()

def get_recent_decisions(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("""
        SELECT d.*, n.night_number 
        FROM ai_decisions d
        LEFT JOIN night_sessions n ON d.night_session_id = n.id
        ORDER BY d.id DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        if item.get("player_state_snapshot"):
            try:
                item["player_state_snapshot"] = json.loads(item["player_state_snapshot"])
            except Exception:
                pass
        result.append(item)
    return result

def get_nights_history(limit: int = 30) -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM night_sessions ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_ai_memory() -> Dict[str, Any]:
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM ai_knowledge_base").fetchall()
    conn.close()
    memory = {}
    for r in rows:
        try:
            memory[r["key"]] = json.loads(r["value"])
        except Exception:
            memory[r["key"]] = r["value"]
    return memory

def save_ai_memory_key(key: str, value: Any):
    conn = get_db()
    conn.execute("""
        INSERT INTO ai_knowledge_base (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    """, (key, json.dumps(value)))
    conn.commit()
    conn.close()
