import React, { ReactNode, useEffect } from 'react';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from 'react-resizable-panels';

interface ProjectMainViewProps {
  leftPanel?: ReactNode;
  centerPanel?: ReactNode;
  rightPanel?: ReactNode;
  bottomPanel?: ReactNode;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  bottomPanelVisible?: boolean;
  leftPanelSize?: number;
  centerPanelSize?: number;
  rightPanelSize?: number;
  leftPanelRef?: React.RefObject<ImperativePanelHandle>;
  rightPanelRef?: React.RefObject<ImperativePanelHandle>;
  bottomPanelRef?: React.RefObject<ImperativePanelHandle>;
  onLeftPanelResize?: () => void;
  onRightPanelResize?: () => void;
  onBottomPanelResize?: () => void;
  onResetLayout?: () => void;
  toolbar?: ReactNode;
}

export const ProjectMainView: React.FC<ProjectMainViewProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  bottomPanel,
  leftPanelVisible = true,
  rightPanelVisible = true,
  bottomPanelVisible = false,
  leftPanelSize = 20,
  centerPanelSize = 50,
  rightPanelSize = 30,
  leftPanelRef,
  rightPanelRef,
  bottomPanelRef,
  onLeftPanelResize,
  onRightPanelResize,
  onBottomPanelResize,
  toolbar,
}) => {
  // Handle panel visibility with proper expand/collapse
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leftPanelRef?.current && leftPanel) {
        if (leftPanelVisible) {
          leftPanelRef.current.expand();
        } else {
          leftPanelRef.current.collapse();
        }
      }
      
      if (rightPanelRef?.current && rightPanel) {
        if (rightPanelVisible) {
          rightPanelRef.current.expand();
        } else {
          rightPanelRef.current.collapse();
        }
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [leftPanelVisible, rightPanelVisible, leftPanelRef, rightPanelRef, leftPanel, rightPanel]);
  
  const mainContent = (
    <PanelGroup direction="horizontal" className="flex-1">
      {leftPanel && (
        <>
          <Panel
            id="left"
            ref={leftPanelRef}
            defaultSize={leftPanelSize}
            collapsedSize={0}
            collapsible={true}
            minSize={15}
            maxSize={35}
            onResize={onLeftPanelResize}
          >
            <div className="h-full overflow-auto bg-background">
              {leftPanel}
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle resize-handle-horizontal">
            <div className="resize-handle-inner" />
          </PanelResizeHandle>
        </>
      )}
      
      <Panel
        id="center"
        defaultSize={centerPanelSize}
        minSize={30}
      >
        <div className="h-full overflow-auto bg-background">
          {centerPanel || <div className="flex items-center justify-center h-full text-muted-foreground">No content</div>}
        </div>
      </Panel>
      
      {rightPanel && (
        <>
          <PanelResizeHandle className="resize-handle resize-handle-horizontal">
            <div className="resize-handle-inner" />
          </PanelResizeHandle>
          <Panel
            id="right"
            ref={rightPanelRef}
            defaultSize={rightPanelSize}
            collapsedSize={0}
            collapsible={true}
            minSize={20}
            maxSize={50}
            onResize={onRightPanelResize}
          >
            <div className="h-full overflow-auto bg-background">
              {rightPanel}
            </div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );

  return (
    <div className="h-full flex flex-col">
      {toolbar && <div className="border-b px-4 py-2 bg-background">{toolbar}</div>}
      
      {bottomPanel ? (
        <PanelGroup direction="vertical" className="flex-1">
          <Panel id="main" defaultSize={70} minSize={40}>
            {mainContent}
          </Panel>
          {bottomPanelVisible && (
            <>
              <PanelResizeHandle className="resize-handle resize-handle-vertical">
                <div className="resize-handle-inner" />
              </PanelResizeHandle>
              <Panel
                id="bottom"
                ref={bottomPanelRef}
                defaultSize={30}
                minSize={20}
                maxSize={60}
                onResize={onBottomPanelResize}
              >
                <div className="h-full overflow-auto bg-background">
                  {bottomPanel}
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      ) : (
        mainContent
      )}
    </div>
  );
};