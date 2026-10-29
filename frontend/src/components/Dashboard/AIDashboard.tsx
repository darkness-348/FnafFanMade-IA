import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { 
  Activity, Shield, Zap, AlertTriangle, ArrowLeft, RefreshCw, 
  BrainCircuit, History, Target, Cpu, CheckCircle2, XCircle, Radio, Clock
} from 'lucide-react';
import { AIAnalytics, DecisionRecord, NightHistoryRecord } from '../../types/game';

export const AIDashboard: React.FC = () => {
  const { setScreen, gameState } = useGame();
  const [analytics, setAnalytics] = useState<AIAnalytics | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [nights, setNights] = useState<NightHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'DECISIONS' | 'PROFILER' | 'NIGHTS'>('DECISIONS');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, decisionsRes, nightsRes] = await Promise.all([
        fetch('/api/ai/analytics'),
        fetch('/api/ai/decisions?limit=40'),
        fetch('/api/nights?limit=25')
      ]);

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (decisionsRes.ok) {
        setDecisions(await decisionsRes.json());
      }
      if (nightsRes.ok) {
        setNights(await nightsRes.json());
      }
    } catch (e) {
      console.error('Error fetching AI analytics:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Polling update every 3s
    return () => clearInterval(interval);
  }, [fetchData]);

  const actionLabels: Record<string, { label: string; desc: string; color: string }> = {
    ATTACK_RIGHT_VENT: { 
      label: 'Ataque por Escotilla Derecha', 
      desc: 'Emboscada por el ducto derecho si el jugador descuida la ventilación',
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-700' 
    },
    ENTER_LEFT_DOOR: { 
      label: 'Entrada por Puerta Izquierda', 
      desc: 'Asalto frontal cuando la puerta izquierda está desprotegida',
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-700' 
    },
    ENTER_RIGHT_DOOR: { 
      label: 'Entrada por Puerta Derecha', 
      desc: 'Asalto frontal por el pasillo derecho al detectar distracción',
      color: 'text-blue-400 bg-blue-950/60 border-blue-700' 
    },
    REQUIRE_FLASHLIGHT: { 
      label: 'Acecho en Sombras (Linterna)', 
      desc: 'Amenaza en penumbras que exige encender la linterna para disuadirlo',
      color: 'text-yellow-400 bg-yellow-950/60 border-yellow-700' 
    },
    MOVE_SOUND: { 
      label: 'Movimiento Acústico (audio01)', 
      desc: 'Animatrónico invisible que emite sonido direccional para forzar reacción',
      color: 'text-purple-400 bg-purple-950/60 border-purple-700' 
    },
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-200 font-mono select-none flex flex-col">
      <CrtOverlay intensity="light" />

      {/* Top Navigation Bar */}
      <header className="z-20 border-b border-neutral-800 bg-black/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScreen(gameState.is_active ? 'OFFICE' : 'MENU')}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{gameState.is_active ? 'Volver a la Oficina' : 'Volver al Menú'}</span>
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-400 animate-pulse" />
            <h1 className="text-base md:text-lg font-bold text-white tracking-wide">
              PANEL DE CONTROL & APRENDIZAJE DE LA IA
            </h1>
            <span className="text-[10px] bg-purple-950 border border-purple-700 text-purple-300 px-2 py-0.5 rounded uppercase font-bold">
              Telemetría en Vivo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="z-10 flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase mb-1">
              <span>Total Decisiones</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {analytics?.total_decisions ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Acciones estratégicas calculadas
            </div>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase mb-1">
              <span>Tasa de Éxito IA</span>
              <Target className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-black text-red-400">
              {analytics?.success_rate ?? 0}%
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Ataques que burlaron la defensa
            </div>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase mb-1">
              <span>Punto Ciego Principal</span>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-lg font-bold text-yellow-300 truncate">
              {analytics?.habit_metrics?.primary_blind_spot ?? 'Analizando...'}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Sector con menor vigilancia
            </div>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-bold uppercase mb-1">
              <span>Noches Registradas</span>
              <History className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {nights.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Guardadas en base de datos SQLite
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
          <button
            onClick={() => setActiveTab('DECISIONS')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'DECISIONS' 
                ? 'bg-purple-950 text-purple-200 border border-purple-700' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Registro de Decisiones en Vivo
          </button>
          <button
            onClick={() => setActiveTab('PROFILER')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'PROFILER' 
                ? 'bg-purple-950 text-purple-200 border border-purple-700' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Perfil de Hábitos del Jugador
          </button>
          <button
            onClick={() => setActiveTab('NIGHTS')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'NIGHTS' 
                ? 'bg-purple-950 text-purple-200 border border-purple-700' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Historial de Noches (SQLite)
          </button>
        </div>

        {/* TAB 1: DECISIONS */}
        {activeTab === 'DECISIONS' && (
          <div className="space-y-4">
            {/* Action Tactic Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {Object.entries(actionLabels).map(([actionKey, meta]) => {
                const count = analytics?.action_frequencies?.[actionKey] ?? 0;
                const successes = analytics?.action_successes?.[actionKey] ?? 0;
                return (
                  <div key={actionKey} className={`p-3 rounded-lg border ${meta.color} flex flex-col justify-between`}>
                    <div>
                      <div className="text-xs font-bold uppercase">{meta.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5 line-clamp-2">{meta.desc}</div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-2">
                      <span className="text-xl font-black">{count} veces</span>
                      <span className="text-[10px] opacity-80">{successes} aciertos</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Decision Stream Table */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 uppercase">
                  Flujo de Razonamiento Táctico de la IA
                </span>
                <span className="text-[10px] text-neutral-500">
                  Mostrando últimas {decisions.length} decisiones
                </span>
              </div>

              <div className="divide-y divide-neutral-800/60 max-h-[420px] overflow-y-auto">
                {decisions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    Aún no se han registrado decisiones. Entra a una noche para que la IA comience a evaluar tus movimientos.
                  </div>
                ) : (
                  decisions.map((d) => {
                    const meta = actionLabels[d.action] || { label: d.action, color: 'text-neutral-400' };
                    const isSuccess = d.outcome === 'SUCCESS';
                    const isBlocked = d.outcome === 'BLOCKED';

                    return (
                      <div key={d.id} className="p-3.5 hover:bg-neutral-800/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white uppercase">{meta.label}</span>
                            <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">
                              Confianza: {Math.round((d.confidence ?? 1) * 100)}%
                            </span>
                            {d.night_number && (
                              <span className="text-[10px] text-cyan-400">Noche {d.night_number}</span>
                            )}
                          </div>
                          <p className="text-neutral-400 text-[11px] leading-relaxed">
                            {d.reason}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {isSuccess && (
                            <span className="flex items-center gap-1 text-red-400 bg-red-950/60 border border-red-800 px-2.5 py-1 rounded text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              ATAQUE EXITOSO
                            </span>
                          )}
                          {isBlocked && (
                            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              BLOQUEADO POR JUGADOR
                            </span>
                          )}
                          {!isSuccess && !isBlocked && (
                            <span className="text-neutral-500 bg-neutral-800 px-2.5 py-1 rounded text-[10px]">
                              {d.outcome || 'EN CURSO'}
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-600 whitespace-nowrap">
                            {d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROFILER */}
        {activeTab === 'PROFILER' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Habit Telemetry Gauges */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase border-b border-neutral-800 pb-2">
                Telemetría de Vigilancia del Jugador
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Vigilancia Puerta Izquierda</span>
                    <span className="font-bold text-emerald-400">{analytics?.habit_metrics?.left_door_usage_pct ?? 0}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${analytics?.habit_metrics?.left_door_usage_pct ?? 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Vigilancia Puerta Derecha</span>
                    <span className="font-bold text-blue-400">{analytics?.habit_metrics?.right_door_usage_pct ?? 0}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${analytics?.habit_metrics?.right_door_usage_pct ?? 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Vigilancia Escotilla Derecha (Vent)</span>
                    <span className="font-bold text-cyan-400">{analytics?.habit_metrics?.vent_usage_pct ?? 0}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${analytics?.habit_metrics?.vent_usage_pct ?? 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Uso de Linterna</span>
                    <span className="font-bold text-yellow-400">{analytics?.habit_metrics?.flashlight_usage_pct ?? 0}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                      style={{ width: `${analytics?.habit_metrics?.flashlight_usage_pct ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Adaptation Explanation */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase border-b border-neutral-800 pb-2">
                Estrategia Adaptativa de la Red
              </h3>
              <div className="text-xs text-neutral-300 space-y-3 leading-relaxed">
                <p>
                  • <span className="font-bold text-cyan-300">Monitoreo de hábitos:</span> Cada segundo que pasas con una puerta cerrada o abierta alimenta la matriz Q-Learning.
                </p>
                <p>
                  • <span className="font-bold text-yellow-300">Explotación de puntos ciegos:</span> Si mantienes la puerta izquierda cerrada pero olvidas la escotilla derecha, la IA penaliza la puerta izquierda y prioriza <span className="text-cyan-400">ATTACK_RIGHT_VENT</span>.
                </p>
                <p>
                  • <span className="font-bold text-purple-300">Animatrónico Acústico Especial:</span> Actúa de forma invisible y emite <span className="text-white">audio01.wav</span> en estéreo para evaluar tus reflejos auditivos y reacción bajo presión.
                </p>
                <p>
                  • <span className="font-bold text-emerald-300">Persistencia:</span> Todo el aprendizaje se almacena en SQLite en el backend, por lo que la IA no olvida tus debilidades entre partidas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NIGHTS */}
        {activeTab === 'NIGHTS' && (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="p-3 bg-neutral-950 border-b border-neutral-800 text-xs font-bold text-neutral-300 uppercase">
              Partidas y Noches Guardadas en el Backend
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/60 text-neutral-400 uppercase text-[10px] border-b border-neutral-800">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Noche</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Tiempo Sobrevivido</th>
                    <th className="p-3">Energía Restante</th>
                    <th className="p-3">Decisiones IA</th>
                    <th className="p-3">Causa de Fin</th>
                    <th className="p-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {nights.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-neutral-500">
                        No hay noches registradas aún. Juega una noche para registrar datos.
                      </td>
                    </tr>
                  ) : (
                    nights.map((n) => (
                      <tr key={n.id} className="hover:bg-neutral-800/30">
                        <td className="p-3 text-neutral-500 font-mono">#{n.id}</td>
                        <td className="p-3 font-bold text-white">Noche {n.night_number}</td>
                        <td className="p-3">
                          {n.status === 'won' ? (
                            <span className="text-emerald-400 font-bold">6:00 AM (VICTORIA)</span>
                          ) : n.status === 'jumpscare' ? (
                            <span className="text-red-400 font-bold">JUMPSCARE</span>
                          ) : (
                            <span className="text-yellow-400 font-bold">{n.status}</span>
                          )}
                        </td>
                        <td className="p-3">{Math.round(n.seconds_survived)} s</td>
                        <td className="p-3">{Math.round(n.power_left)}%</td>
                        <td className="p-3">{n.ai_decisions_count}</td>
                        <td className="p-3 text-neutral-400 truncate max-w-xs">{n.cause_of_death || '-'}</td>
                        <td className="p-3 text-neutral-500">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

