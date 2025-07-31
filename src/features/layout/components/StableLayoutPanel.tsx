import React, { ReactNode, useEffect } from 'react';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from 'react-resizable-panels';

interface StableLayoutPanelProps {
  // Panel content
  leftPanel?: ReactNode;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  bottomPanel?: ReactNode;
  
  // Panel visibility (controls collapsed state, not rendering)
  leftPanelCollapsed?: boolean;
  rightPanelCollapsed?: boolean;
  bottomPanelCollapsed?: boolean;
  
  // Panel refs
  leftPanelRef?: React.RefObject<ImperativePanelHandle>;
  rightPanelRef?: React.RefObject<ImperativePanelHandle>;
  bottomPanelRef?: React.RefObject<ImperativePanelHandle>;
  
  // Toolbar
  toolbar?: ReactNode;
  
  // Storage key for persisting layout
  storageKey?: string;
}

export const StableLayoutPanel: React.FC<StableLayoutPanelProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  bottomPanel,
  leftPanelCollapsed = false,
  rightPanelCollapsed = false,
  bottomPanelCollapsed = false,
  leftPanelRef,
  rightPanelRef,
  bottomPanelRef,
  toolbar,
  storageKey = 'stable-layout',
}) => {
  // Track if panels exist
  const hasLeftPanel = !!leftPanel;
  const hasRightPanel = !!rightPanel;
  const hasBottomPanel = !!bottomPanel;
  
  // Stable IDs for panels
  const PANEL_IDS = {
    left: 'left-panel',
    center: 'center-panel',
    right: 'right-panel',
    main: 'main-panel',
    bottom: 'bottom-panel',
  };
  
  // Default sizes
  const DEFAULT_SIZES = {
    horizontal: hasLeftPanel && hasRightPanel ? [20, 50, 30] : 
                hasLeftPanel ? [20, 80] : 
                hasRightPanel ? [70, 30] : 
                [100],
    vertical: hasBottomPanel ? [70, 30] : [100],
  };
  
  // Effect to handle collapse state changes
  useEffect(() => {
    if (leftPanelRef?.current) {
      if (leftPanelCollapsed) {
        leftPanelRef.current.collapse();
      } else {
        leftPanelRef.current.expand();
      }
    }
  }, [leftPanelCollapsed, leftPanelRef]);
  
  useEffect(() => {
    if (rightPanelRef?.current) {
      if (rightPanelCollapsed) {
        rightPanelRef.current.collapse();
      } else {
        rightPanelRef.current.expand();
      }
    }
  }, [rightPanelCollapsed, rightPanelRef]);
  
  useEffect(() => {
    if (bottomPanelRef?.current) {
      if (bottomPanelCollapsed) {
        bottomPanelRef.current.collapse();
      } else {
        bottomPanelRef.current.expand();
      }
    }
  }, [bottomPanelCollapsed, bottomPanelRef]);
  
  // Build horizontal panel content
  const horizontalPanels = (
    <PanelGroup 
      direction="horizontal" 
      autoSaveId={`${storageKey}-horizontal`}
    >
      {hasLeftPanel && (
        <>
          <Panel
            id={PANEL_IDS.left}
            ref={leftPanelRef}
            defaultSize={DEFAULT_SIZES.horizontal[0]}
            collapsedSize={0}
            collapsible={true}
            minSize={15}
            maxSize={35}
          >
            <div className="h-full overflow-auto">
              {leftPanel}
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle resize-handle-horizontal">
            <div className="resize-handle-inner" />
          </PanelResizeHandle>
        </>
      )}
      
      <Panel
        id={PANEL_IDS.center}
        defaultSize={hasLeftPanel && hasRightPanel ? DEFAULT_SIZES.horizontal[1] : 
                    hasLeftPanel || hasRightPanel ? DEFAULT_SIZES.horizontal[1] : 
                    DEFAULT_SIZES.horizontal[0]}
        minSize={30}
      >
        <div className="h-full overflow-auto">
          {centerPanel}
        </div>
      </Panel>
      
      {hasRightPanel && (
        <>
          <PanelResizeHandle className="resize-handle resize-handle-horizontal">
            <div className="resize-handle-inner" />
          </PanelResizeHandle>
          <Panel
            id={PANEL_IDS.right}
            ref={rightPanelRef}
            defaultSize={DEFAULT_SIZES.horizontal[hasLeftPanel ? 2 : 1]}
            collapsedSize={0}
            collapsible={true}
            minSize={20}
            maxSize={40}
          >
            <div className="h-full overflow-auto">
              {rightPanel}
            </div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
  
  // Main layout
  return (
    <div className="h-full flex flex-col">
      {toolbar && (
        <div className="border-b px-4 py-2 bg-background flex-shrink-0">
          {toolbar}
        </div>
      )}
      
      {hasBottomPanel ? (
        <PanelGroup 
          direction="vertical" 
          className="flex-1"
          autoSaveId={`${storageKey}-vertical`}
        >
          <Panel
            id={PANEL_IDS.main}
            defaultSize={DEFAULT_SIZES.vertical[0]}
            minSize={40}
          >
            {horizontalPanels}
          </Panel>
          
          <PanelResizeHandle className="resize-handle resize-handle-vertical">
            <div className="resize-handle-inner" />
          </PanelResizeHandle>
          
          <Panel
            id={PANEL_IDS.bottom}
            ref={bottomPanelRef}
            defaultSize={DEFAULT_SIZES.vertical[1]}
            collapsedSize={0}
            collapsible={true}
            minSize={20}
            maxSize={60}
          >
            <div className="h-full overflow-auto">
              {bottomPanel}
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex-1">
          {horizontalPanels}
        </div>
      )}
    </div>
  );
};