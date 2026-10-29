import random
from typing import Dict, Any, Optional
from .base import BaseAnimatronic

class SpecialAudioAnimatronic(BaseAnimatronic):
    """
    Special Invisible Animatronic:
    - Cannot be seen on camera or office (true shadow/invisible stalker).
    - Communicates and moves purely via audio cues: 'audio01.wav'.
    - When it moves, it picks a directional vector (left/center/right).
    - Opens a high-stakes reaction window where the player must respond appropriately:
        * Left audio  -> Pan left and/or toggle left defense / flash
        * Right audio -> Pan right and/or toggle right defense / vent
        * Center audio -> Flashlight in center
    - Failure to react before the deadline results in a fatal jumpscare!
    """
    def __init__(self, ai_level: int = 10):
        super().__init__(name="Shadow Acoustic Stalker", ai_level=ai_level, movement_interval=6.0)
        self.is_visible_in_office = False
        self.current_sound_direction = "center" # "left", "center", "right"
        self.reaction_time_allowed = 4.0 # seconds to react
        self.time_in_attack = 0.0

    def update(self, dt: float, game_state: Any) -> Optional[Dict[str, Any]]:
        if self.ai_level <= 0 or getattr(game_state, "night_number", 1) == 0:
            return None

        # Check ongoing reaction window
        if self.active_reaction_window:
            self.time_in_attack += dt
            if self.time_in_attack >= self.reaction_deadline:
                # Time expired!
                self.active_reaction_window = False
                if getattr(game_state, "night_number", 1) == 0:
                    return {
                        "type": "TEST_MODE_EVENT",
                        "sound": "breathing.wav",
                        "message": "[Modo Prueba] Ataque acústico finalizado sin daño."
                    }
                return {
                    "type": "JUMPSCARE",
                    "killer": self.name,
                    "cause": f"No reaccionaste a tiempo al sonido '{self.current_sound_direction}'",
                    "sound": "jumpscareb.wav"
                }
            return None

        # Movement interval countdown (fair breathing room)
        self.time_since_last_move += dt
        adjusted_interval = max(7.0, 22.0 - (self.ai_level * 0.7))
        
        if self.time_since_last_move >= adjusted_interval:
            self.time_since_last_move = 0.0
            
            # Roll standard FNAF D20 check: random(1, 20) <= ai_level
            roll = random.randint(1, 20)
            if roll <= self.ai_level:
                # Triggers special audio movement!
                self.current_sound_direction = random.choice(["left", "center", "right"])
                self.active_reaction_window = True
                self.time_in_attack = 0.0
                
                # Reaction window: generous on low AI, tighter on high AI
                self.reaction_deadline = max(3.0, 6.0 - (self.ai_level * 0.15))
                
                # Pan values for stereo Web Audio API
                stereo_pan = -0.85 if self.current_sound_direction == "left" else (0.85 if self.current_sound_direction == "right" else 0.0)
                
                return {
                    "type": "SPECIAL_AUDIO_MOVE",
                    "animatronic": self.name,
                    "sound": "audio01.wav",
                    "direction": self.current_sound_direction,
                    "stereo_pan": stereo_pan,
                    "deadline_seconds": self.reaction_deadline,
                    "message": f"¡Alerta acústica ({self.current_sound_direction})! Reacciona de inmediato."
                }
        return None

    def on_player_reaction(self, reaction_type: str, game_state: Any) -> bool:
        """
        Validates if the player's action counteracted the acoustic threat:
        """
        if not self.active_reaction_window:
            return False

        # Current player telemetry from game_state
        pan_x = getattr(game_state, "pan_x", 0.5)
        flashlight = getattr(game_state, "flashlight", False)
        left_door = getattr(game_state, "left_door", False)
        right_door = getattr(game_state, "right_door", False)
        right_vent = getattr(game_state, "right_vent", False)
        top_vent = getattr(game_state, "top_vent", False)

        success = False
        # Si cerró ambas puertas principales, siempre se bloquea
        if left_door and right_door:
            success = True
        elif self.current_sound_direction == "left":
            # Left attack blocked by left door OR by panning left + flashlight
            if left_door or (pan_x < 0.35 and flashlight):
                success = True
        elif self.current_sound_direction == "right":
            # Right attack blocked by right door OR right vent OR panning right + flashlight
            if right_door or right_vent or (pan_x > 0.65 and flashlight):
                success = True
        elif self.current_sound_direction == "center":
            # Center attack blocked by shining flashlight OR top vent
            if flashlight or top_vent:
                success = True

        if success:
            self.active_reaction_window = False
            self.time_in_attack = 0.0
            return True
            
        return False

