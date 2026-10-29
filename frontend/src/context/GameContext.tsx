import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { GameScreen, GameState, GameProgress, GameEvent, AIDecisionEvent, SpecialAudioEvent, JumpscareEvent, VictoryEvent } from '../types/game';
import { soundManager } from '../sound/soundManager';

interface GameContextType {
  screen: GameScreen;
  setScreen: (screen: GameScreen) => void;
  progress: GameProgress;
  gameState: GameState;
  wsConnected: boolean;
  activeTacticalAlert: (AIDecisionEvent | SpecialAudioEvent) | null;
  jumpscareData: JumpscareEvent | null;
  victoryData: VictoryEvent | null;
  startNight: (night?: number) => Promise<void>;
  returnToMenu: () => void;
  resetProgress: () => Promise<void>;
  toggleLeftDoor: () => void;
  toggleRightDoor: () => void;
  toggleRightVent: () => void;
  toggleTopVent: () => void;
  triggerShock: () => void;
  toggleMonitor: () => void;
  setMonitor: (val: boolean) => void;
  currentCam: number;
  setCurrentCam: (cam: number) => void;
  toggleFlashlight: () => void;
  setFlashlight: (val: boolean) => void;
  toggleMask: () => void;
  setMask: (val: boolean) => void;
  defuseBonnet: () => void;
  defuseLolbit: () => void;
  setPanX: (val: number) => void;
  sendReaction: (action: string) => void;
  refreshProgress: () => Promise<void>;
}

const initialGameState: GameState = {
  session_id: null,
  night_number: 1,
  is_active: false,
  is_game_over: false,
  is_victory: false,
  game_over_reason: null,
  current_hour: '12 AM',
  seconds_elapsed: 0,
  power: 100,
  usage_bars: 1,
  left_door: false,
  right_door: false,
  right_vent: false,
  top_vent: false,
  flashlight: false,
  pan_x: 0.5,
  active_threats_count: 0,
  shock_cooldown_left: 0,
  ai_stun_left: 0,
  looking_at_monitor: false,
  impostor_cam: 1,
  impostor_form: '761.png',
  impostor_peeking_center_vent: false,
  mask_on: false,
  door_hacked_side: null,
  toy_bonnie_active: false,
  toy_bonnie_timer: 0,
  bonnet_active: false,
  bonnet_timer: 0,
  lolbit_active: false,
  lolbit_timer: 0,
};

const initialProgress: GameProgress = {
  current_night: 1,
  stars_unlocked: 0,
  total_nights_completed: 0,
  total_deaths: 0,
};

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<GameScreen>('MENU');
  const [progress, setProgress] = useState<GameProgress>(initialProgress);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [activeTacticalAlert, setActiveTacticalAlert] = useState<(AIDecisionEvent | SpecialAudioEvent) | null>(null);
  const [jumpscareData, setJumpscareData] = useState<JumpscareEvent | null>(null);
  const [victoryData, setVictoryData] = useState<VictoryEvent | null>(null);
  const [currentCam, setCurrentCam] = useState<number>(1);

  const wsRef = useRef<WebSocket | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial game progress
  const refreshProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/game/progress');
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
      }
    } catch (err) {
      console.warn('Could not fetch game progress:', err);
    }
  }, []);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/game`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Auto reconnect after 2s
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (e) => {
      console.warn('WebSocket error:', e);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SHOCK_EVENT') {
          soundManager.playShock();
        } else if (msg.type === 'INITIAL_STATE' || msg.type === 'GAME_TICK') {
          if (msg.state) {
            setGameState((prev) => ({
              ...prev,
              ...msg.state,
            }));
          }

          // Process events
          if (msg.events && Array.isArray(msg.events)) {
            for (const ev of msg.events) {
              handleGameEvent(ev);
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Handle incoming events from the backend game loop
  const handleGameEvent = (ev: GameEvent) => {
    if (ev.type === 'HOUR_CHIME') {
      soundManager.playSound(ev.sound || 'blip.wav');
    } else if ((ev as any).type === 'ATTACK_BLOCKED') {
      // Animatronic crashed into closed door / vent: blockb.wav!
      soundManager.playSound('blockb.wav', { pan: (ev as any).stereo_pan ?? 0.0, volume: 1.15 });
      setActiveTacticalAlert(null);
    } else if ((ev as any).type === 'TEST_MODE_EVENT') {
      soundManager.playSound((ev as any).sound || 'blockb.wav');
    } else if ((ev as any).type === 'AI_DOOR_HACK') {
      soundManager.playSound('doorFX.wav');
      setActiveTacticalAlert({
        type: 'AI_TACTICAL_ACTION',
        action: 'ENTER_LEFT_DOOR',
        decision_id: 999,
        reason: (ev as any).message,
        sound: 'doorFX.wav',
        direction: (ev as any).side === 'left' ? 'left' : 'right',
        stereo_pan: (ev as any).side === 'left' ? -0.8 : 0.8,
        deadline_seconds: 6.5,
        message: (ev as any).message
      });
    } else if ((ev as any).type === 'AI_FAKE_DOOR') {
      soundManager.playSound('doorFX.wav');
    } else if ((ev as any).type === 'DOOR_UNHACKED') {
      soundManager.playSound('shock.wav');
      setActiveTacticalAlert(null);
    } else if ((ev as any).type === 'TOY_BONNIE_APPEAR') {
      soundManager.playSound('breathing.wav');
    } else if ((ev as any).type === 'TOY_BONNIE_LEAVE') {
      soundManager.playSound('pop.wav');
    } else if ((ev as any).type === 'BONNET_SPAWN') {
      soundManager.playSound('Bonnet02b.wav', { volume: 1.0 });
    } else if ((ev as any).type === 'BONNET_DEFUSED') {
      soundManager.playSound('pop.wav', { volume: 1.2 });
    } else if ((ev as any).type === 'LOLBIT_APPEAR') {
      soundManager.playSound('glitch1c.wav', { volume: 1.0 });
    } else if ((ev as any).type === 'LOLBIT_DEFUSED') {
      soundManager.playSound('blip.wav', { volume: 1.0 });
    } else if ((ev as any).type === 'LOLBIT_FAIL') {
      soundManager.playSound('glitch3c.wav', { volume: 1.1 });
    } else if (ev.type === 'SPECIAL_AUDIO_MOVE') {
      // Play the special audio (audio01.wav) with stereo panning!
      soundManager.playSpecialAudio(ev.sound, ev.stereo_pan);
      setActiveTacticalAlert(ev);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = setTimeout(() => {
        setActiveTacticalAlert(null);
      }, (ev.deadline_seconds || 3.5) * 1000);
    } else if (ev.type === 'AI_TACTICAL_ACTION') {
      // Play audio cue
      soundManager.playSound(ev.sound, { pan: ev.stereo_pan });
      setActiveTacticalAlert(ev);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = setTimeout(() => {
        setActiveTacticalAlert(null);
      }, (ev.deadline_seconds || 4) * 1000);
    } else if (ev.type === 'JUMPSCARE') {
      if (gameState.night_number === 0) {
        soundManager.playSound('blockb.wav');
        return; // ABSOLUTELY NEVER TRIGGER JUMPSCARE MODAL IN TEST MODE!
      }
      soundManager.playJumpscare(ev.sound || 'fnaf6scream.wav');
      setJumpscareData(ev);
      setActiveTacticalAlert(null);
      refreshProgress();
    } else if (ev.type === 'VICTORY') {
      soundManager.stopAmbience();
      soundManager.playSound('cameraflash.wav');
      setVictoryData(ev);
      setActiveTacticalAlert(null);
      refreshProgress();
    }
  };

  // Send telemetry update to WebSocket
  const sendTelemetry = useCallback((partialState: Partial<GameState>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TELEMETRY',
        telemetry: {
          left_door: partialState.left_door ?? gameState.left_door,
          right_door: partialState.right_door ?? gameState.right_door,
          right_vent: partialState.right_vent ?? gameState.right_vent,
          top_vent: partialState.top_vent ?? gameState.top_vent,
          flashlight: partialState.flashlight ?? gameState.flashlight,
          mask_on: partialState.mask_on ?? gameState.mask_on,
          pan_x: partialState.pan_x ?? gameState.pan_x,
          looking_at_monitor: partialState.looking_at_monitor ?? gameState.looking_at_monitor,
        }
      }));
    }
  }, [gameState]);

  // Control Actions
  const toggleLeftDoor = useCallback(() => {
    if (gameState.door_hacked_side === 'left') {
      soundManager.playSound('doorFX.wav');
      return; // Blocked by AI Door Hack
    }
    const nextVal = !gameState.left_door;
    setGameState((prev) => ({ ...prev, left_door: nextVal }));
    soundManager.playDoorThud();
    sendTelemetry({ left_door: nextVal });
  }, [gameState.door_hacked_side, gameState.left_door, sendTelemetry]);

  const toggleRightDoor = useCallback(() => {
    if (gameState.door_hacked_side === 'right') {
      soundManager.playSound('doorFX.wav');
      return; // Blocked by AI Door Hack
    }
    const nextVal = !gameState.right_door;
    setGameState((prev) => ({ ...prev, right_door: nextVal }));
    soundManager.playDoorThud();
    sendTelemetry({ right_door: nextVal });
  }, [gameState.door_hacked_side, gameState.right_door, sendTelemetry]);

  const toggleRightVent = useCallback(() => {
    const nextVal = !gameState.right_vent;
    setGameState((prev) => ({ ...prev, right_vent: nextVal }));
    soundManager.playVentBang();
    sendTelemetry({ right_vent: nextVal });
  }, [gameState.right_vent, sendTelemetry]);

  const toggleTopVent = useCallback(() => {
    const nextVal = !gameState.top_vent;
    setGameState((prev) => ({ ...prev, top_vent: nextVal }));
    soundManager.playVentBang();
    sendTelemetry({ top_vent: nextVal });
  }, [gameState.top_vent, sendTelemetry]);

  const triggerShock = useCallback(() => {
    if (gameState.shock_cooldown_left && gameState.shock_cooldown_left > 0) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      soundManager.playShock();
      wsRef.current.send(JSON.stringify({ type: 'CONTROLLED_SHOCK' }));
    }
  }, [gameState.shock_cooldown_left]);

  const toggleMask = useCallback(() => {
    if (gameState.looking_at_monitor) return;
    const nextVal = !gameState.mask_on;
    setGameState((prev) => ({
      ...prev,
      mask_on: nextVal,
      flashlight: nextVal ? false : prev.flashlight,
    }));
    if (nextVal) {
      soundManager.playSound('maskon.wav', { volume: 0.9 });
    } else {
      soundManager.playSound('maskoff.wav', { volume: 0.9 });
    }
    sendTelemetry({ mask_on: nextVal, flashlight: nextVal ? false : gameState.flashlight });
  }, [gameState.looking_at_monitor, gameState.mask_on, gameState.flashlight, sendTelemetry]);

  const setMask = useCallback((val: boolean) => {
    if (gameState.looking_at_monitor && val) return;
    setGameState((prev) => ({
      ...prev,
      mask_on: val,
      flashlight: val ? false : prev.flashlight,
    }));
    if (val) {
      soundManager.playSound('maskon.wav', { volume: 0.9 });
    } else {
      soundManager.playSound('maskoff.wav', { volume: 0.9 });
    }
    sendTelemetry({ mask_on: val, flashlight: val ? false : gameState.flashlight });
  }, [gameState.looking_at_monitor, gameState.flashlight, sendTelemetry]);

  const defuseBonnet = useCallback(() => {
    soundManager.playSound('pop.wav', { volume: 1.2 });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEFUSE_BONNET' }));
    }
    setGameState((prev) => ({ ...prev, bonnet_active: false }));
  }, []);

  const defuseLolbit = useCallback(() => {
    soundManager.playSound('blip.wav', { volume: 1.0 });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEFUSE_LOLBIT' }));
    }
    setGameState((prev) => ({ ...prev, lolbit_active: false }));
  }, []);

  const toggleMonitor = useCallback(() => {
    const nextVal = !gameState.looking_at_monitor;
    setGameState((prev) => ({ ...prev, looking_at_monitor: nextVal }));
    soundManager.playCameraFlip();
    sendTelemetry({ looking_at_monitor: nextVal });
  }, [gameState.looking_at_monitor, sendTelemetry]);

  const setMonitor = useCallback((val: boolean) => {
    setGameState((prev) => ({ ...prev, looking_at_monitor: val }));
    soundManager.playCameraFlip();
    sendTelemetry({ looking_at_monitor: val });
  }, [sendTelemetry]);

  const toggleFlashlight = useCallback(() => {
    const nextVal = !gameState.flashlight;
    setGameState((prev) => ({ ...prev, flashlight: nextVal }));
    sendTelemetry({ flashlight: nextVal });
  }, [gameState.flashlight, sendTelemetry]);

  const setFlashlight = useCallback((val: boolean) => {
    setGameState((prev) => ({ ...prev, flashlight: val }));
    sendTelemetry({ flashlight: val });
  }, [sendTelemetry]);

  const setPanX = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setGameState((prev) => ({ ...prev, pan_x: clamped }));
    sendTelemetry({ pan_x: clamped });
  }, [sendTelemetry]);

  const sendReaction = useCallback((action: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REACTION',
        action
      }));
    }
  }, []);

  const startNight = async (nightToStart?: number) => {
    const targetNight = typeof nightToStart === 'number' ? nightToStart : (progress.current_night || 1);
    soundManager.playBlip();
    setJumpscareData(null);
    setVictoryData(null);
    setActiveTacticalAlert(null);
    setGameState((prev) => ({
      ...prev,
      night_number: targetNight,
      is_game_over: false,
      is_victory: false,
      is_active: true,
      power: 100,
    }));
    setScreen('NIGHT_INTRO');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'START_NIGHT', night: targetNight }));
    }

    try {
      await fetch('/api/game/start-night', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ night_number: targetNight })
      });

      // Brief 12:00 AM black screen transition like authentic FNAF
      setTimeout(() => {
        soundManager.startAmbience();
        setScreen('OFFICE');
      }, 2500);
    } catch (e) {
      console.error('Error starting night:', e);
    }
  };

  const returnToMenu = () => {
    soundManager.stopAmbience();
    soundManager.playBlip();
    setJumpscareData(null);
    setVictoryData(null);
    setActiveTacticalAlert(null);
    setScreen('MENU');
    refreshProgress();
  };

  const resetProgress = async () => {
    try {
      await fetch('/api/game/reset', { method: 'POST' });
      await refreshProgress();
      soundManager.playSound('cameraflash.wav');
    } catch (e) {
      console.error('Error resetting progress:', e);
    }
  };

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        progress,
        gameState,
        wsConnected,
        activeTacticalAlert,
        jumpscareData,
        victoryData,
        startNight,
        returnToMenu,
        resetProgress,
        toggleLeftDoor,
        toggleRightDoor,
        toggleRightVent,
        toggleTopVent,
        triggerShock,
        toggleMonitor,
        setMonitor,
        currentCam,
        setCurrentCam,
        toggleFlashlight,
        setFlashlight,
        toggleMask,
        setMask,
        defuseBonnet,
        defuseLolbit,
        setPanX,
        sendReaction,
        refreshProgress
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
