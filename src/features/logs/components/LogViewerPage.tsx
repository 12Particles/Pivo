import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download, Trash2, ExternalLink, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile, BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";

export function LogViewerPage() {
  const { t } = useTranslation();
  const [backendLogs, setBackendLogs] = useState<string>("");
  const [frontendLogs, setFrontendLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logPath, setLogPath] = useState<string>("");

  const loadBackendLogs = async () => {
    try {
      console.log('Loading backend logs...');
      // Get the log path first
      const path = await invoke<string>("get_log_path");
      setLogPath(path);
      console.log('Backend log path:', path);
      
      const logs = await invoke<string>("get_log_content", { lines: 1000 });
      console.log('Backend logs loaded, length:', logs.length);
      setBackendLogs(logs);
    } catch (error) {
      console.error("Failed to load backend logs:", error);
      setBackendLogs(`${t('logs.failedToLoad')}\n\nError: ${error}`);
    }
  };

  const loadFrontendLogs = async () => {
    try {
      console.log('Loading frontend logs...');
      // First check if the file exists
      const logExists = await exists("logs/frontend.log", { 
        baseDir: BaseDirectory.AppData 
      });
      console.log('Frontend log exists:', logExists);
      
      if (!logExists) {
        // First ensure the logs directory exists
        const dirExists = await exists("logs", { baseDir: BaseDirectory.AppData });
        if (!dirExists) {
          await mkdir("logs", { baseDir: BaseDirectory.AppData, recursive: true });
        }
        // Create the file if it doesn't exist
        await writeTextFile("logs/frontend.log", "Frontend log initialized\n", {
          baseDir: BaseDirectory.AppData
        });
      }
      
      const logs = await readTextFile("logs/frontend.log", { 
        baseDir: BaseDirectory.AppData 
      });
      console.log('Frontend logs loaded, length:', logs.length);
      setFrontendLogs(logs);
    } catch (error) {
      console.error("Failed to load frontend logs:", error);
      setFrontendLogs(`${t('logs.failedToLoad')}\n\nError: ${error}`);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    await Promise.all([loadBackendLogs(), loadFrontendLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    console.log('LogViewerPage mounted, loading logs...');
    loadLogs();
  }, []);

  useEffect(() => {
    let interval: number;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleExport = async (type: 'backend' | 'frontend') => {
    const content = type === 'backend' ? backendLogs : frontendLogs;
    const defaultName = `pivo-${type}-logs-${new Date().toISOString().split('T')[0]}.log`;
    
    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: 'Log files',
        extensions: ['log', 'txt']
      }]
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      toast({
        title: t('common.success'),
        description: t('logs.exportSuccess'),
      });
    }
  };

  const handleClear = async (type: 'backend' | 'frontend') => {
    if (!confirm(t('common.confirm'))) return;

    try {
      if (type === 'backend') {
        await invoke("clear_logs");
        setBackendLogs("");
      } else {
        await writeTextFile("logs/frontend.log", "", {
          baseDir: BaseDirectory.AppData
        });
        setFrontendLogs("");
      }
      await loadLogs();
      toast({
        title: t('common.success'),
        description: t('logs.logsCleared'),
      });
    } catch (error) {
      console.error(`Failed to clear ${type} logs:`, error);
      toast({
        title: t('common.error'),
        description: t('logs.clearFailed'),
        variant: "destructive",
      });
    }
  };

  const handleOpenInEditor = async () => {
    try {
      await invoke("open_log_file");
    } catch (error) {
      console.error("Failed to open log file:", error);
      toast({
        title: t('common.error'),
        description: t('logs.openFailed'),
        variant: "destructive",
      });
    }
  };

  const handleClose = async () => {
    const currentWindow = getCurrentWindow();
    await currentWindow.close();
  };

  const LogContent = ({ content, type }: { content: string; type: 'backend' | 'frontend' }) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    
    // Auto-scroll to bottom when content changes and auto-refresh is enabled
    useEffect(() => {
      if (autoRefresh && scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, [content]);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport(type)}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('logs.export')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleClear(type)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('logs.clear')}
            </Button>
            {type === 'backend' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenInEditor}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {t('logs.openInEditor')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              {t('logs.autoRefresh')}
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-200px)] w-full rounded-md border bg-black p-4">
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
            {content || t('logs.noLogs')}
          </pre>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('logs.applicationLogs')}</h1>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Tabs defaultValue="backend" className="w-full h-[calc(100vh-100px)]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="backend">{t('logs.backendLogs')}</TabsTrigger>
          <TabsTrigger value="frontend">{t('logs.frontendLogs')}</TabsTrigger>
        </TabsList>
        <TabsContent value="backend" className="h-[calc(100%-48px)]">
          <LogContent content={backendLogs} type="backend" />
        </TabsContent>
        <TabsContent value="frontend" className="h-[calc(100%-48px)]">
          <LogContent content={frontendLogs} type="frontend" />
        </TabsContent>
      </Tabs>
      {logPath && (
        <div className="mt-2 text-xs text-muted-foreground">
          Log path: {logPath}
        </div>
      )}
      <Toaster />
    </div>
  );
}