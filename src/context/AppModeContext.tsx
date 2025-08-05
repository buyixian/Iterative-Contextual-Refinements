import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ApplicationMode } from '../features/ModeSelector/ModeSelector';

interface AppModeContextType {
  currentMode: ApplicationMode;
  setMode: (mode: ApplicationMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [currentMode, setCurrentMode] = useState<ApplicationMode>('website');

  const setMode = (mode: ApplicationMode) => {
    setCurrentMode(mode);
  };

  return (
    <AppModeContext.Provider value={{ currentMode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}