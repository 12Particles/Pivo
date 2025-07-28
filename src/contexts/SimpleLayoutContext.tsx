import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

interface SimpleLayoutContextValue {
  // Panel collapsed states
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  
  // Actions
  togglePanel: (panel: 'left' | 'right' | 'bottom') => void;
  collapsePanel: (panel: 'left' | 'right' | 'bottom') => void;
  expandPanel: (panel: 'left' | 'right' | 'bottom') => void;
  resetLayout: () => void;
}

const SimpleLayoutContext = createContext<SimpleLayoutContextValue | null>(null);

export function SimpleLayoutProvider({ children }: { children: ReactNode }) {
  // Simple state - just track collapsed status
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  
  const togglePanel = useCallback((panel: 'left' | 'right' | 'bottom') => {
    switch (panel) {
      case 'left':
        setLeftPanelCollapsed(prev => !prev);
        break;
      case 'right':
        setRightPanelCollapsed(prev => !prev);
        break;
      case 'bottom':
        setBottomPanelCollapsed(prev => !prev);
        break;
    }
  }, []);
  
  const collapsePanel = useCallback((panel: 'left' | 'right' | 'bottom') => {
    switch (panel) {
      case 'left':
        setLeftPanelCollapsed(true);
        break;
      case 'right':
        setRightPanelCollapsed(true);
        break;
      case 'bottom':
        setBottomPanelCollapsed(true);
        break;
    }
  }, []);
  
  const expandPanel = useCallback((panel: 'left' | 'right' | 'bottom') => {
    switch (panel) {
      case 'left':
        setLeftPanelCollapsed(false);
        break;
      case 'right':
        setRightPanelCollapsed(false);
        break;
      case 'bottom':
        setBottomPanelCollapsed(false);
        break;
    }
  }, []);
  
  const resetLayout = useCallback(() => {
    setLeftPanelCollapsed(false);
    setRightPanelCollapsed(false);
    setBottomPanelCollapsed(true);
  }, []);
  
  return (
    <SimpleLayoutContext.Provider value={{
      leftPanelCollapsed,
      rightPanelCollapsed,
      bottomPanelCollapsed,
      togglePanel,
      collapsePanel,
      expandPanel,
      resetLayout,
    }}>
      {children}
    </SimpleLayoutContext.Provider>
  );
}

export function useSimpleLayout() {
  const context = useContext(SimpleLayoutContext);
  if (!context) {
    throw new Error('useSimpleLayout must be used within SimpleLayoutProvider');
  }
  return context;
}