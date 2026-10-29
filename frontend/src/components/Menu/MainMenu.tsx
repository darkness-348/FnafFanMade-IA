import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { Star, Play, RotateCcw, Activity, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../../sound/soundManager';

export const MainMenu: React.FC = () => {
  const { progress, startNight, resetProgress, setScreen } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.getIsMuted());

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleStartContinue = () => {
    startNight(progress.current_night || 1);
  };

  const handleStartNewGame = () => {
    startNight(1);
  };

  const handleConfirmReset = async () => {
    await resetProgress();
    setConfirmReset(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-mono">
      {/* Background Image: 62eemvldff341.jpg */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700 filter brightness-75 contrast-125 scale-105"
        style={{ backgroundImage: `url('/assets/root/62eemvldff341.jpg')` }}
      >
        <div className="absolute inset-0 bg-black/45" />
      </div>

      {/* CRT Scanline & Glitch Overlay */}
      <CrtOverlay intensity="medium" />

      {/* Main UI Container */}
      <div className="relative z-20 flex flex-col justify-between h-full p-8 md:p-14">
        {/* Top Header: Game Title & Stars */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
              <p className="text-xs tracking-widest text-red-500 uppercase font-bold">FNAF: UCN RE-ENGINEERED</p>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
              CUSTOM NIGHT
            </h1>
            <p className="text-sm text-cyan-400/90 tracking-widest uppercase mt-1">
              FANMADE CON IA ADAPTATIVA
            </p>
          </div>

          {/* Stars Section */}
          <div className="flex flex-col items-start md:items-end bg-black/60 backdrop-blur-md p-4 rounded-lg border border-neutral-800">
            <span className="text-xs text-neutral-400 mb-2 uppercase tracking-wider font-semibold">Progreso de Noches</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const isEarned = starIdx <= (progress.stars_unlocked || 0);
                return (
                  <div key={starIdx} className="relative group">
                    <Star
                      className={`w-7 h-7 transition-all duration-500 ${isEarned
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] scale-110'
                        : 'text-neutral-700 fill-neutral-900/60'
                        }`}
                    />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-yellow-300 transition-opacity whitespace-nowrap">
                      Noche {starIdx}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center / Left: Menu Action Buttons */}
        <div className="my-auto max-w-md space-y-4">
          <div className="bg-neutral-900/80 backdrop-blur-md p-2 rounded-t border-t-2 border-cyan-500/80 text-xs text-cyan-300 flex items-center justify-between">
            <span>Juego</span>
            <span className="font-bold text-white">NOCHE ACTUAL: {progress.current_night || 1}</span>
          </div>

          <div className="space-y-3 bg-black/70 backdrop-blur-md p-6 rounded-b border border-neutral-800 shadow-2xl">
            {/* Continuar */}
            <button
              onClick={handleStartContinue}
              className="w-full group flex items-center justify-between px-5 py-3.5 bg-neutral-900/90 hover:bg-cyan-950/80 border border-neutral-700 hover:border-cyan-400 rounded transition-all duration-200 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                <div>
                  <div className="text-lg font-bold text-white group-hover:text-cyan-300 tracking-wide">
                    CONTINUAR
                  </div>
                  <div className="text-xs text-neutral-400">
                    Entrar a la Noche {progress.current_night || 1}
                  </div>
                </div>
              </div>
              <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2.5 py-1 rounded border border-cyan-600/40 font-mono">
                [ENTER]
              </span>
            </button>

            {/* Modo Prueba / Sandbox */}
            <button
              onClick={() => startNight(0)}
              className="w-full group flex items-center justify-between px-5 py-3 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/80 hover:border-emerald-400 rounded transition-all duration-200 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-base font-bold text-emerald-200 group-hover:text-white">
                    MODO PRUEBA
                  </div>
                  <div className="text-xs text-emerald-400/80">
                    Noche pacífica para probar cámaras, mapa y controles
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-600">
                SANDBOX
              </span>
            </button>

            {/* Nueva Noche */}
            <button
              onClick={handleStartNewGame}
              className="w-full group flex items-center justify-between px-5 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded transition-all duration-200 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-neutral-400 group-hover:rotate-180 transition-transform duration-500" />
                <div>
                  <div className="text-base font-bold text-neutral-200 group-hover:text-white">
                    INICIAR NOCHE 1
                  </div>
                  <div className="text-xs text-neutral-500">
                    Comenzar desafío desde la primera guardia
                  </div>
                </div>
              </div>
            </button>

            {/* Panel IA / Auditoría */}
            <button
              onClick={() => {
                soundManager.playBlip();
                setScreen('DASHBOARD');
              }}
              className="w-full group flex items-center justify-between px-5 py-3.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/80 hover:border-purple-400 rounded transition-all duration-200 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-base font-bold text-purple-200 group-hover:text-white">
                    Panel IA
                  </div>
                  <div className="text-xs text-purple-400/80">
                    Ver qué ha aprendido y qué decisiones toma
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded border border-purple-600">
                BACKEND
              </span>
            </button>

            {/* Resetear Datos */}
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full text-xs text-neutral-500 hover:text-red-400 py-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                RESETEAR DATOS DEL JUEGO
              </button>
            ) : (
              <div className="bg-red-950/60 border border-red-700/80 p-3 rounded text-center space-y-2">
                <p className="text-xs text-red-300 font-bold">¿Seguro que deseas borrar las estrellas y noches?</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleConfirmReset}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-bold cursor-pointer"
                  >
                    Sí, borrar
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info & Audio Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 border-t border-neutral-900 pt-4 gap-2">
          <div className="flex items-center gap-4">
            <span>UCN </span>
            <span className="hidden md:inline">•</span>
            <span className="text-cyan-500/80 font-bold">Fanmade</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMute}
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span>{isMuted ? 'Silenciado' : 'Audio Activo'}</span>
            </button>
            <span className="text-[11px] text-neutral-600">v1.0 alpha Fanmade</span>
          </div>
        </div>
      </div>
    </div>
  );
};

