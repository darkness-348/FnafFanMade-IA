import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/Menu/MainMenu';
import { NightIntro } from './components/Office/NightIntro';
import { OfficeView } from './components/Office/OfficeView';
import { AIDashboard } from './components/Dashboard/AIDashboard';
import { JumpscareModal } from './components/Jumpscare/JumpscareModal';
import { VictoryModal } from './components/Victory/VictoryModal';

const GameContent: React.FC = () => {
  const { screen } = useGame();
  const [isStandaloneDashboard, setIsStandaloneDashboard] = useState(
    window.location.hash.includes('dashboard') || window.location.pathname.includes('dashboard')
  );

  useEffect(() => {
    const checkHash = () => {
      setIsStandaloneDashboard(
        window.location.hash.includes('dashboard') || window.location.pathname.includes('dashboard')
      );
    };
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // If this window was opened specifically for the live AI Dashboard
  if (isStandaloneDashboard) {
    return (
      <main className="w-screen h-screen bg-neutral-950 overflow-hidden relative">
        <AIDashboard />
      </main>
    );
  }

  return (
    <main className="w-screen h-screen bg-black overflow-hidden relative">
      {screen === 'MENU' && <MainMenu />}
      {screen === 'NIGHT_INTRO' && <NightIntro />}
      {screen === 'OFFICE' && <OfficeView />}
      {screen === 'DASHBOARD' && <AIDashboard />}

      {/* Global Modals for Events */}
      <JumpscareModal />
      <VictoryModal />
    </main>
  );
};

export function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}

export default App;
