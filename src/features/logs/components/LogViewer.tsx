import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download, Trash2, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";

interface LogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogViewer({ open, onOpenChange }: LogViewerProps) {
  const { t } = useTranslation();
  const [backendLogs, setBackendLogs] = useState<string>("");
  const [frontendLogs, setFrontendLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadBackendLogs = async () => {
    try {
      const logs = await invoke<string>("get_log_content", { lines: 1000 });
      setBackendLogs(logs);
    } catch (error) {
      console.error("Failed to load backend logs:", error);
      setBackendLogs(t('logs.failedToLoad'));
    }
  };

  const loadFrontendLogs = async () => {
    try {
      const logs = await readTextFile("logs/frontend.log", { 
        baseDir: BaseDirectory.AppData 
      });
      setFrontendLogs(logs);
    } catch (error) {
      console.error("Failed to load frontend logs:", error);
      setFrontendLogs(t('logs.failedToLoad'));
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    await Promise.all([loadBackendLogs(), loadFrontendLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadLogs();
    }
  }, [open]);

  useEffect(() => {
    let interval: number;
    if (autoRefresh && open) {
      interval = setInterval(loadLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, open]);

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
    } catch (error) {
      console.error(`Failed to clear ${type} logs:`, error);
    }
  };

  const handleOpenInEditor = async () => {
    try {
      await invoke("open_log_file");
    } catch (error) {
      console.error("Failed to open log file:", error);
    }
  };

  const LogContent = ({ content, type }: { content: string; type: 'backend' | 'frontend' }) => (
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
      <ScrollArea className="h-[500px] w-full rounded-md border bg-zinc-900 dark:bg-zinc-950 p-4">
        <pre className="text-xs text-green-600 dark:text-green-400 font-mono whitespace-pre-wrap">
          {content || t('logs.noLogs')}
        </pre>
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('logs.applicationLogs')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="backend" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="backend">{t('logs.backendLogs')}</TabsTrigger>
            <TabsTrigger value="frontend">{t('logs.frontendLogs')}</TabsTrigger>
          </TabsList>
          <TabsContent value="backend">
            <LogContent content={backendLogs} type="backend" />
          </TabsContent>
          <TabsContent value="frontend">
            <LogContent content={frontendLogs} type="frontend" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}