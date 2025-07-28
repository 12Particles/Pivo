import React, { useEffect } from 'react';
import { LayoutToggleButtons } from './LayoutToggleButtons';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
  title: string;
  leftPanelVisible: boolean;
  bottomPanelVisible: boolean;
  rightPanelVisible: boolean;
  onToggleLeft: () => void;
  onToggleBottom: () => void;
  onToggleRight: () => void;
  onResetLayout: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  leftPanelVisible,
  bottomPanelVisible,
  rightPanelVisible,
  onToggleLeft,
  onToggleBottom,
  onToggleRight,
  onResetLayout,
}) => {
  useEffect(() => {
    const setupWindow = async () => {
      await getCurrentWindow();
    };
    setupWindow();
  }, []);

  return (
    <div 
      data-tauri-drag-region
      className="h-9 flex items-center select-none"
      style={{ paddingTop: '2px' }}
    >
      {/* macOS title bar layout */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Center - title */}
        <span className="text-xs font-medium text-muted-foreground absolute">{title}</span>
        
        {/* Right side - layout toggle buttons */}
        <div className="absolute right-2">
          <LayoutToggleButtons
            leftPanelVisible={leftPanelVisible}
            bottomPanelVisible={bottomPanelVisible}
            rightPanelVisible={rightPanelVisible}
            onToggleLeft={onToggleLeft}
            onToggleBottom={onToggleBottom}
            onToggleRight={onToggleRight}
            onResetLayout={onResetLayout}
          />
        </div>
      </div>
    </div>
  );
};