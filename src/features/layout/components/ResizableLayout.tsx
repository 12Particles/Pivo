import React, { ReactNode } from 'react';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from 'react-resizable-panels';

interface ResizableLayoutProps {
  children: ReactNode[];
  direction?: 'horizontal' | 'vertical';
  defaultSizes?: number[];
  minSizes?: number[];
  maxSizes?: number[];
  storageKey?: string;
  onResize?: (sizes: number[]) => void;
  panelRefs?: React.RefObject<ImperativePanelHandle>[];
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  children,
  direction = 'horizontal',
  defaultSizes,
  minSizes,
  maxSizes,
  storageKey,
  onResize,
  panelRefs,
}) => {
  const handleLayout = (sizes: number[]) => {
    if (onResize) {
      onResize(sizes);
    }
  };

  return (
    <PanelGroup
      direction={direction}
      onLayout={handleLayout}
      autoSaveId={storageKey}
    >
      {React.Children.map(children, (child, index) => {
        const isLast = index === React.Children.count(children) - 1;
        const defaultSize = defaultSizes?.[index];
        const minSize = minSizes?.[index];
        const maxSize = maxSizes?.[index];
        const ref = panelRefs?.[index];

        return (
          <React.Fragment key={index}>
            <Panel
              ref={ref}
              defaultSize={defaultSize}
              minSize={minSize}
              maxSize={maxSize}
              collapsible={true}
            >
              {child}
            </Panel>
            {!isLast && (
              <PanelResizeHandle className={`resize-handle resize-handle-${direction}`}>
                <div className="resize-handle-inner" />
              </PanelResizeHandle>
            )}
          </React.Fragment>
        );
      })}
    </PanelGroup>
  );
};