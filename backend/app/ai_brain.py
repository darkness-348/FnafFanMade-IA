import random
import time
import math
from typing import Dict, Any, List, Optional, Tuple
from .database import get_ai_memory, save_ai_memory_key

ACTIONS = [
    "ATTACK_RIGHT_VENT",
    "ATTACK_TOP_VENT",
    "ENTER_LEFT_DOOR",
    "ENTER_RIGHT_DOOR",
    "REQUIRE_FLASHLIGHT",
    "MOVE_SOUND"
]

class AIBrain:
    """
    Adaptive AI Agent for FNAF Fanmade:
    - Observes player telemetry (door frequencies, vent usage, flashlight habits, view panning).
    - Clusters player states and learns habits.
    - Uses Reinforcement Learning (Q-learning + Softmax Exploration) to pick optimal counter-strategies.
    - Persists learned weights and habit stats in SQLite.
    """
    def __init__(self):
        self.actions = ACTIONS
        self.learning_rate = 0.2
        self.discount_factor = 0.8
        self.epsilon = 0.15  # Exploration probability
        self.temperature = 1.2 # Softmax temperature
        
        # In-memory session telemetry
        self.session_ticks = 0
        self.left_door_closed_ticks = 0
        self.right_door_closed_ticks = 0
        self.vent_closed_ticks = 0
        self.top_vent_closed_ticks = 0
        self.flashlight_on_ticks = 0
        self.pan_history: List[float] = [] # 0.0=left, 1.0=right
        
        # Cumulative action counts & outcomes
        self.action_counts: Dict[str, int] = {a: 0 for a in self.actions}
        self.action_successes: Dict[str, int] = {a: 0 for a in self.actions}
        
        # Q-table: Dict[state_str, Dict[action_str, float]]
        self.q_table: Dict[str, Dict[str, float]] = {}
        
        # Load persisted knowledge from database
        self.load_persisted_memory()

    def load_persisted_memory(self):
        try:
            mem = get_ai_memory()
            if "q_table" in mem and isinstance(mem["q_table"], dict):
                self.q_table = mem["q_table"]
            if "action_counts" in mem and isinstance(mem["action_counts"], dict):
                for k, v in mem["action_counts"].items():
                    if k in self.action_counts:
                        self.action_counts[k] = v
            if "action_successes" in mem and isinstance(mem["action_successes"], dict):
                for k, v in mem["action_successes"].items():
                    if k in self.action_successes:
                        self.action_successes[k] = v
        except Exception as e:
            print(f"[AIBrain] Error loading memory: {e}")

    def save_persisted_memory(self):
        try:
            save_ai_memory_key("q_table", self.q_table)
            save_ai_memory_key("action_counts", self.action_counts)
            save_ai_memory_key("action_successes", self.action_successes)
        except Exception as e:
            print(f"[AIBrain] Error saving memory: {e}")

    def record_telemetry(self, left_door: bool, right_door: bool, right_vent: bool, flashlight: bool, pan_x: float, top_vent: bool = False):
        self.session_ticks += 1
        if left_door:
            self.left_door_closed_ticks += 1
        if right_door:
            self.right_door_closed_ticks += 1
        if right_vent:
            self.vent_closed_ticks += 1
        if top_vent:
            self.top_vent_closed_ticks += 1
        if flashlight:
            self.flashlight_on_ticks += 1
            
        self.pan_history.append(pan_x)
        if len(self.pan_history) > 300: # keep last ~30 seconds (at 10 ticks/sec)
            self.pan_history.pop(0)

    def get_habit_metrics(self) -> Dict[str, Any]:
        total = max(1, self.session_ticks)
        avg_pan = sum(self.pan_history) / max(1, len(self.pan_history)) if self.pan_history else 0.5
        
        return {
            "session_ticks": self.session_ticks,
            "left_door_usage_pct": round((self.left_door_closed_ticks / total) * 100, 1),
            "right_door_usage_pct": round((self.right_door_closed_ticks / total) * 100, 1),
            "vent_usage_pct": round((self.vent_closed_ticks / total) * 100, 1),
            "top_vent_usage_pct": round((self.top_vent_closed_ticks / total) * 100, 1),
            "flashlight_usage_pct": round((self.flashlight_on_ticks / total) * 100, 1),
            "avg_pan_orientation": round(avg_pan, 2), # 0.0 left, 1.0 right
            "primary_blind_spot": self._identify_blind_spot()
        }

    def _identify_blind_spot(self) -> str:
        total = max(1, self.session_ticks)
        p_left = self.left_door_closed_ticks / total
        p_right = self.right_door_closed_ticks / total
        p_vent = self.vent_closed_ticks / total
        p_top_vent = self.top_vent_closed_ticks / total
        p_light = self.flashlight_on_ticks / total
        
        spots = [
            ("Escotilla Derecha (Vent)", p_vent),
            ("Conducto Superior (Top Vent)", p_top_vent),
            ("Puerta Derecha", p_right),
            ("Puerta Izquierda", p_left),
            ("Linterna (Flashlight)", p_light),
        ]
        # Sort ascending (lowest guard = biggest blind spot)
        spots.sort(key=lambda x: x[1])
        return spots[0][0]

    def encode_state(self, current_telemetry: Dict[str, Any]) -> str:
        """
        Discretizes real-time state into a concise signature:
        - L: left door closed (1) or open (0)
        - R: right door closed (1) or open (0)
        - V: vent closed (1) or open (0)
        - F: flashlight on (1) or off (0)
        - Pan: Left ('L'), Center ('C'), Right ('R')
        - Habit: 'LeftCamper' | 'RightCamper' | 'Balanced'
        """
        ld = "1" if current_telemetry.get("left_door") else "0"
        rd = "1" if current_telemetry.get("right_door") else "0"
        vd = "1" if current_telemetry.get("right_vent") else "0"
        tv = "1" if current_telemetry.get("top_vent") else "0"
        fl = "1" if current_telemetry.get("flashlight") else "0"
        
        pan = current_telemetry.get("pan_x", 0.5)
        if pan < 0.35:
            pan_str = "L"
        elif pan > 0.65:
            pan_str = "R"
        else:
            pan_str = "C"
            
        total = max(1, self.session_ticks)
        p_l = self.left_door_closed_ticks / total
        p_r = self.right_door_closed_ticks / total
        
        if p_l > 0.6 and p_r < 0.3:
            habit = "LeftBiased"
        elif p_r > 0.6 and p_l < 0.3:
            habit = "RightBiased"
        elif (self.vent_closed_ticks / total) < 0.15:
            habit = "VentBlind"
        elif (self.top_vent_closed_ticks / total) < 0.15:
            habit = "TopVentBlind"
        else:
            habit = "Active"
            
        return f"{ld}{rd}{vd}{tv}{fl}_{pan_str}_{habit}"

    def get_q_values_for_state(self, state: str) -> Dict[str, float]:
        if state not in self.q_table:
            # Initialize with balanced priors
            self.q_table[state] = {a: 1.0 for a in self.actions}
        return self.q_table[state]

    def choose_decision(self, current_telemetry: Dict[str, Any], aggression: float = 1.0) -> Tuple[str, str, float]:
        """
        Evaluates player state and habit memory to pick the best tactical action.
        Returns: (chosen_action, reason_explanation, confidence_or_probability)
        """
        state = self.encode_state(current_telemetry)
        q_vals = self.get_q_values_for_state(state)
        habits = self.get_habit_metrics()
        
        # Softmax selection with Q-values
        # Softmax probabilities: P(a) = exp(Q(s, a) / T) / sum(exp(Q(s, a') / T))
        exp_vals = {}
        for a, q in q_vals.items():
            # Factor in habit exploitation bonus
            bonus = 0.0
            if a == "ATTACK_RIGHT_VENT" and habits["vent_usage_pct"] < 30:
                bonus += 1.5
            elif a == "ATTACK_TOP_VENT" and habits.get("top_vent_usage_pct", 0) < 30:
                bonus += 1.5
            elif a == "ENTER_RIGHT_DOOR" and habits["right_door_usage_pct"] < 30:
                bonus += 1.2
            elif a == "ENTER_LEFT_DOOR" and habits["left_door_usage_pct"] < 30:
                bonus += 1.2
            elif a == "REQUIRE_FLASHLIGHT" and habits["flashlight_usage_pct"] < 15:
                bonus += 1.8
            elif a == "MOVE_SOUND":
                # Special animatronic move sound: always good probe
                bonus += 0.8
                
            val = (q + bonus * aggression) / self.temperature
            exp_vals[a] = math.exp(min(val, 20.0)) # clamp overflow
            
        sum_exp = sum(exp_vals.values())
        probs = {a: exp_vals[a] / sum_exp for a in self.actions}
        
        # Epsilon-greedy exploration check
        if random.random() < self.epsilon:
            chosen = random.choice(self.actions)
            reason = f"[Exploración] La IA sondea vectores aleatorios para descubrir nuevos hábitos del jugador."
            conf = probs[chosen]
        else:
            # Weighted random choice based on softmax probabilities
            rand_pick = random.random()
            cum = 0.0
            chosen = self.actions[0]
            for a in self.actions:
                cum += probs[a]
                if rand_pick <= cum:
                    chosen = a
                    break
            conf = probs[chosen]
            
            # Formulate strategic reasoning
            if chosen == "ATTACK_RIGHT_VENT":
                reason = f"El jugador vigila poco la escotilla ({habits['vent_usage_pct']}%). Ataque sorpresa por ducto derecho."
            elif chosen == "ATTACK_TOP_VENT":
                reason = f"El conducto superior está descuidado ({habits.get('top_vent_usage_pct', 0)}%). Infiltración por ventilación central [W]."
            elif chosen == "ENTER_LEFT_DOOR":
                reason = f"Puerta izquierda vulnerable ({habits['left_door_usage_pct']}% uso) o jugador mirando hacia la derecha."
            elif chosen == "ENTER_RIGHT_DOOR":
                reason = f"Puerta derecha vulnerable ({habits['right_door_usage_pct']}% uso). Emboscada por pasillo derecho."
            elif chosen == "REQUIRE_FLASHLIGHT":
                reason = f"Uso deficiente de linterna ({habits['flashlight_usage_pct']}%). Emboscada en sombras que exige iluminación."
            elif chosen == "MOVE_SOUND":
                reason = f"Movimiento del animatrónico invisible (audio01). Provoca alerta auditiva para probar tiempo de reacción."
            else:
                reason = "Ataque táctico calculado según patrones del jugador."
                
        self.action_counts[chosen] += 1
        return chosen, reason, round(conf, 3)

    def learn_outcome(self, state: str, action: str, outcome: str, reward: float):
        """
        Q-Learning update:
        Q(s, a) = Q(s, a) + alpha * (reward + gamma * max(Q(s')) - Q(s, a))
        """
        if state not in self.q_table:
            self.q_table[state] = {a: 1.0 for a in self.actions}
            
        old_val = self.q_table[state].get(action, 1.0)
        new_val = old_val + self.learning_rate * (reward - old_val)
        self.q_table[state][action] = round(new_val, 3)
        
        if outcome == "SUCCESS":
            self.action_successes[action] = self.action_successes.get(action, 0) + 1
            
        self.save_persisted_memory()

    def get_analytics(self) -> Dict[str, Any]:
        total_actions = sum(self.action_counts.values())
        total_successes = sum(self.action_successes.values())
        success_rate = round((total_successes / max(1, total_actions)) * 100, 1)
        
        # Calculate policy distribution
        return {
            "action_frequencies": self.action_counts,
            "action_successes": self.action_successes,
            "habit_metrics": self.get_habit_metrics(),
            "q_values_summary": {k: v for i, (k, v) in enumerate(self.q_table.items()) if i < 15},
            "total_decisions": total_actions,
            "success_rate": success_rate,
            "epsilon": self.epsilon
        }

