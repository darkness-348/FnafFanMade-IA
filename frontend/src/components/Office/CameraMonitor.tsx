import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { CrtOverlay } from '../Common/CrtOverlay';
import { soundManager } from '../../sound/soundManager';

const FLIP_FRAMES = [
  '/assets/textures/11a.png',
  '/assets/textures/11b.png',
  '/assets/textures/11c.png',
  '/assets/textures/11d.png',
  '/assets/textures/11e.png',
  '/assets/textures/11f.png',
];

const CAM_FEEDS: Record<number, { img: string; name: string }> = {
  1: { img: '/assets/textures/2d2.png', name: 'CAM 01 - PASILLO PRINCIPAL' },
  2: { img: '/assets/textures/2e9.png', name: 'CAM 02 - ACCESO DERECHO' },
  3: { img: '/assets/textures/451.png', name: 'CAM 03 - ZONA DE SUMINISTROS' },
  4: { img: '/assets/textures/355.png', name: 'CAM 04 - SALA DE PARTES' },
};

/*
 * POSICIONES DE LOS BOTONES DE CÁMARA SOBRE EL MAPA (2d1.png):
 * Puedes ajustar los porcentajes de left y top para cambiar su ubicación exacta.
 */
const CAM_BUTTONS = [
  { id: 1, img: '/assets/textures/32e.png', left: '22%', top: '32%', label: 'CAM 1' },
  { id: 2, img: '/assets/textures/32a.png', left: '68%', top: '35%', label: 'CAM 2' },
  { id: 3, img: '/assets/textures/32c.png', left: '26%', top: '72%', label: 'CAM 3' },
  { id: 4, img: '/assets/textures/33b.png', left: '72%', top: '75%', label: 'CAM 4' },
];

export const CameraMonitor: React.FC = () => {
  const { gameState, currentCam, setCurrentCam } = useGame();
  const [animating, setAnimating] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [isUp, setIsUp] = useState(false);

  // Monitor flip up/down animation logic
  useEffect(() => {
    if (gameState.looking_at_monitor) {
      // Flip up animation (0 to 5)
      setAnimating(true);
      let idx = 0;
      const interval = setInterval(() => {
        idx++;
        if (idx < FLIP_FRAMES.length) {
          setFrameIdx(idx);
        } else {
          clearInterval(interval);
          setAnimating(false);
          setIsUp(true);
        }
      }, 35);
      return () => clearInterval(interval);
    } else {
      if (isUp) {
        // Flip down animation (5 down to 0)
        setAnimating(true);
        let idx = FLIP_FRAMES.length - 1;
        const interval = setInterval(() => {
          idx--;
          if (idx >= 0) {
            setFrameIdx(idx);
          } else {
            clearInterval(interval);
            setAnimating(false);
            setIsUp(false);
          }
        }, 35);
        return () => clearInterval(interval);
      }
    }
  }, [gameState.looking_at_monitor]);

  if (!gameState.looking_at_monitor && !animating && !isUp) {
    return null;
  }

  const handleSelectCam = (id: number) => {
    if (currentCam !== id) {
      soundManager.playBlip();
      setCurrentCam(id);
    }
  };

  const currentFeed = CAM_FEEDS[currentCam] || CAM_FEEDS[1];
  const hasImpostor = gameState.impostor_cam === currentCam;
  const impostorForm = gameState.impostor_form || '761.png';

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden font-mono pointer-events-auto">
      {/* 1. FLIP UP / DOWN ANIMATION SEQUENCE */}
      {animating && (
        <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none z-50">
          <img
            src={FLIP_FRAMES[frameIdx]}
            alt="Monitor Animation"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 2. FULL MONITOR VIEW (When fully up) */}
      {isUp && !animating && (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          {/* Active Camera Feed Background (1250x540) */}
          <div className="relative w-full h-full overflow-hidden">
            <img
              src={currentFeed.img}
              alt={currentFeed.name}
              className="w-full h-full object-cover brightness-75 contrast-125"
            />

            {/* Static Noise Overlay */}
            <div className="absolute inset-0 bg-white/5 mix-blend-overlay pointer-events-none animate-flicker" />

            {/* Impostor AI Animatronic in Camera (Shapeshifter) */}
            {hasImpostor && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[450px] flex items-center justify-center animate-pulse pointer-events-none drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]">
                <img
                  src={`/assets/textures/${impostorForm}`}
                  alt="Impostor Animatronic"
                  className="max-w-full max-h-full object-contain filter contrast-125 brightness-95"
                />
              </div>
            )}

            {/* CRT Scanline Overlay */}
            <CrtOverlay intensity="medium" />

            {/* Top HUD on Camera: REC Dot & Cam Title */}
            <div className="absolute top-8 left-10 z-30 flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-red-600 animate-ping" />
              <div className="text-xl md:text-2xl font-black text-white tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {currentFeed.name}
              </div>
            </div>

            {/* --- MAP CONTAINER (2d1.png) IN BOTTOM RIGHT --- */}
            <div 
              className="absolute bottom-8 right-10 z-30"
              style={{
                width: '420px',
                height: '360px',
              }}
            >
              {/* Map Layout Texture: 2d1.png */}
              <img
                src="/assets/textures/2d1.png"
                alt="Camera Map Layout"
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]"
              />

              {/* Camera Selection Buttons (Overlayed on Map) */}
              {CAM_BUTTONS.map((btn) => {
                const isSelected = currentCam === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => handleSelectCam(btn.id)}
                    style={{
                      left: btn.left,
                      top: btn.top,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform cursor-pointer hover:scale-125 focus:outline-none ${
                      isSelected ? 'scale-115 drop-shadow-[0_0_12px_#10b981]' : 'opacity-85'
                    }`}
                    title={btn.label}
                  >
                    <img
                      src={btn.img}
                      alt={btn.label}
                      className="w-8 h-8 object-contain"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

