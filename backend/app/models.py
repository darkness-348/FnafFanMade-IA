from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class GameProgressResponse(BaseModel):
    current_night: int
    stars_unlocked: int
    total_nights_completed: int
    total_deaths: int

class ResetProgressResponse(BaseModel):
    status: str
    message: str

class StartNightRequest(BaseModel):
    night_number: int

class StartNightResponse(BaseModel):
    session_id: int
    night_number: int
    initial_power: float
    message: str

class PlayerTelemetry(BaseModel):
    left_door: bool
    right_door: bool
    right_vent: bool
    top_vent: bool = False
    flashlight: bool
    pan_x: float = Field(0.5, ge=0.0, le=1.0) # 0.0=all left, 1.0=all right
    looking_at_monitor: bool = False

class AIDecisionLog(BaseModel):
    id: Optional[int] = None
    action: str # "ATTACK_RIGHT_VENT", "ENTER_LEFT_DOOR", "ENTER_RIGHT_DOOR", "REQUIRE_FLASHLIGHT", "MOVE_SOUND"
    reason: str
    confidence: float
    player_state_snapshot: Dict[str, Any]
    outcome: str
    timestamp: Optional[str] = None

class AIAnalyticsResponse(BaseModel):
    action_frequencies: Dict[str, int]
    habit_metrics: Dict[str, Any]
    q_values: Dict[str, Dict[str, float]]
    recent_decisions: List[Dict[str, Any]]
    total_decisions: int
    success_rate: float

