export type GameScreen = 'MENU' | 'NIGHT_INTRO' | 'OFFICE' | 'DASHBOARD';

export interface GameState {
  session_id: number | null;
  night_number: number;
  is_active: boolean;
  is_game_over: boolean;
  is_victory: boolean;
  game_over_reason: string | null;
  current_hour: string;
  seconds_elapsed: number;
  power: number;
  usage_bars: number;
  left_door: boolean;
  right_door: boolean;
  right_vent: boolean;
  top_vent: boolean;
  flashlight: boolean;
  pan_x: number;
  active_threats_count: number;
  shock_cooldown_left?: number;
  ai_stun_left?: number;
  looking_at_monitor: boolean;
  impostor_cam?: number;
  impostor_form?: string;
  impostor_peeking_center_vent?: boolean;
  mask_on?: boolean;
  door_hacked_side?: string | null;
  toy_bonnie_active?: boolean;
  toy_bonnie_timer?: number;
  bonnet_active?: boolean;
  bonnet_timer?: number;
  lolbit_active?: boolean;
  lolbit_timer?: number;
}

export interface GameProgress {
  current_night: number;
  stars_unlocked: number;
  total_nights_completed: number;
  total_deaths: number;
}

export interface AIDecisionEvent {
  type: 'AI_TACTICAL_ACTION';
  action: 'ATTACK_RIGHT_VENT' | 'ENTER_LEFT_DOOR' | 'ENTER_RIGHT_DOOR' | 'REQUIRE_FLASHLIGHT' | 'MOVE_SOUND';
  decision_id: number;
  reason: string;
  sound: string;
  direction: 'left' | 'center' | 'right';
  stereo_pan: number;
  deadline_seconds: number;
  message: string;
}

export interface SpecialAudioEvent {
  type: 'SPECIAL_AUDIO_MOVE';
  animatronic: string;
  sound: string;
  direction: 'left' | 'center' | 'right';
  stereo_pan: number;
  deadline_seconds: number;
  message: string;
}

export interface JumpscareEvent {
  type: 'JUMPSCARE';
  killer: string;
  cause: string;
  sound: string;
}

export interface VictoryEvent {
  type: 'VICTORY';
  night: number;
  stars_earned: number;
  next_night: number;
  sound: string;
}

export interface HourChimeEvent {
  type: 'HOUR_CHIME';
  hour: string;
  sound: string;
}

export type GameEvent = AIDecisionEvent | SpecialAudioEvent | JumpscareEvent | VictoryEvent | HourChimeEvent;

export interface HabitMetrics {
  session_ticks: number;
  left_door_usage_pct: number;
  right_door_usage_pct: number;
  vent_usage_pct: number;
  flashlight_usage_pct: number;
  avg_pan_orientation: number;
  primary_blind_spot: string;
}

export interface AIAnalytics {
  action_frequencies: Record<string, number>;
  action_successes: Record<string, number>;
  habit_metrics: HabitMetrics;
  q_values_summary: Record<string, Record<string, number>>;
  total_decisions: number;
  success_rate: number;
  epsilon: number;
}

export interface NightHistoryRecord {
  id: number;
  night_number: number;
  status: string;
  cause_of_death: string | null;
  seconds_survived: number;
  power_left: number;
  ai_decisions_count: number;
  created_at: string;
}

export interface DecisionRecord {
  id: number;
  night_session_id: number;
  night_number?: number;
  action: string;
  reason: string;
  confidence: number;
  player_state_snapshot: any;
  outcome: string;
  timestamp: string;
}

