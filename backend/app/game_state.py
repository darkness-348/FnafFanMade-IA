import asyncio
import time
from typing import Dict, Any, Optional, List
from .ai_brain import AIBrain
from .animatronics.registry import AnimatronicRegistry
from .database import (
    create_night_session, finish_night_session, log_ai_decision,
    update_decision_outcome, save_game_progress, get_game_progress
)

class ActiveAttack:
    def __init__(self, action: str, decision_id: int, deadline: float, sound_cue: str, direction: str = "center"):
        self.action = action
        self.decision_id = decision_id
        self.deadline = deadline # time remaining in seconds
        self.sound_cue = sound_cue
        self.direction = direction

class GameManager:
    """
    Central Game State & Loop Coordinator:
    Runs the live 12 AM - 6 AM night simulation, manages power,
    dispatches AI actions, coordinates animatronics, and tracks win/loss.
    """
    def __init__(self, ai_brain: AIBrain, registry: AnimatronicRegistry):
        self.ai_brain = ai_brain
        self.registry = registry
        
        # State
        self.session_id: Optional[int] = None
        self.night_number: int = 1
        self.is_active: bool = False
        self.is_game_over: bool = False
        self.is_victory: bool = False
        self.game_over_reason: Optional[str] = None
        
        # FNAF Clock: 12 AM to 6 AM (6 hours total, 45 seconds per hour = 270 seconds full night)
        self.SECONDS_PER_HOUR = 45.0
        self.seconds_elapsed = 0.0
        self.current_hour = 12 # 12, 1, 2, 3, 4, 5, 6
        
        # Power & Environment
        self.power = 100.0
        self.base_drain_rate = 0.08 # % per second
        self.left_door = False
        self.right_door = False
        self.right_vent = False
        self.top_vent = False
        self.flashlight = False
        self.pan_x = 0.5
        self.looking_at_monitor = False
        
        # Controlled Shock (Taser)
        self.last_shock_time = -30.0
        self.shock_cooldown = 30.0
        self.ai_stun_timer = 0.0

        # Active threat / attacks
        self.active_attacks: List[ActiveAttack] = []
        self.pending_events: List[Dict[str, Any]] = []
        self.ai_decision_timer = 0.0
        self.ai_decision_interval = 22.0 # Generous interval on Night 1!
        self.total_decisions_this_night = 0

        # Impostor AI Cam Shifter State
        self.impostor_cam: int = 1 # CAM 1, 2, 3, 4
        self.impostor_form: str = "761.png"
        self.impostor_move_timer: float = 0.0
        self.impostor_peeking_center_vent: bool = False
        self.center_vent_peek_timer: float = 0.0

    def start_night(self, night_number: int) -> int:
        self.night_number = night_number
        self.session_id = create_night_session(night_number)
        self.is_active = True
        self.is_game_over = False
        self.is_victory = False
        self.game_over_reason = None
        self.seconds_elapsed = 0.0
        self.current_hour = 12
        self.power = 100.0
        self.left_door = False
        self.right_door = False
        self.right_vent = False
        self.top_vent = False
        self.flashlight = False
        self.pan_x = 0.5
        self.active_attacks = []
        self.ai_decision_timer = 0.0
        self.total_decisions_this_night = 0
        self.last_shock_time = -30.0
        self.ai_stun_timer = 0.0

        # Reset Impostor AI State
        self.impostor_cam = 1
        self.impostor_form = "761.png"
        self.impostor_move_timer = 0.0
        self.impostor_peeking_center_vent = False
        self.center_vent_peek_timer = 0.0

        if night_number == 0:
            # Modo Prueba: Presente pero inofensivo (sin muertes)
            self.base_drain_rate = 0.0
            self.ai_decision_interval = 20.0 # Se manifiesta cada 20s para que lo veas
        else:
            self.base_drain_rate = 0.07
            self.ai_decision_interval = max(6.0, 24.0 - (night_number * 3.5))
        
        # Set animatronic registry difficulty
        self.registry.reset_all()
        if night_number == 0:
            for anim in self.registry.get_all():
                anim.set_ai_level(8) # Activo para escuchar y probar, pero inofensivo
        else:
            self.registry.set_night_difficulty(night_number)
        
        return self.session_id

    def update_telemetry(self, telemetry: Dict[str, Any]):
        self.left_door = telemetry.get("left_door", self.left_door)
        self.right_door = telemetry.get("right_door", self.right_door)
        self.right_vent = telemetry.get("right_vent", self.right_vent)
        self.top_vent = telemetry.get("top_vent", self.top_vent)
        self.flashlight = telemetry.get("flashlight", self.flashlight)
        self.pan_x = telemetry.get("pan_x", self.pan_x)
        self.looking_at_monitor = telemetry.get("looking_at_monitor", self.looking_at_monitor)
        
        # Record into AI brain habit profiler
        self.ai_brain.record_telemetry(
            self.left_door, self.right_door, self.right_vent, self.flashlight, self.pan_x, self.top_vent
        )
        
        # Check if telemetry blocks any active attack immediately
        self._check_defenses()

    def _check_defenses(self):
        resolved = []
        for attack in self.active_attacks:
            blocked = False
            if attack.action == "ENTER_LEFT_DOOR" and self.left_door:
                blocked = True
            elif attack.action == "ENTER_RIGHT_DOOR" and self.right_door:
                blocked = True
            elif attack.action == "ATTACK_RIGHT_VENT" and self.right_vent:
                blocked = True
            elif attack.action == "ATTACK_TOP_VENT" and self.top_vent:
                blocked = True
            elif attack.action == "REQUIRE_FLASHLIGHT" and self.flashlight:
                blocked = True
            elif attack.action == "MOVE_SOUND":
                # Special animatronic audio cue blocked by appropriate defense
                special = self.registry.get("Shadow Acoustic Stalker")
                if special and special.on_player_reaction("react", self):
                    blocked = True
                    
            if blocked:
                update_decision_outcome(attack.decision_id, "BLOCKED")
                state = self.ai_brain.encode_state(self.get_telemetry_dict())
                self.ai_brain.learn_outcome(state, attack.action, "BLOCKED", reward=-5.0)
                resolved.append(attack)

                # Sound when hitting closed door: blockb.wav!
                stereo_pan = -0.85 if attack.direction == "left" else (0.85 if attack.direction == "right" else 0.0)
                self.pending_events.append({
                    "type": "ATTACK_BLOCKED",
                    "action": attack.action,
                    "direction": attack.direction,
                    "stereo_pan": stereo_pan,
                    "sound": "blockb.wav",
                    "message": f"💥 ¡Impacto en la defensa ({attack.direction})! El animatrónico chocó con la puerta y se fue."
                })
                
        for r in resolved:
            self.active_attacks.remove(r)

    def trigger_controlled_shock(self) -> Optional[Dict[str, Any]]:
        """
        Controlled Shock: Electrocutes and reboots the AI.
        Cooldown: 30 seconds.
        Cancels active attacks and stuns AI decision making for 8 seconds.
        """
        time_since_last = self.seconds_elapsed - self.last_shock_time
        if time_since_last < self.shock_cooldown:
            return None # on cooldown

        self.last_shock_time = self.seconds_elapsed
        self.power = max(0.0, self.power - 3.0) # costs 3% power
        self.ai_stun_timer = 8.0 # stuns AI

        # Clear any active attacks and mark as disrupted
        for atk in list(self.active_attacks):
            update_decision_outcome(atk.decision_id, "BLOCKED")
        self.active_attacks.clear()

        return {
            "type": "CONTROLLED_SHOCK_SUCCESS",
            "message": "¡Descarga eléctrica exitosa! IA reiniciada temporalmente (aturdida por 8s).",
            "sound": "shock.wav"
        }

    def tick(self, dt: float) -> List[Dict[str, Any]]:
        """
        Game loop tick called ~10 times per second (dt = 0.1s).
        Returns a list of events to broadcast to client (sound cues, attack prompts, jumpscare, victory).
        """
        if not self.is_active or self.is_game_over or self.is_victory:
            return []

        events: List[Dict[str, Any]] = []

        # Consume any defense block events (e.g. animatronic crashing into door blockb.wav)
        if self.pending_events:
            events.extend(self.pending_events)
            self.pending_events.clear()

        self.seconds_elapsed += dt
        
        # 1. FNAF Time progression
        hour_index = int(self.seconds_elapsed // self.SECONDS_PER_HOUR)
        new_hour = 12 if hour_index == 0 else hour_index
        if new_hour != self.current_hour and new_hour <= 6:
            self.current_hour = new_hour
            events.append({
                "type": "HOUR_CHIME",
                "hour": f"{self.current_hour} AM",
                "sound": "blip.wav"
            })
            
        # 2. Victory check: 6:00 AM!
        if self.seconds_elapsed >= (self.SECONDS_PER_HOUR * 6):
            self.is_victory = True
            self.is_active = False
            current_progress = get_game_progress()
            next_night = min(6, self.night_number + 1)
            new_stars = max(current_progress.get("stars_unlocked", 0), self.night_number if self.night_number > 0 else 0)
            if self.night_number > 0:
                save_game_progress(next_night, new_stars, won=True)
            if self.session_id:
                finish_night_session(self.session_id, "won", None, self.seconds_elapsed, self.power, self.total_decisions_this_night)
            events.append({
                "type": "VICTORY",
                "night": self.night_number,
                "stars_earned": new_stars,
                "next_night": next_night if self.night_number > 0 else 1,
                "sound": "chimes.wav"
            })
            return events

        # Impostor AI Camera roaming loop
        self.impostor_move_timer += dt
        if self.impostor_move_timer >= 11.0:
            self.impostor_move_timer = 0.0
            import random
            old_cam = self.impostor_cam
            # Move to a different cam
            cams = [c for c in [1, 2, 3, 4] if c != old_cam]
            self.impostor_cam = random.choice(cams)
            self.impostor_form = random.choice(["761.png", "563.png", "5fa.png", "4b0.png"])

        # Center Vent Peek (2cc.png) logic
        if self.impostor_peeking_center_vent:
            if self.top_vent:
                # Successfully slammed vent on time!
                self.impostor_peeking_center_vent = False
                events.append({
                    "type": "VENT_BLOCKED",
                    "sound": "ventbang.wav",
                    "message": "¡Compuerta superior cerrada a tiempo! Animatrónico repelido."
                })
            else:
                self.center_vent_peek_timer -= dt
                if self.center_vent_peek_timer <= 0:
                    self.impostor_peeking_center_vent = False
                    if self.night_number == 0:
                        events.append({
                            "type": "TEST_MODE_EVENT",
                            "sound": "blockb.wav",
                            "message": "[Modo Prueba] 2cc.png se asomó en la ventilación. ¡En noche real debes cerrar con [W]!"
                        })
                    else:
                        self.trigger_jumpscare("Impostor Vent Stalker (2cc.png)", "No cerraste el conducto superior a tiempo", "fnaf6scream.wav", events)
                        return events

        # 3. Power consumption
        if self.night_number == 0:
            self.power = 100.0 # Infinite power in Sandbox mode
        else:
            # Calculate usage bars
            usage_bars = 1 # 1 bar base (fan + office ambient)
            if self.left_door:
                usage_bars += 1
            if self.right_door:
                usage_bars += 1
            if self.right_vent:
                usage_bars += 1
            if self.top_vent:
                usage_bars += 1
            if self.flashlight:
                usage_bars += 1
            if self.looking_at_monitor:
                usage_bars += 1

            drain = self.base_drain_rate * usage_bars * dt
            self.power = max(0.0, self.power - drain)
            
            # Blackout check
            if self.power <= 0.0:
                self.left_door = False
                self.right_door = False
                self.right_vent = False
                self.top_vent = False
                self.flashlight = False
                self.trigger_jumpscare("Blackout Freddy", "¡Se agotó la energía de la oficina!", "fnaf2scream.wav", events)
                return events

        # 4. Check active attacks timeout (Jumpscare if not blocked in time)
        for attack in list(self.active_attacks):
            attack.deadline -= dt
            if attack.deadline <= 0:
                self.active_attacks.remove(attack)
                
                # IN TEST MODE: NEVER JUMPSCARE OR END GAME!
                if self.night_number == 0:
                    events.append({
                        "type": "TEST_MODE_EVENT",
                        "sound": "blockb.wav",
                        "message": f"🛡️ [Modo Prueba] El ataque simulado ({attack.action}) terminó. ¡Eres inmune!"
                    })
                    continue

                update_decision_outcome(attack.decision_id, "SUCCESS")
                state = self.ai_brain.encode_state(self.get_telemetry_dict())
                self.ai_brain.learn_outcome(state, attack.action, "SUCCESS", reward=10.0)
                
                # Fatal attack breaches office!
                self.trigger_jumpscare(
                    killer=f"IA Adaptive ({attack.action})",
                    cause=f"Ataque exitoso por {attack.action}",
                    sound="fnaf6scream.wav",
                    events=events
                )
                return events

        # 5. Animatronic registry updates (e.g. Special Acoustic Animatronic)
        for anim in self.registry.get_all():
            event = anim.update(dt, self)
            if event:
                if event.get("type") == "JUMPSCARE":
                    self.trigger_jumpscare(event["killer"], event["cause"], event.get("sound", "jumpscareb.wav"), events)
                    return events
                elif event.get("type") == "SPECIAL_AUDIO_MOVE":
                    events.append(event)

        # 6. Periodic Adaptive AI Strategic Decision
        if self.ai_stun_timer > 0:
            self.ai_stun_timer -= dt
        else:
            self.ai_decision_timer += dt
            aggression = 1.0 + (self.night_number * 0.2) + (self.seconds_elapsed / 300.0)
            
            if self.ai_decision_timer >= (self.ai_decision_interval / aggression):
                self.ai_decision_timer = 0.0
                self._make_ai_decision(events, aggression)

        return events

    def _make_ai_decision(self, events: List[Dict[str, Any]], aggression: float):
        if self.night_number == 0:
            return # No attacks in test mode!

        current_telemetry = self.get_telemetry_dict()
        action, reason, conf = self.ai_brain.choose_decision(current_telemetry, aggression)
        self.total_decisions_this_night += 1
        
        decision_id = log_ai_decision(
            session_id=self.session_id,
            action=action,
            reason=reason,
            confidence=conf,
            player_snapshot=current_telemetry,
            outcome="PENDING"
        )
        
        # Fair reaction time (generous on early nights)
        reaction_time = max(3.0, 6.5 - (self.night_number * 0.6))
        sound_cue = "doorFX.wav"
        direction = "center"
        
        if action == "ATTACK_RIGHT_VENT":
            sound_cue = "ventbang.wav"
            direction = "right"
        elif action == "ATTACK_TOP_VENT":
            sound_cue = "ventbang.wav"
            direction = "center"
            # Triggers visual 2cc.png peek inside top vent
            self.impostor_peeking_center_vent = True
            self.center_vent_peek_timer = 1.3
        elif action == "ENTER_LEFT_DOOR":
            sound_cue = "doorFX.wav"
            direction = "left"
        elif action == "ENTER_RIGHT_DOOR":
            sound_cue = "doorFX.wav"
            direction = "right"
        elif action == "REQUIRE_FLASHLIGHT":
            sound_cue = "breathing.wav"
            direction = "center"
        elif action == "MOVE_SOUND":
            sound_cue = "audio01.wav"
            direction = "right" if self.pan_x < 0.5 else "left" # move opposite to where player looks!
            
        active_atk = ActiveAttack(action, decision_id, reaction_time, sound_cue, direction)
        self.active_attacks.append(active_atk)
        
        events.append({
            "type": "AI_TACTICAL_ACTION",
            "action": action,
            "decision_id": decision_id,
            "reason": reason,
            "sound": sound_cue,
            "direction": direction,
            "stereo_pan": -0.8 if direction == "left" else (0.8 if direction == "right" else 0.0),
            "deadline_seconds": reaction_time,
            "message": f"IA ha decidido: {action} ({reason})"
        })

    def trigger_jumpscare(self, killer: str, cause: str, sound: str, events: List[Dict[str, Any]]):
        if self.night_number == 0:
            # EN MODO PRUEBA: INMUNIDAD TOTAL (No mueres ni se activa jumpscare)
            events.append({
                "type": "TEST_MODE_EVENT",
                "message": f"🛡️ [MODO PRUEBA] Ataque neutralizado: {killer}. ¡Eres inmortal aquí!",
                "sound": "blockb.wav"
            })
            return

        self.is_game_over = True
        self.is_active = False
        self.game_over_reason = f"{killer}: {cause}"
        save_game_progress(self.night_number, get_game_progress().get("stars_unlocked", 0), died=True)
        if self.session_id:
            finish_night_session(self.session_id, "jumpscare", self.game_over_reason, self.seconds_elapsed, self.power, self.total_decisions_this_night)
        events.append({
            "type": "JUMPSCARE",
            "killer": killer,
            "cause": cause,
            "sound": sound or "jumpscareb.wav"
        })

    def get_telemetry_dict(self) -> Dict[str, Any]:
        return {
            "left_door": self.left_door,
            "right_door": self.right_door,
            "right_vent": self.right_vent,
            "top_vent": self.top_vent,
            "flashlight": self.flashlight,
            "pan_x": self.pan_x,
            "looking_at_monitor": self.looking_at_monitor
        }

    def get_snapshot(self) -> Dict[str, Any]:
        usage_bars = 1
        if self.left_door: usage_bars += 1
        if self.right_door: usage_bars += 1
        if self.right_vent: usage_bars += 1
        if self.top_vent: usage_bars += 1
        if self.flashlight: usage_bars += 1
        if self.looking_at_monitor: usage_bars += 1

        shock_cooldown_left = max(0.0, self.shock_cooldown - (self.seconds_elapsed - self.last_shock_time))

        return {
            "session_id": self.session_id,
            "night_number": self.night_number,
            "is_active": self.is_active,
            "is_game_over": self.is_game_over,
            "is_victory": self.is_victory,
            "game_over_reason": self.game_over_reason,
            "current_hour": f"{self.current_hour} AM",
            "seconds_elapsed": round(self.seconds_elapsed, 1),
            "power": round(self.power, 1),
            "usage_bars": usage_bars,
            "left_door": self.left_door,
            "right_door": self.right_door,
            "right_vent": self.right_vent,
            "top_vent": self.top_vent,
            "flashlight": self.flashlight,
            "pan_x": round(self.pan_x, 2),
            "active_threats_count": len(self.active_attacks),
            "shock_cooldown_left": round(shock_cooldown_left, 1),
            "ai_stun_left": round(max(0.0, self.ai_stun_timer), 1),
            "impostor_cam": self.impostor_cam,
            "impostor_form": self.impostor_form,
            "impostor_peeking_center_vent": self.impostor_peeking_center_vent,
        }

