import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ScannerUser } from '../services/DatabaseService';

interface ScannerContextType {
  scannerUser: ScannerUser | null;
  setScannerUser: (user: ScannerUser | null) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

interface ScannerProviderProps {
  children: ReactNode;
}

export const ScannerProvider: React.FC<ScannerProviderProps> = ({ children }) => {
  const [scannerUser, setScannerUser] = useState<ScannerUser | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('Main Arena');

  return (
    <ScannerContext.Provider value={{ 
      scannerUser, 
      setScannerUser, 
      selectedArea, 
      setSelectedArea 
    }}>
      {children}
    </ScannerContext.Provider>
  );
};

export const useScanner = (): ScannerContextType => {
  const context = useContext(ScannerContext);
  if (context === undefined) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return context;
};
