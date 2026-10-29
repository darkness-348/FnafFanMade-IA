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

        # Mask & Bunker Countermeasures
        self.mask_on: bool = False
        self.bunker_duration: float = 0.0
        self.door_hacked_side: Optional[str] = None
        self.door_hack_timer: float = 0.0

        # Toy Bonnie (Random Office Infiltration)
        self.toy_bonnie_active: bool = False
        self.toy_bonnie_timer: float = 0.0
        self.toy_bonnie_cooldown: float = 24.0

        # Bonnet (Nose Click Challenge)
        self.bonnet_active: bool = False
        self.bonnet_timer: float = 0.0
        self.bonnet_cooldown: float = 32.0

        # Lolbit (Type 'LOL' Challenge)
        self.lolbit_active: bool = False
        self.lolbit_timer: float = 0.0
        self.lolbit_cooldown: float = 38.0

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

        # Reset Countermeasures & Special Animatronics
        self.mask_on = False
        self.bunker_duration = 0.0
        self.door_hacked_side = None
        self.door_hack_timer = 0.0
        self.toy_bonnie_active = False
        self.toy_bonnie_timer = 0.0
        self.toy_bonnie_cooldown = 24.0
        self.bonnet_active = False
        self.bonnet_timer = 0.0
        self.bonnet_cooldown = 32.0
        self.lolbit_active = False
        self.lolbit_timer = 0.0
        self.lolbit_cooldown = 38.0

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
        if self.door_hacked_side == "left":
            self.left_door = False
        else:
            self.left_door = telemetry.get("left_door", self.left_door)

        if self.door_hacked_side == "right":
            self.right_door = False
        else:
            self.right_door = telemetry.get("right_door", self.right_door)

        self.right_vent = telemetry.get("right_vent", self.right_vent)
        self.top_vent = telemetry.get("top_vent", self.top_vent)
        self.flashlight = telemetry.get("flashlight", self.flashlight)
        self.mask_on = telemetry.get("mask_on", self.mask_on)
        self.pan_x = telemetry.get("pan_x", self.pan_x)
        self.looking_at_monitor = telemetry.get("looking_at_monitor", self.looking_at_monitor)
        
        # Record into AI brain habit profiler
        self.ai_brain.record_telemetry(
            self.left_door, self.right_door, self.right_vent, self.flashlight, self.pan_x, self.top_vent
        )
        
        # Check if telemetry blocks any active attack immediately
        self._check_defenses()

    def defuse_bonnet(self) -> Dict[str, Any]:
        """Player clicked Bonnet's nose!"""
        if self.bonnet_active:
            self.bonnet_active = False
            self.bonnet_timer = 0.0
            return {
                "type": "BONNET_DEFUSED",
                "sound": "pop.wav",
                "message": "¡Boop! Le tocaste la nariz a Bonnet y desapareció."
            }
        return {}

    def defuse_lolbit(self) -> Dict[str, Any]:
        """Player typed 'LOL' within 2 seconds!"""
        if self.lolbit_active:
            self.lolbit_active = False
            self.lolbit_timer = 0.0
            return {
                "type": "LOLBIT_DEFUSED",
                "sound": "blip.wav",
                "message": "✅ ¡Escribiste LOL a tiempo! Transmisión de Lolbit neutralizada."
            }
        return {}

    def spawn_bonnet(self, events: List[Dict[str, Any]]):
        self.bonnet_active = True
        self.bonnet_timer = 5.5
        events.append({
            "type": "BONNET_SPAWN",
            "duration": 5.5,
            "sound": "Bonnet02b.wav",
            "message": "🎀 ¡Bonnet cruzando la oficina! ¡Haz clic en su nariz antes de que llegue a la izquierda!"
        })

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
                # Neutralizado según la dirección del sonido o búnker total
                if attack.direction == "left" and (self.left_door or (self.pan_x < 0.35 and self.flashlight)):
                    blocked = True
                elif attack.direction == "right" and (self.right_door or self.right_vent or (self.pan_x > 0.65 and self.flashlight)):
                    blocked = True
                elif attack.direction == "center" and (self.top_vent or self.flashlight or (self.left_door and self.right_door)):
                    blocked = True
                elif self.left_door and self.right_door:
                    # Cerró todas las puertas principales
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

        # If any door was hacked by AI, restore it!
        unhacked_side = None
        if self.door_hacked_side:
            unhacked_side = self.door_hacked_side
            self.door_hacked_side = None
            self.door_hack_timer = 0.0

        return {
            "type": "CONTROLLED_SHOCK_SUCCESS",
            "unhacked_side": unhacked_side,
            "message": f"¡Descarga eléctrica exitosa! IA reiniciada temporalmente (aturdida por 8s).{' ¡Puerta ' + unhacked_side.upper() + ' liberada!' if unhacked_side else ''}",
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

        # 6. Anti-Bunker & Special Animatronic Cycles
        import random

        # --- A. Bunker Detection & AI Countermeasures ---
        is_bunkered = self.left_door and self.right_door and (self.top_vent or self.right_vent)
        if is_bunkered:
            self.bunker_duration += dt
            if self.bunker_duration >= 6.5 and not self.door_hacked_side and not self.bonnet_active:
                self.bunker_duration = 0.0
                decision = random.choice(["HACK_DOOR", "FAKE_DOOR", "SPAWN_BONNET"])
                if decision == "HACK_DOOR":
                    target_side = random.choice(["left", "right"])
                    self.door_hacked_side = target_side
                    self.door_hack_timer = 6.5
                    if target_side == "left":
                        self.left_door = False
                    else:
                        self.right_door = False
                    events.append({
                        "type": "AI_DOOR_HACK",
                        "side": target_side,
                        "sound": "doorFX.wav",
                        "message": f"🚨 ¡LA IA FORZÓ LA PUERTA {target_side.upper()}! ¡USA SHOCK [E] PARA REINICIARLA!"
                    })
                elif decision == "FAKE_DOOR":
                    fake_side = random.choice(["left", "right"])
                    events.append({
                        "type": "AI_FAKE_DOOR",
                        "side": fake_side,
                        "sound": "doorFX.wav",
                        "message": f"⚠️ La IA fingió abrir la puerta {fake_side.upper()} (Falsa Alarma táctica)"
                    })
                elif decision == "SPAWN_BONNET":
                    if not self.bonnet_active:
                        self.spawn_bonnet(events)
        else:
            self.bunker_duration = max(0.0, self.bunker_duration - dt * 0.5)

        # Handle Door Hack timer (player must shock [E] in time!)
        if self.door_hacked_side:
            self.door_hack_timer -= dt
            if self.door_hack_timer <= 0:
                hacked_s = self.door_hacked_side
                self.door_hacked_side = None
                if self.night_number == 0:
                    events.append({
                        "type": "TEST_MODE_EVENT",
                        "sound": "blockb.wav",
                        "message": f"[Modo Prueba] La IA aprovechó la puerta {hacked_s} forzada. ¡En noche real debes usar Shock [E]!"
                    })
                else:
                    self.trigger_jumpscare("IA Breach Stalker", f"La IA forzó tu puerta {hacked_s} y no aplicaste la descarga a tiempo", "fnaf6scream.wav", events)
                    return events

        # --- B. Toy Bonnie Random Office Infiltration ---
        self.toy_bonnie_cooldown -= dt
        if self.toy_bonnie_cooldown <= 0 and not self.toy_bonnie_active:
            self.toy_bonnie_cooldown = random.uniform(25.0, 42.0)
            self.toy_bonnie_active = True
            self.toy_bonnie_timer = 4.5
            events.append({
                "type": "TOY_BONNIE_APPEAR",
                "duration": 4.5,
                "sound": "breathing.wav",
                "message": "🐰 ¡Toy Bonnie entró en la oficina! ¡PONTE LA MÁSCARA DE FREDDY [ESPACIO]!"
            })

        if self.toy_bonnie_active:
            self.toy_bonnie_timer -= dt
            # After 1.3 seconds of entering, if player still has NO mask on:
            if self.toy_bonnie_timer <= 3.2 and not self.mask_on:
                self.toy_bonnie_active = False
                if self.night_number == 0:
                    events.append({
                        "type": "TEST_MODE_EVENT",
                        "sound": "blockb.wav",
                        "message": "[Modo Prueba] Toy Bonnie te descubrió sin máscara de Freddy. ¡En noche real te mataría!"
                    })
                else:
                    self.trigger_jumpscare("Toy Bonnie", "No te pusiste la máscara de Freddy a tiempo mientras cruzaba la oficina", "fnaf2scream.wav", events)
                    return events
            elif self.toy_bonnie_timer <= 0:
                # Successfully fooled Toy Bonnie with mask!
                self.toy_bonnie_active = False
                events.append({
                    "type": "TOY_BONNIE_LEAVE",
                    "sound": "pop.wav",
                    "message": "Toy Bonnie te confundió con Freddy y abandonó la oficina."
                })

        # --- C. Bonnet Nose Click Challenge ---
        self.bonnet_cooldown -= dt
        if self.bonnet_cooldown <= 0 and not self.bonnet_active:
            self.bonnet_cooldown = random.uniform(30.0, 48.0)
            self.spawn_bonnet(events)

        if self.bonnet_active:
            self.bonnet_timer -= dt
            if self.bonnet_timer <= 0:
                self.bonnet_active = False
                if self.night_number == 0:
                    events.append({
                        "type": "TEST_MODE_EVENT",
                        "sound": "blockb.wav",
                        "message": "[Modo Prueba] Bonnet cruzó sin que presionaras su nariz. ¡En noche real te mataría!"
                    })
                else:
                    self.trigger_jumpscare("Bonnet", "No presionaste la nariz de Bonnet antes de que cruzara la pantalla", "fnaf6scream.wav", events)
                    return events

        # --- D. Lolbit 'Type LOL' Challenge ---
        self.lolbit_cooldown -= dt
        if self.lolbit_cooldown <= 0 and not self.lolbit_active:
            self.lolbit_cooldown = random.uniform(38.0, 60.0)
            self.lolbit_active = True
            self.lolbit_timer = 2.0 # Exact 2 seconds as requested!
            events.append({
                "type": "LOLBIT_APPEAR",
                "duration": 2.0,
                "sound": "glitch1c.wav",
                "message": "📺 ¡INTERRUPCIÓN DE LOLBIT! ¡ESCRIBE 'L-O-L' EN 2 SEGUNDOS!"
            })

        if self.lolbit_active:
            self.lolbit_timer -= dt
            if self.lolbit_timer <= 0:
                self.lolbit_active = False
                # Penalización: Fuerza la apertura de ambas puertas y drena 5% de energía
                self.left_door = False
                self.right_door = False
                self.power = max(0.0, self.power - 5.0)
                events.append({
                    "type": "LOLBIT_FAIL",
                    "sound": "glitch3c.wav",
                    "message": "❌ ¡Tiempo agotado! Lolbit forzó la apertura de tus puertas y sobrecargó la energía."
                })

        # 7. Periodic Adaptive AI Strategic Decision
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
            "mask_on": self.mask_on,
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
            "mask_on": self.mask_on,
            "door_hacked_side": self.door_hacked_side,
            "toy_bonnie_active": self.toy_bonnie_active,
            "toy_bonnie_timer": round(self.toy_bonnie_timer, 1),
            "bonnet_active": self.bonnet_active,
            "bonnet_timer": round(self.bonnet_timer, 1),
            "lolbit_active": self.lolbit_active,
            "lolbit_timer": round(self.lolbit_timer, 1),
            "pan_x": round(self.pan_x, 2),
            "active_threats_count": len(self.active_attacks),
            "shock_cooldown_left": round(shock_cooldown_left, 1),
            "ai_stun_left": round(max(0.0, self.ai_stun_timer), 1),
            "impostor_cam": self.impostor_cam,
            "impostor_form": self.impostor_form,
            "impostor_peeking_center_vent": self.impostor_peeking_center_vent,
        }

