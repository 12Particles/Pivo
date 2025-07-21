import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Columns3
} from 'lucide-react';

interface LayoutToggleButtonsProps {
  leftPanelVisible: boolean;
  bottomPanelVisible: boolean;
  rightPanelVisible: boolean;
  onToggleLeft: () => void;
  onToggleBottom: () => void;
  onToggleRight: () => void;
  onResetLayout: () => void;
}

export const LayoutToggleButtons: React.FC<LayoutToggleButtonsProps> = ({
  leftPanelVisible,
  bottomPanelVisible,
  rightPanelVisible,
  onToggleLeft,
  onToggleBottom,
  onToggleRight,
  onResetLayout,
}) => {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        {/* Reset Layout Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onResetLayout}
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset Layout</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Left Panel Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleLeft}
            >
              {leftPanelVisible ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{leftPanelVisible ? 'Hide Left Panel' : 'Show Left Panel'} (⌘B)</p>
          </TooltipContent>
        </Tooltip>

        {/* Bottom Panel Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleBottom}
            >
              {bottomPanelVisible ? (
                <PanelBottomClose className="h-3.5 w-3.5" />
              ) : (
                <PanelBottomOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{bottomPanelVisible ? 'Hide Bottom Panel' : 'Show Bottom Panel'} (⌘J)</p>
          </TooltipContent>
        </Tooltip>

        {/* Right Panel Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleRight}
            >
              {rightPanelVisible ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{rightPanelVisible ? 'Hide Right Panel' : 'Show Right Panel'} (⌘K)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};