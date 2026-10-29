import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { CameraMonitor } from './CameraMonitor';
import {
  Flashlight, Activity, ArrowLeft,
  Volume2, VolumeX, AlertTriangle, Zap, ExternalLink, Sparkles
} from 'lucide-react';
import { soundManager } from '../../sound/soundManager';

interface ShadowThreat {
  xPct: number; // 0 to 100 within office width
  yPct: number; // 0 to 100 within office height
  vx: number;
  progress: number; // 0 to 100 tracked
  deadline: number; // seconds left
}

const MASK_FRAMES = [
  '2d4.png', '2d5.png', '2d6.png', '2d7.png', '2d8.png', '2d9.png', '2da.png'
];

const TOY_BONNIE_FRAMES = [
  '2cb.png', '2dc.png', '2de.png', '2df.png',
  '2e0.png', '2e1.png', '2e2.png', '2e3.png',
  '2e4.png', '2e5.png', '2e7.png'
];

const BONNET_FRAMES = [
  '7f6.png', '7f7.png', '7f8.png', '7f9.png',
  '7fa.png', '7fb.png', '7fc.png', '7fd.png',
  '7fe.png', '7ff.png'
];

export const OfficeView: React.FC = () => {
  const {
    gameState,
    toggleLeftDoor,
    toggleRightDoor,
    toggleRightVent,
    toggleTopVent,
    triggerShock,
    toggleMonitor,
    toggleFlashlight,
    setFlashlight,
    toggleMask,
    defuseBonnet,
    defuseLolbit,
    setPanX,
    activeTacticalAlert,
    returnToMenu,
  } = useGame();

  const containerRef = useRef<HTMLDivElement>(null);
  const [panProgress, setPanProgress] = useState(0.5); // 0.0 left to 1.0 right
  const [isMuted, setIsMuted] = useState(soundManager.getIsMuted());
  const [shockVisual, setShockVisual] = useState(false);

  // Mask frame animation state (-1 = off, 0..6 = frames)
  const [maskFrame, setMaskFrame] = useState<number>(-1);

  // Bonnet walking frame index
  const [bonnetTick, setBonnetTick] = useState<number>(0);

  // Lolbit keystrokes tracking
  const [lolbitLetters, setLolbitLetters] = useState<string>('');

  // Interactive Shadow Threat when REQUIRE_FLASHLIGHT is active (Asset: 6f6.png)
  const [shadow, setShadow] = useState<ShadowThreat | null>(null);

  // 1. Freddy Mask Animation sequence (2d4.png down to 2da.png)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (gameState.mask_on) {
      // Lower mask down
      timer = setInterval(() => {
        setMaskFrame((prev) => {
          if (prev >= MASK_FRAMES.length - 1) {
            if (timer) clearInterval(timer);
            return MASK_FRAMES.length - 1;
          }
          return prev + 1;
        });
      }, 34);
    } else {
      // Raise mask off
      timer = setInterval(() => {
        setMaskFrame((prev) => {
          if (prev <= 0) {
            if (timer) clearInterval(timer);
            return -1;
          }
          return prev - 1;
        });
      }, 34);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameState.mask_on]);

  // 2. Bonnet walking frame cycle
  useEffect(() => {
    if (!gameState.bonnet_active) return;
    const interval = setInterval(() => {
      setBonnetTick((prev) => (prev + 1) % BONNET_FRAMES.length);
    }, 120);
    return () => clearInterval(interval);
  }, [gameState.bonnet_active]);

  // 3. Lolbit keyboard listener: Type 'L' -> 'O' -> 'L'
  useEffect(() => {
    if (!gameState.lolbit_active) {
      setLolbitLetters('');
      return;
    }
    const handleLolbitKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'l' && (lolbitLetters === '' || lolbitLetters === 'lo')) {
        const next = lolbitLetters + 'l';
        setLolbitLetters(next);
        soundManager.playSound('blip.wav');
        if (next === 'lol') {
          defuseLolbit();
        }
      } else if (k === 'o' && lolbitLetters === 'l') {
        setLolbitLetters('lo');
        soundManager.playSound('blip.wav');
      }
    };
    window.addEventListener('keydown', handleLolbitKey);
    return () => window.removeEventListener('keydown', handleLolbitKey);
  }, [gameState.lolbit_active, lolbitLetters, defuseLolbit]);

  // 4. Spawn shadow (6f6.png) when REQUIRE_FLASHLIGHT is dispatched
  useEffect(() => {
    if (activeTacticalAlert && 'action' in activeTacticalAlert && activeTacticalAlert.action === 'REQUIRE_FLASHLIGHT') {
      setShadow({
        xPct: 45 + Math.random() * 12,
        yPct: 48 + Math.random() * 12,
        vx: (Math.random() > 0.5 ? 1 : -1) * 0.18,
        progress: 0,
        deadline: activeTacticalAlert.deadline_seconds || 5.0,
      });
    }
  }, [activeTacticalAlert]);

  // 5. Shadow movement & flashlight illumination tracker loop
  useEffect(() => {
    if (!shadow) return;

    const interval = setInterval(() => {
      setShadow((prev) => {
        if (!prev) return null;

        // Move shadow slowly horizontally
        let nextX = prev.xPct + prev.vx;
        let nextVx = prev.vx;
        if (nextX < 28 || nextX > 72) {
          nextVx = -nextVx;
        }

        // Check if player's flashlight is shining on the shadow
        const currentOfficeCenterPct = panProgress * 100;
        const distFromCenter = Math.abs(currentOfficeCenterPct - prev.xPct);

        let newProgress = prev.progress;
        if (gameState.flashlight && distFromCenter < 24) {
          // Player is illuminating the 6f6.png shadow with flashlight!
          newProgress = Math.min(100, prev.progress + 7);
        } else {
          newProgress = Math.max(0, prev.progress - 2);
        }

        // Shadow successfully repelled!
        if (newProgress >= 100) {
          soundManager.playSound('breathing.wav', { volume: 0.6 });
          return null;
        }

        return {
          ...prev,
          xPct: nextX,
          vx: nextVx,
          progress: newProgress,
          deadline: prev.deadline - 0.1,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [shadow, gameState.flashlight, panProgress]);

  // Mouse pan tracker optimized for 1920 x 1080
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState.looking_at_monitor) return; // Don't pan while looking at cams

    const { clientX } = e;
    const { innerWidth } = window;
    const rawRatio = clientX / innerWidth;
    let targetPan = rawRatio;

    // Smooth responsive edge curve
    if (rawRatio < 0.28) {
      targetPan = Math.max(0, rawRatio * 1.15);
    } else if (rawRatio > 0.72) {
      targetPan = Math.min(1, 0.72 + (rawRatio - 0.72) * 1.15);
    }

    setPanProgress(targetPan);
    setPanX(targetPan);
  }, [setPanX, gameState.looking_at_monitor]);

  // Keyboard controls hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (key === ' ') {
        e.preventDefault();
        toggleMask();
      } else if (key === 'a' || key === 'q') {
        toggleLeftDoor();
      } else if (key === 'd') {
        toggleRightDoor();
      } else if (key === 'f') {
        toggleRightVent();
      } else if (key === 'w') {
        toggleTopVent();
      } else if (key === 's') {
        toggleMonitor(); // [S] flips camera monitor up/down!
      } else if (key === 'e') {
        handleTriggerShock();
      } else if (key === 'control' || key === 'z') {
        setFlashlight(true);
      } else if (key === 'escape') {
        returnToMenu();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'control' || key === 'z') {
        setFlashlight(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleLeftDoor, toggleRightDoor, toggleRightVent, toggleTopVent, toggleMonitor, toggleMask, setFlashlight, returnToMenu]);

  const handleTriggerShock = () => {
    if (gameState.shock_cooldown_left && gameState.shock_cooldown_left > 0) return;
    triggerShock();
    setShockVisual(true);
    setTimeout(() => setShockVisual(false), 450);
  };

  const openDashboardInNewWindow = () => {
    soundManager.playBlip();
    window.open('/#/dashboard', '_blank', 'width=1280,height=850,menubar=no,toolbar=no,location=no');
  };

  // Office width calculation for horizontal translation (native 2500 x 1080)
  const imageAspectWidth = 'calc((2500 / 1080) * 100vh)';

  // Calculate Toy Bonnie progress (0.0 to 1.0)
  const tbProgress = Math.max(0, Math.min(1, 1 - (gameState.toy_bonnie_timer ?? 4.5) / 4.5));
  const tbFrameIdx = Math.min(TOY_BONNIE_FRAMES.length - 1, Math.floor(tbProgress * TOY_BONNIE_FRAMES.length));
  const tbLeftPct = 78 - tbProgress * 54;

  // Calculate Bonnet progress (0.0 to 1.0)
  const bonnetProgress = Math.max(0, Math.min(1, 1 - (gameState.bonnet_timer ?? 5.5) / 5.5));
  const bonnetLeftPct = 92 - bonnetProgress * 84;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-screen h-screen overflow-hidden bg-black select-none font-mono cursor-crosshair"
    >
      {/* Shock Electric Visual Flash */}
      {shockVisual && (
        <div className="absolute inset-0 z-50 bg-cyan-400/40 mix-blend-screen pointer-events-none animate-pulse flex items-center justify-center">
          <div className="text-3xl font-black text-cyan-200 tracking-widest uppercase drop-shadow-[0_0_20px_#06b6d4]">
            ⚡ DESCARGA ELÉCTRICA ENVIADA A LA IA ⚡
          </div>
        </div>
      )}

      {/* 1. Office Panorama Image Container */}
      <div
        className="absolute top-0 left-0 h-full transition-transform duration-75 ease-out will-change-transform"
        style={{
          width: imageAspectWidth,
          transform: `translateX(calc(-1 * (${panProgress} * (${imageAspectWidth} - 100vw))))`,
        }}
      >
        {/* Background Texture: 5ca.png */}
        <img
          src="/assets/textures/5ca.png"
          alt="Office Panorama"
          className="w-full h-full object-cover object-left-top pointer-events-none select-none brightness-90"
        />

        {/* Dynamic Darkness Layer */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 pointer-events-none ${
            gameState.flashlight ? 'opacity-35 bg-black/35' : 'opacity-80 bg-black/80'
          }`}
        />

        {/* Flashlight Spotlight Cone */}
        {gameState.flashlight && !gameState.mask_on && (
          <div
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: `radial-gradient(circle 420px at ${panProgress * 100}% 52%, rgba(255, 255, 230, 0.9) 0%, rgba(240, 240, 200, 0.45) 45%, transparent 75%)`
            }}
          />
        )}

        {/* --- LEFT DOOR (f7.png) --- */}
        <div
          className="absolute pointer-events-auto"
          style={{
            left: '8.5%',
            top: '25.5%',
            width: '8.4%',
            height: '64.5%',
          }}
        >
          {/* AI Door Hack Warning Banner */}
          {gameState.door_hacked_side === 'left' && (
            <div className="absolute -top-12 inset-x-0 z-30 bg-red-950/95 border-2 border-red-500 rounded p-1 shadow-[0_0_20px_#ef4444] animate-pulse flex flex-col items-center">
              <span className="text-[10px] font-black text-red-200 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400 animate-spin" />
                ¡IA FORZÓ PUERTA!
              </span>
              <span className="text-[9px] font-bold text-yellow-300 font-mono">
                USA SHOCK [E]
              </span>
            </div>
          )}

          {gameState.left_door && gameState.door_hacked_side !== 'left' && (
            <img
              src="/assets/textures/f7.png"
              alt="Puerta Izquierda Cerrada"
              className="w-full h-full object-contain object-top drop-shadow-[0_0_25px_rgba(255,0,0,0.4)] animate-in slide-in-from-top duration-200"
            />
          )}

          <button
            onClick={toggleLeftDoor}
            className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              gameState.door_hacked_side === 'left'
                ? 'bg-red-950 text-red-400 border-red-600 animate-pulse'
                : gameState.left_door
                ? 'bg-red-600/90 text-white border-red-500 shadow-red-900/50'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>{gameState.door_hacked_side === 'left' ? 'BLOQUEADA' : 'PUERTA [A]'}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                gameState.door_hacked_side === 'left'
                  ? 'bg-red-500 animate-ping'
                  : gameState.left_door
                  ? 'bg-red-400 shadow-[0_0_6px_#ef4444]'
                  : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
              }`}
            />
          </button>
        </div>

        {/* --- RIGHT DOOR (10e.png) --- */}
        <div
          className="absolute pointer-events-auto"
          style={{
            left: '81.2%',
            top: '25.5%',
            width: '8.4%',
            height: '64.5%',
          }}
        >
          {/* AI Door Hack Warning Banner */}
          {gameState.door_hacked_side === 'right' && (
            <div className="absolute -top-12 inset-x-0 z-30 bg-red-950/95 border-2 border-red-500 rounded p-1 shadow-[0_0_20px_#ef4444] animate-pulse flex flex-col items-center">
              <span className="text-[10px] font-black text-red-200 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400 animate-spin" />
                ¡IA FORZÓ PUERTA!
              </span>
              <span className="text-[9px] font-bold text-yellow-300 font-mono">
                USA SHOCK [E]
              </span>
            </div>
          )}

          {gameState.right_door && gameState.door_hacked_side !== 'right' && (
            <img
              src="/assets/textures/10e.png"
              alt="Puerta Derecha Cerrada"
              className="w-full h-full object-contain object-top drop-shadow-[0_0_25px_rgba(255,0,0,0.4)] animate-in slide-in-from-top duration-200"
            />
          )}

          <button
            onClick={toggleRightDoor}
            className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              gameState.door_hacked_side === 'right'
                ? 'bg-red-950 text-red-400 border-red-600 animate-pulse'
                : gameState.right_door
                ? 'bg-red-600/90 text-white border-red-500 shadow-red-900/50'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>{gameState.door_hacked_side === 'right' ? 'BLOQUEADA' : 'PUERTA [D]'}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                gameState.door_hacked_side === 'right'
                  ? 'bg-red-500 animate-ping'
                  : gameState.right_door
                  ? 'bg-red-400 shadow-[0_0_6px_#ef4444]'
                  : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
              }`}
            />
          </button>
        </div>

        {/* --- TOP CENTER VENT (16a.png) + CENTER VENT KILLER (2cc.png) --- */}
        <div
          className="absolute pointer-events-auto"
          style={{
            left: '36.4%',
            top: '14.2%',
            width: '10.8%',
            height: '14.5%',
          }}
        >
          {/* Central Vent Killer Peeking: 2cc.png (1.2s to slam [W]!) */}
          {gameState.impostor_peeking_center_vent && !gameState.top_vent && (
            <div className="absolute inset-0 flex items-center justify-center animate-bounce z-10">
              <img
                src="/assets/textures/2cc.png"
                alt="Animatrónico en Conducto Superior"
                className="w-full h-full object-contain filter drop-shadow-[0_0_20px_#ef4444] brightness-110"
              />
            </div>
          )}

          {/* Authentic Top Vent Cover: 16a.png */}
          {gameState.top_vent && (
            <img
              src="/assets/textures/16a.png"
              alt="Conducto Superior Cerrado"
              className="w-full h-full object-contain object-top drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-in slide-in-from-top duration-150 z-20"
            />
          )}

          <button
            onClick={toggleTopVent}
            className={`absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              gameState.top_vent
                ? 'bg-yellow-600/90 text-white border-yellow-400 shadow-yellow-900/50'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>VENT [W]</span>
            <span className={`w-1.5 h-1.5 rounded-full ${gameState.top_vent ? 'bg-yellow-400' : 'bg-neutral-500'}`} />
          </button>
        </div>

        {/* --- RIGHT VENT / ESCOTILLA DERECHA (17e.png) --- */}
        <div
          className="absolute pointer-events-auto"
          style={{
            left: '90.0%',
            top: '72.8%',
            width: '9.2%',
            height: '25.6%',
          }}
        >
          {gameState.right_vent && (
            <img
              src="/assets/textures/17e.png"
              alt="Escotilla Derecha Sellada"
              className="w-full h-full object-contain object-top drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-in slide-in-from-top duration-200"
            />
          )}

          <button
            onClick={toggleRightVent}
            className={`absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-lg backdrop-blur-md border ${
              gameState.right_vent
                ? 'bg-cyan-600/90 text-white border-cyan-400 shadow-cyan-900/50'
                : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>VENT [F]</span>
            <span className={`w-1.5 h-1.5 rounded-full ${gameState.right_vent ? 'bg-cyan-400' : 'bg-neutral-500'}`} />
          </button>
        </div>

        {/* --- TASER / CONTROLLED SHOCK DEVICE (58b.png) --- */}
        <div
          className="absolute pointer-events-auto"
          style={{
            left: '56.0%',
            top: '67.0%',
            width: '5.2%',
            height: '18.5%',
          }}
        >
          <div
            onClick={handleTriggerShock}
            className="relative w-full h-full cursor-pointer group transition-transform hover:scale-105"
            title="Shock Eléctrico para reiniciar a la IA [E] (Cooldown 30s)"
          >
            <img
              src="/assets/textures/58b.png"
              alt="Taser Shock Device"
              className={`w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] ${
                gameState.shock_cooldown_left && gameState.shock_cooldown_left > 0 ? 'opacity-40 grayscale' : 'opacity-100 animate-pulse'
              }`}
            />

            {gameState.shock_cooldown_left && gameState.shock_cooldown_left > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
                <span className="text-xs font-black text-yellow-400 font-mono">
                  {Math.ceil(gameState.shock_cooldown_left)}s
                </span>
              </div>
            ) : (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-yellow-950/80 border border-yellow-500 text-[10px] text-yellow-300 font-bold whitespace-nowrap">
                SHOCK [E]
              </div>
            )}
          </div>
        </div>

        {/* --- TOY BONNIE IN OFFICE (2cb.png .. 2e7.png) --- */}
        {gameState.toy_bonnie_active && (
          <div
            className="absolute pointer-events-none transition-all duration-100 ease-linear z-25"
            style={{
              left: `${tbLeftPct}%`,
              top: '38%',
              width: '18%',
              height: '52%',
            }}
          >
            <img
              src={`/assets/textures/${TOY_BONNIE_FRAMES[tbFrameIdx]}`}
              alt="Toy Bonnie"
              className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(59,130,246,0.7)] brightness-95"
            />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-950/90 border border-blue-400 px-2.5 py-0.5 rounded text-[10px] text-blue-200 font-black tracking-widest whitespace-nowrap animate-pulse shadow-lg">
              🐰 TOY BONNIE - ¡MÁSCARA [ESPACIO]!
            </div>
          </div>
        )}

        {/* --- INTERACTIVE SHADOW ENTITY: 6f6.png (Flashlight Tracking) --- */}
        {shadow && (
          <div
            className="absolute pointer-events-none transition-all duration-100 ease-out z-30"
            style={{
              left: `${shadow.xPct}%`,
              top: `${shadow.yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="relative flex flex-col items-center">
              <div
                className="w-36 h-72 flex items-center justify-center filter drop-shadow-[0_0_25px_rgba(0,0,0,0.95)]"
                style={{
                  opacity: Math.max(0.25, 1 - shadow.progress / 110),
                }}
              >
                <img
                  src="/assets/textures/6f6.png"
                  alt="Shadow Entity"
                  className="max-w-full max-h-full object-contain filter brightness-75 contrast-125"
                />
              </div>

              {/* Progress Bar of Flashlight Tracking */}
              <div className="mt-2 w-36 bg-black/85 p-1 rounded border border-purple-500 flex flex-col items-center gap-1 backdrop-blur-md">
                <span className="text-[9px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  DISIPANDO: {Math.round(shadow.progress)}%
                </span>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-yellow-400 transition-all duration-100"
                    style={{ width: `${shadow.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- BONNET NOSE CLICK CHALLENGE (7f6.png - 7ff.png) --- */}
      {gameState.bonnet_active && (
        <div
          className="absolute z-40 transition-all duration-100 ease-linear pointer-events-auto"
          style={{
            left: `${bonnetLeftPct}%`,
            bottom: '12%',
            width: '180px',
            height: '180px',
          }}
        >
          <div
            onClick={defuseBonnet}
            className="relative w-full h-full cursor-pointer group select-none"
            title="¡Haz clic en mi nariz!"
          >
            <img
              src={`/assets/textures/${BONNET_FRAMES[bonnetTick]}`}
              alt="Bonnet"
              className="w-full h-full object-contain filter drop-shadow-[0_0_25px_rgba(244,114,182,0.9)] transition-transform group-hover:scale-105"
            />
            {/* Clickable Nose Target Button (Glowing Hotspot) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                defuseBonnet();
              }}
              className="absolute top-[48%] left-[46%] w-7 h-7 rounded-full bg-pink-500/80 hover:bg-pink-400 border-2 border-white shadow-[0_0_15px_#ec4899] animate-ping hover:animate-none cursor-pointer flex items-center justify-center"
              title="¡CLICK AQUÍ EN LA NARIZ!"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
            </button>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-pink-950/90 border border-pink-400 px-2.5 py-0.5 rounded text-[10px] text-pink-200 font-black tracking-widest whitespace-nowrap shadow-lg animate-bounce">
              🎀 ¡TOCA MI NARIZ!
            </div>
          </div>
        </div>
      )}

      {/* --- LOLBIT INTERRUPT MODAL (7ec.png - TYPE 'LOL') --- */}
      {gameState.lolbit_active && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center select-none">
          {/* TV scanlines background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-60" />

          <div className="relative z-10 flex flex-col items-center gap-5 p-8 bg-neutral-950/95 border-2 border-purple-500 rounded-2xl shadow-[0_0_60px_rgba(168,85,247,0.8)] animate-in zoom-in-95 duration-150 max-w-lg w-full mx-4">
            {/* Asset: 7ec.png (PLEASE STAND BY) */}
            <div className="w-full overflow-hidden rounded border border-neutral-700 shadow-2xl flex items-center justify-center bg-black">
              <img
                src="/assets/textures/7ec.png"
                alt="PLEASE STAND BY - LOLBIT"
                className="w-full h-auto object-contain brightness-110"
              />
            </div>

            <div className="text-center">
              <h2 className="text-xl font-black text-purple-300 uppercase tracking-widest flex items-center justify-center gap-2">
                <span>📺 INTERRUPCIÓN DE LOLBIT</span>
              </h2>
              <p className="text-xs text-neutral-300 font-bold mt-1">
                ¡ESCRIBE <span className="text-yellow-400 font-mono tracking-widest font-black text-sm">"LOL"</span> EN TU TECLADO EN MENOS DE 2 SEGUNDOS!
              </p>
            </div>

            {/* 2.0s Timer Countdown Bar */}
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-purple-700/50">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 transition-all duration-100 ease-linear"
                style={{ width: `${Math.max(0, ((gameState.lolbit_timer ?? 2.0) / 2.0) * 100)}%` }}
              />
            </div>

            {/* Interactive Letter Display */}
            <div className="flex items-center gap-4">
              {['l', 'o', 'l'].map((expectedChar, idx) => {
                const isTyped = lolbitLetters.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-black font-mono transition-all duration-150 shadow-lg ${
                      isTyped
                        ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300 shadow-[0_0_18px_#10b981] scale-105'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    {expectedChar.toUpperCase()}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
              TIEMPO RESTANTE: <span className="text-yellow-400 font-mono font-black">{Math.max(0, gameState.lolbit_timer ?? 2.0).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* --- FREDDY MASK OVERLAY SEQUENCE (2d4.png - 2da.png) --- */}
      {maskFrame >= 0 && (
        <div className="fixed inset-0 z-45 pointer-events-none flex items-center justify-center select-none">
          <img
            src={`/assets/textures/${MASK_FRAMES[maskFrame]}`}
            alt="Máscara de Freddy"
            className="w-full h-full object-cover select-none brightness-95"
          />
        </div>
      )}

      {/* 2. CRT Analog Overlay */}
      <CrtOverlay intensity="medium" />

      {/* 3. Camera Monitor Screen & Map Component */}
      <CameraMonitor />

      {/* 4. Bottom Hover Bars: Monitor Flip Bar (12c.png) & Freddy Mask Bar (2d3.png) */}
      <div className="absolute bottom-0 inset-x-0 z-40 flex items-end justify-center gap-16 pointer-events-none">
        {/* Monitor Bar: 12c.png */}
        <div
          onMouseEnter={() => {
            if (!gameState.looking_at_monitor && !gameState.mask_on) toggleMonitor();
          }}
          onClick={() => {
            if (!gameState.mask_on) toggleMonitor();
          }}
          className="pointer-events-auto cursor-pointer transition-transform hover:-translate-y-2 group flex flex-col items-center"
          title="Elevar / Bajar Monitor [S]"
        >
          <img
            src="/assets/textures/12c.png"
            alt="Flip Monitor Bar"
            className="h-10 object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.7)] group-hover:brightness-125"
          />
          <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            MONITOR [S]
          </div>
        </div>

        {/* Freddy Mask Bar: 2d3.png */}
        <div
          onMouseEnter={() => {
            if (!gameState.looking_at_monitor) toggleMask();
          }}
          onClick={() => {
            if (!gameState.looking_at_monitor) toggleMask();
          }}
          className="pointer-events-auto cursor-pointer transition-transform hover:-translate-y-2 group flex flex-col items-center"
          title="Ponerse / Quitarse Máscara de Freddy [ESPACIO]"
        >
          <img
            src="/assets/textures/2d3.png"
            alt="Freddy Mask Bar"
            className="h-10 object-contain drop-shadow-[0_0_12px_rgba(239,68,68,0.7)] group-hover:brightness-125"
          />
          <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            MÁSCARA [ESPACIO]
          </div>
        </div>
      </div>

      {/* 5. Tactical Audio Alert Banner */}
      {activeTacticalAlert && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-950/90 backdrop-blur-md border-2 border-red-500 px-5 py-2.5 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.7)] flex items-center gap-3 animate-bounce">
          <AlertTriangle className="w-6 h-6 text-red-400 animate-spin" />
          <div>
            <div className="text-[11px] font-black text-red-300 uppercase tracking-widest flex items-center gap-2">
              <span>ALERTA DE AMENAZA</span>
              <span className="text-[9px] bg-red-800 px-1 py-0.5 rounded text-white font-mono">
                {activeTacticalAlert.direction.toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide">
              {activeTacticalAlert.message}
            </p>
          </div>
        </div>
      )}

      {/* 6. Top Right HUD: Clock & Night */}
      <div className="absolute top-5 right-6 z-30 flex flex-col items-end">
        {gameState.night_number === 0 && (
          <div className="mb-1 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <span>🛡️ MODO PRUEBA: INMORTAL</span>
          </div>
        )}
        <div className="text-3xl md:text-5xl font-black tracking-widest text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {gameState.current_hour}
        </div>
        <div className="text-xs font-bold text-neutral-400 tracking-wider">
          {gameState.night_number === 0 ? 'Modo Prueba' : gameState.night_number === 1 ? '1ra Noche' : `Noche ${gameState.night_number}`}
        </div>
      </div>

      {/* 7. Top Left HUD: Navigation & External Window Opener */}
      <div className="absolute top-5 left-6 z-30 flex items-center gap-2.5">
        <button
          onClick={returnToMenu}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-neutral-700 hover:border-neutral-400 rounded text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Menú</span>
        </button>

        <button
          onClick={openDashboardInNewWindow}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/80 backdrop-blur-md border border-purple-600 hover:border-purple-400 rounded text-xs text-purple-200 hover:text-white transition-all cursor-pointer shadow-lg shadow-purple-950/40"
          title="Abre la auditoría de la IA en una ventana independiente en vivo"
        >
          <Activity className="w-3.5 h-3.5 text-purple-400" />
          <span>Panel IA en Otra Ventana</span>
          <ExternalLink className="w-3 h-3 text-purple-300" />
        </button>

        <button
          onClick={() => {
            const m = soundManager.toggleMute();
            setIsMuted(m);
          }}
          className="p-1.5 bg-black/70 backdrop-blur-md border border-neutral-700 hover:border-neutral-400 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* 8. Bottom Left HUD: Power Meter */}
      <div className="absolute bottom-6 left-6 z-30 bg-black/80 backdrop-blur-md p-3 rounded-lg border border-neutral-800 shadow-2xl flex flex-col gap-1.5 min-w-[200px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Zap className={`w-3 h-3 ${gameState.power < 20 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`} />
            ENERGÍA
          </span>
          <span className={`text-base font-black ${
            gameState.power > 50 ? 'text-emerald-400' : gameState.power > 20 ? 'text-yellow-400' : 'text-red-500 animate-pulse'
          }`}>
            {Math.round(gameState.power)}%
          </span>
        </div>

        <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              gameState.power > 50 ? 'bg-emerald-500' : gameState.power > 20 ? 'bg-yellow-500' : 'bg-red-600'
            }`}
            style={{ width: `${Math.max(0, gameState.power)}%` }}
          />
        </div>

        <div className="flex items-center gap-1 pt-0.5">
          <span className="text-[9px] text-neutral-500 font-bold uppercase">USO:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((bar) => {
              const active = bar <= gameState.usage_bars;
              return (
                <div
                  key={bar}
                  className={`w-3 h-3 rounded-sm transition-colors ${
                    active
                      ? bar <= 2
                        ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]'
                        : bar <= 4
                        ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]'
                        : 'bg-red-500 shadow-[0_0_5px_#ef4444]'
                      : 'bg-neutral-800/80'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 9. Bottom Center: Flashlight Button */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
        <button
          onClick={toggleFlashlight}
          className={`flex items-center gap-2 px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-xl border ${
            gameState.flashlight
              ? 'bg-yellow-400 text-black border-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.8)] scale-105'
              : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:border-neutral-400'
          }`}
        >
          <Flashlight className="w-4 h-4" />
          <span>LINTERNA [CTRL / Z]</span>
        </button>
      </div>

      {/* 10. Bottom Right: Pan Orientation Indicator */}
      <div className="absolute bottom-6 right-6 z-30 text-right">
        <div className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase">
          VISTA 1920 x 1080
        </div>
        <div className="text-xs text-cyan-400 font-bold">
          {panProgress < 0.35 ? '◄ MIRANDO IZQUIERDA' : panProgress > 0.65 ? 'MIRANDO DERECHA ►' : '■ CENTRO OFICINA'}
        </div>
      </div>
    </div>
  );
};
