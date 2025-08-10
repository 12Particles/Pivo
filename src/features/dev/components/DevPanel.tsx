import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Loader2, Trash2 } from 'lucide-react';
import { Project } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { useEvent } from '@/lib/events';

interface DevPanelProps {
  project: Project;
}

interface DevServerState {
  processId: string | null;
  status: 'idle' | 'starting' | 'running' | 'stopping';
  output: string[];
}

export function DevPanel({ project }: DevPanelProps) {
  const { toast } = useToast();
  const [devServer, setDevServer] = useState<DevServerState>({
    processId: null,
    status: 'idle',
    output: []
  });
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Maximum number of output lines to keep in memory
  const MAX_OUTPUT_LINES = 1000;
  
  // Handle process output events using useEvent hook
  useEvent('dev-server-output', useCallback((payload: { process_id: string; type: string; data: string }) => {
    console.log('[DEV_PANEL] Received output event:', payload);
    
    // Use functional state update to access current processId
    setDevServer(prev => {
      if (payload.process_id === prev.processId) {
        console.log('[DEV_PANEL] Processing output for our process');
        // Keep only the last MAX_OUTPUT_LINES to prevent memory issues
        const newOutput = [...prev.output, payload.data];
        const trimmedOutput = newOutput.length > MAX_OUTPUT_LINES 
          ? newOutput.slice(-MAX_OUTPUT_LINES)
          : newOutput;
        
        // Auto-scroll to bottom with debouncing
        requestAnimationFrame(() => {
          outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        
        return {
          ...prev,
          output: trimmedOutput
        };
      } else {
        console.log('[DEV_PANEL] Ignoring output for different process:', payload.process_id, 'vs', prev.processId);
        return prev; // No state change
      }
    });
  }, []));

  // Handle process completion events
  useEvent('dev-server-stopped', useCallback((payload: { process_id: string; exit_code?: number }) => {
    setDevServer(prev => {
      if (payload.process_id === prev.processId) {
        return {
          ...prev,
          status: 'idle',
          processId: null,
          output: [...prev.output, `\n✅ Dev server stopped${payload.exit_code !== undefined ? ` (exit code: ${payload.exit_code})` : ''}`]
        };
      }
      return prev; // No state change
    });
  }, []));

  const startDevServer = useCallback(async () => {
    if (!project.dev_script) {
      toast({
        title: 'No dev script configured',
        description: 'Please configure a dev script in project settings',
        variant: 'destructive'
      });
      return;
    }

    console.log('[DEV_PANEL] Starting dev server with command:', project.dev_script);
    
    setDevServer(prev => ({
      ...prev,
      status: 'starting',
      output: [...prev.output, '\n🚀 Starting development server...', `📁 Working directory: ${project.path}`, `🖥️ Command: ${project.dev_script}`]
    }));

    try {
      // Start dev server using Tauri command
      console.log('[DEV_PANEL] Calling start_dev_server');
      const result = await invoke<{ process_id: string }>('start_dev_server', {
        projectPath: project.path,
        command: project.dev_script
      });

      console.log('[DEV_PANEL] Dev server started with result:', result);
      
      setDevServer(prev => ({
        ...prev,
        status: 'running',
        processId: result.process_id,
        output: [...prev.output, `✅ Dev server started (Process ID: ${result.process_id})\n`]
      }));

    } catch (error) {
      console.error('Failed to start dev server:', error);
      
      // Extract meaningful error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error occurred';
      
      setDevServer(prev => ({
        ...prev,
        status: 'idle',
        output: [...prev.output, `\n❌ Error: ${errorMessage}`]
      }));
      
      toast({
        title: 'Failed to start dev server',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  }, [project, toast]);

  const stopDevServer = useCallback(async () => {
    if (!devServer.processId) return;

    setDevServer(prev => ({
      ...prev,
      status: 'stopping',
      output: [...prev.output, '\n⏹️ Stopping development server...']
    }));

    try {
      await invoke('stop_dev_server', {
        processId: devServer.processId
      });
      
      // The actual state update will be handled by the dev-server-stopped event

    } catch (error) {
      console.error('Failed to stop dev server:', error);
      
      // Extract meaningful error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error occurred';
      
      setDevServer(prev => ({
        ...prev,
        status: 'idle',
        processId: null,
        output: [...prev.output, `\n❌ Error stopping server: ${errorMessage}`]
      }));
      
      toast({
        title: 'Failed to stop dev server',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  }, [devServer.processId, toast]);

  const clearOutput = useCallback(() => {
    setDevServer(prev => ({
      ...prev,
      output: []
    }));
  }, []);

  const isRunning = devServer.status === 'running';
  const isProcessing = devServer.status === 'starting' || devServer.status === 'stopping';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Development Server</span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Running
            </span>
          )}
          {!isRunning && !isProcessing && (
            <span className="text-sm text-muted-foreground">Stopped</span>
          )}
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {devServer.status === 'starting' ? 'Starting...' : 'Stopping...'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {devServer.output.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearOutput}
              disabled={isProcessing}
              className="h-8"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          
          <Button
            onClick={isRunning ? stopDevServer : startDevServer}
            disabled={isProcessing || !project.dev_script}
            variant={isRunning ? "destructive" : "default"}
            size="sm"
            className="h-8 min-w-[80px]"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isProcessing && (isRunning ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />)}
            {isRunning ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Dev Script Info */}
      {project.dev_script ? (
        <div className="px-4 py-2.5 bg-muted/30 border-b">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Command:</span>
            <code className="font-mono text-xs bg-background/50 px-2 py-0.5 rounded border">
              {project.dev_script}
            </code>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            ⚠️ No dev script configured. Please configure it in project settings.
          </p>
        </div>
      )}

      {/* Output Area */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4">
          {/* Show warning if output is truncated */}
          {devServer.output.length >= MAX_OUTPUT_LINES && (
            <div className="mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Output limited to last {MAX_OUTPUT_LINES} lines to prevent memory issues
            </div>
          )}
          
          {devServer.output.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-muted-foreground">
                {project.dev_script ? (
                  <>
                    <p className="mb-2">Ready to start the development server</p>
                    <p className="text-sm opacity-75">Click "Start" to run: {project.dev_script}</p>
                  </>
                ) : (
                  <p>Configure a dev script in project settings to get started</p>
                )}
              </div>
            </div>
          ) : (
            <div className="font-mono text-sm space-y-0.5">
              {devServer.output.map((line, index) => {
                // Apply different styles based on content
                let className = "leading-relaxed whitespace-pre-wrap break-all px-2 py-0.5 -mx-2 rounded";
                
                if (line.startsWith('❌')) {
                  className += " text-red-600 dark:text-red-400 bg-red-500/10";
                } else if (line.startsWith('✅')) {
                  className += " text-green-600 dark:text-green-400 bg-green-500/10";
                } else if (line.startsWith('🚀') || line.startsWith('📁') || line.startsWith('🖥️')) {
                  className += " text-blue-600 dark:text-blue-400";
                } else if (line.startsWith('⏹️')) {
                  className += " text-amber-600 dark:text-amber-400";
                } else {
                  className += " hover:bg-muted/20";
                }
                
                return (
                  <div key={index} className={className}>
                    {line}
                  </div>
                );
              })}
              <div ref={outputEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}