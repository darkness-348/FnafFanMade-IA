import React from 'react';

interface CrtOverlayProps {
  intensity?: 'light' | 'medium' | 'heavy';
  showStatic?: boolean;
}

export const CrtOverlay: React.FC<CrtOverlayProps> = ({ intensity = 'medium', showStatic = true }) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {/* Scanlines */}
      <div 
        className={`absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] ${
          intensity === 'light' ? 'opacity-30' : intensity === 'heavy' ? 'opacity-85' : 'opacity-60'
        }`} 
      />

      {/* Screen Curved Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.85)_100%)]" />

      {/* Subtle CRT Flicker */}
      <div className="absolute inset-0 bg-white/3 mix-blend-overlay pointer-events-none animate-flicker" />

      {/* Scanline sweep bar */}
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none animate-scanline" />
    </div>
  );
};

