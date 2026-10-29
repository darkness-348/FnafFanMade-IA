from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseAnimatronic(ABC):
    """
    Standard Base Class for all FNAF/UCN Animatronics:
    Allows easily adding 50+ animatronics later with custom mechanics,
    difficulty AI levels (0-20), audio triggers, and attack pathways.
    """
    def __init__(self, name: str, ai_level: int = 10, movement_interval: float = 5.0):
        self.name = name
        self.ai_level = ai_level # 0-20
        self.movement_interval = movement_interval # Seconds between movement opportunities
        self.state = "DORMANT" # DORMANT, STALKING, ATTACKING, REPELLED
        self.location = "UNKNOWN"
        self.time_since_last_move = 0.0
        self.is_visible_in_office = False
        self.active_reaction_window = False
        self.reaction_deadline = 0.0

    def set_ai_level(self, level: int):
        self.ai_level = max(0, min(20, level))

    @abstractmethod
    def update(self, dt: float, game_state: Any) -> Optional[Dict[str, Any]]:
        """
        Called every tick (dt in seconds).
        Returns an event dict if an action occurred (e.g. movement, sound cue, attack).
        """
        pass

    @abstractmethod
    def on_player_reaction(self, reaction_type: str, game_state: Any) -> bool:
        """
        Handles player reaction (e.g., flashed light, closed door).
        Returns True if the animatronic was successfully blocked/repelled.
        """
        pass

    def reset(self):
        self.state = "DORMANT"
        self.time_since_last_move = 0.0
        self.active_reaction_window = False
        self.reaction_deadline = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "ai_level": self.ai_level,
            "state": self.state,
            "location": self.location,
            "is_visible_in_office": self.is_visible_in_office,
            "active_reaction_window": self.active_reaction_window,
        }

