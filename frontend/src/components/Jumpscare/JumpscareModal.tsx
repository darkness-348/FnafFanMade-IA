import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { RotateCcw, ArrowLeft, Activity, Skull } from 'lucide-react';

const JUMPSCARE_FRAMES = [
  '/assets/textures/85a.png',
  '/assets/textures/85b.png',
  '/assets/textures/85c.png',
  '/assets/textures/85d.png',
  '/assets/textures/85e.png',
  '/assets/textures/85f.png',
  '/assets/textures/86a.png',
  '/assets/textures/86c.png',
];

export const JumpscareModal: React.FC = () => {
  const { jumpscareData, startNight, returnToMenu, setScreen, gameState } = useGame();
  const [frameIndex, setFrameIndex] = useState(0);
  const [phase, setPhase] = useState<'ANIMATION' | 'STATIC_MENU'>('ANIMATION');

  useEffect(() => {
    if (!jumpscareData) {
      setPhase('ANIMATION');
      setFrameIndex(0);
      return;
    }

    setPhase('ANIMATION');
    let frame = 0;
    // Rapid 20 FPS jumpscare sequence animation
    const interval = setInterval(() => {
      frame = (frame + 1) % JUMPSCARE_FRAMES.length;
      setFrameIndex(frame);
    }, 55);

    // After 1.7 seconds, cut to Game Over screen
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPhase('STATIC_MENU');
    }, 1700);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [jumpscareData]);

  if (!jumpscareData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none font-mono">
      <CrtOverlay intensity="heavy" />

      {/* PHASE 1: FULLSCREEN ANIMATED JUMPSCARE */}
      {phase === 'ANIMATION' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {/* Rapid Red / White Flash */}
          <div className="absolute inset-0 bg-red-600/30 mix-blend-screen animate-pulse pointer-events-none" />

          {/* Animated Fredbear Jumpscare Frame */}
          <img
            src={JUMPSCARE_FRAMES[frameIndex]}
            alt="Jumpscare"
            className="w-full h-full object-cover object-center filter contrast-150 brightness-110 scale-110 animate-bounce"
            style={{
              transform: `scale(${1.15 + (frameIndex % 3) * 0.05}) translate(${(frameIndex % 2 === 0 ? 8 : -8)}px, ${(frameIndex % 3 === 0 ? -6 : 6)}px)`
            }}
          />

          {/* Glitch Static Layer */}
          <div className="absolute inset-0 bg-red-950/20 mix-blend-overlay pointer-events-none" />
        </div>
      )}

      {/* PHASE 2: STATIC GAME OVER AUDIT SCREEN */}
      {phase === 'STATIC_MENU' && (
        <div className="relative z-20 max-w-lg w-full mx-4 p-8 bg-neutral-950/95 border-2 border-red-700/80 rounded-xl shadow-[0_0_60px_rgba(239,68,68,0.6)] text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center animate-bounce">
            <Skull className="w-9 h-9 text-red-500" />
          </div>

          <div>
            <h2 className="text-4xl md:text-5xl font-black text-red-500 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
              GAME OVER
            </h2>
            <p className="text-sm text-neutral-400 mt-2">
              FUISTE ATRAPADO POR LA GUARDIA NOCTURNA
            </p>
          </div>

          <div className="bg-neutral-900/80 p-4 rounded-lg border border-neutral-800 text-left space-y-1.5">
            <div className="text-xs text-neutral-500 uppercase font-bold">Registro de Fatalidad:</div>
            <div className="text-sm font-bold text-white">{jumpscareData.killer}</div>
            <div className="text-xs text-red-400">{jumpscareData.cause}</div>
            <div className="text-[11px] text-neutral-400 border-t border-neutral-800 pt-2 mt-2">
              La IA adaptativa aprovechó tu ventana de vulnerabilidad.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={() => startNight(gameState.night_number)}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-sm tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-900/40"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reintentar Noche {gameState.night_number}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScreen('DASHBOARD')}
                className="py-2.5 bg-purple-950/70 hover:bg-purple-900/70 border border-purple-700 text-purple-200 rounded text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Ver Auditoría IA</span>
              </button>

              <button
                onClick={returnToMenu}
                className="py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Menú Principal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
