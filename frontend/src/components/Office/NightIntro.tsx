import React, { useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { soundManager } from '../../sound/soundManager';
import { Shield, Flashlight, Zap, Radio, CornerDownLeft, Eye } from 'lucide-react';

export const NightIntro: React.FC = () => {
  const { gameState, setScreen } = useGame();

  const handleStartOffice = useCallback(() => {
    soundManager.startAmbience();
    soundManager.playBlip();
    setScreen('OFFICE');
  }, [setScreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleStartOffice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStartOffice]);

  return (
    <div
      onClick={handleStartOffice}
      className="relative w-screen h-screen bg-black flex flex-col items-center justify-center font-mono select-none cursor-pointer p-6"
    >
      <CrtOverlay intensity="heavy" />

      <div className="relative z-20 max-w-2xl w-full text-center space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-5xl md:text-6xl font-black tracking-widest text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.7)]">
            12:00 AM
          </h2>
          <p className="text-xl md:text-2xl text-cyan-400 font-bold tracking-wider mt-1">
            {gameState.night_number === 1 ? '1ra NOCHE' : `NOCHE ${gameState.night_number}`}
          </p>
        </div>

        {/* Controls Card */}
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-6 shadow-2xl backdrop-blur-md text-left space-y-4">
          <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider border-b border-neutral-800 pb-2 flex items-center justify-between">
            <span>SISTEMA DE PROTOCOLO DE DEFENSA</span>
            <span className="text-cyan-400"></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-cyan-400 flex items-center justify-center border border-neutral-700">
                A
              </span>
              <div>
                <div className="font-bold text-white">Puerta Izquierda</div>
                <div className="text-[10px] text-neutral-400">Cierra la compuerta izquierda</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-cyan-400 flex items-center justify-center border border-neutral-700">
                D
              </span>
              <div>
                <div className="font-bold text-white">Puerta Derecha</div>
                <div className="text-[10px] text-neutral-400">Cierra la compuerta derecha</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-emerald-400 flex items-center justify-center border border-neutral-700">
                S
              </span>
              <div>
                <div className="font-bold text-white">Monitor / Cámaras [S]</div>
                <div className="text-[10px] text-neutral-400">Elevar / Bajar cámaras y mapa</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-yellow-400 flex items-center justify-center border border-neutral-700">
                W
              </span>
              <div>
                <div className="font-bold text-white">Conducto de Arriba</div>
                <div className="text-[10px] text-neutral-400">Sella la ventilación central</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-yellow-400 flex items-center justify-center border border-neutral-700">
                F
              </span>
              <div>
                <div className="font-bold text-white">Escotilla Derecha</div>
                <div className="text-[10px] text-neutral-400">Sella el ducto diagonal derecho</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-white flex items-center justify-center border border-neutral-700 text-[10px]">
                CTRL
              </span>
              <div>
                <div className="font-bold text-white">Linterna [CTRL / Z]</div>
                <div className="text-[10px] text-neutral-400">Sigue la sombra para ahuyentarla</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded bg-neutral-900/80 border border-neutral-800">
              <span className="w-8 h-8 rounded bg-neutral-800 font-black text-emerald-400 flex items-center justify-center border border-neutral-700">
                E
              </span>
              <div>
                <div className="font-bold text-white">Shock Eléctrico [Taser]</div>
                <div className="text-[10px] text-neutral-400">Aturde a la IA (cada 30s)</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 border-t border-neutral-800 pt-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Mueve el ratón para mirar a la izquierda o derecha de la oficina.
            </span>
          </div>
        </div>

        {/* Prompt Enter to Start */}
        <div className="flex items-center justify-center gap-2 text-cyan-400 font-bold text-sm tracking-widest animate-pulse">
          <CornerDownLeft className="w-5 h-5" />
          <span>PRESIONA [ENTER] O HAZ CLIC PARA INICIAR LA GUARDIA</span>
        </div>
      </div>
    </div>
  );
};
