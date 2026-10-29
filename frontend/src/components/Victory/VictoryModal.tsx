import React from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { Star, Play, ArrowLeft, Activity, Trophy } from 'lucide-react';

export const VictoryModal: React.FC = () => {
  const { victoryData, startNight, returnToMenu, setScreen } = useGame();

  if (!victoryData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none font-mono">
      <CrtOverlay intensity="medium" />

      <div className="relative z-20 max-w-lg w-full mx-4 p-8 bg-neutral-950/95 border-2 border-yellow-500/80 rounded-xl shadow-[0_0_60px_rgba(234,179,8,0.4)] text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-20 h-20 mx-auto rounded-full bg-yellow-950/70 border-2 border-yellow-400 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.6)]">
          <Trophy className="w-10 h-10 text-yellow-400 animate-pulse" />
        </div>

        <div>
          <h2 className="text-5xl md:text-6xl font-black text-white tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
            6:00 AM
          </h2>
          <p className="text-base font-bold text-yellow-400 mt-2 uppercase tracking-wider">
            ¡NOCHE {victoryData.night} SUPERADA!
          </p>
        </div>

        {/* Stars Earned */}
        <div className="flex justify-center items-center gap-2 py-2">
          {[1, 2, 3, 4, 5].map((starIdx) => (
            <Star
              key={starIdx}
              className={`w-8 h-8 ${
                starIdx <= victoryData.stars_earned
                  ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] scale-110'
                  : 'text-neutral-700'
              }`}
            />
          ))}
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto">
          Has sobrevivido a la ofensiva de la IA y resistido los ataques auditivos del animatrónico especial. La IA ahora aumentará su nivel de dificultad para la próxima noche.
        </p>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => startNight(victoryData.next_night)}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-black text-sm tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-yellow-600/30"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Continuar a Noche {victoryData.next_night}</span>
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
    </div>
  );
};

