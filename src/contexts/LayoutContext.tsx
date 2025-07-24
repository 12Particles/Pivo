import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface LayoutContextValue {
  // Panel visibility
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  bottomPanelVisible: boolean;
  
  // Panel sizes
  leftPanelSize: number;
  centerPanelSize: number;
  rightPanelSize: number;
  
  // Actions
  togglePanel: (panel: 'left' | 'right' | 'bottom') => void;
  setPanelSizes: (sizes: { left?: number; center?: number; right?: number }) => void;
  resetLayout: () => void;
}

const DEFAULT_LAYOUT = {
  leftPanelVisible: true,
  rightPanelVisible: true,
  bottomPanelVisible: true,
  leftPanelSize: 30,
  centerPanelSize: 40,
  rightPanelSize: 30,
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  // Load from localStorage
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('app-layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Fix the issue where all panels might be hidden
        const hasVisiblePanel = parsed.leftPanelVisible || parsed.rightPanelVisible;
        if (!hasVisiblePanel) {
          console.warn('Invalid layout state detected (no visible panels), using defaults');
          localStorage.removeItem('app-layout');
          return DEFAULT_LAYOUT;
        }
        return {
          ...DEFAULT_LAYOUT,
          ...parsed,
        };
      } catch (e) {
        console.error('Failed to parse layout from localStorage:', e);
        localStorage.removeItem('app-layout');
      }
    }
    return DEFAULT_LAYOUT;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('app-layout', JSON.stringify(layout));
  }, [layout]);

  const togglePanel = (panel: 'left' | 'right' | 'bottom') => {
    setLayout((prev: any) => ({
      ...prev,
      [`${panel}PanelVisible`]: !prev[`${panel}PanelVisible`],
    }));
  };

  const setPanelSizes = (sizes: { left?: number; center?: number; right?: number }) => {
    setLayout((prev: any) => ({
      ...prev,
      ...(sizes.left && { leftPanelSize: sizes.left }),
      ...(sizes.center && { centerPanelSize: sizes.center }),
      ...(sizes.right && { rightPanelSize: sizes.right }),
    }));
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    // Clear all layout related localStorage items
    const keysToRemove = ['app-layout', 'tasks-layout', 'app-horizontal-layout', 'app-vertical-layout'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    // Also clear any react-resizable-panels keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('react-resizable-panels') || key.includes('task-details')) {
        localStorage.removeItem(key);
      }
    });
    // Force save the default layout
    localStorage.setItem('app-layout', JSON.stringify(DEFAULT_LAYOUT));
  };

  return (
    <LayoutContext.Provider value={{
      ...layout,
      togglePanel,
      setPanelSizes,
      resetLayout,
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
}

// For backward compatibility
export const useLayoutStore = useLayout;