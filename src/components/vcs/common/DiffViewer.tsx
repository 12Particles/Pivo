import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileEdit, GitBranch, Globe, GitMerge, RefreshCw, AlertTriangle } from "lucide-react";
import { gitApi, DiffMode, DiffResult, RebaseStatus, FileDiff } from "@/lib/gitApi";
import { TaskAttempt } from "@/types";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  attempt: TaskAttempt;
}

export function DiffViewer({ attempt }: DiffViewerProps) {
  const { t } = useTranslation();
  const [diffMode, setDiffMode] = useState<'working' | 'branch' | 'remote' | 'merge'>('working');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileDiff | null>(null);

  const loadDiff = async () => {
    if (!attempt.worktree_path) return;
    
    setLoading(true);
    try {
      let mode: DiffMode;
      switch (diffMode) {
        case 'working':
          mode = { type: 'workingDirectory' };
          break;
        case 'branch':
          mode = { 
            type: 'branchChanges', 
            baseCommit: attempt.base_commit || 'HEAD' 
          };
          break;
        case 'remote':
          mode = { 
            type: 'againstRemote', 
            remoteBranch: attempt.base_branch 
          };
          break;
        case 'merge':
          mode = { 
            type: 'mergePreview', 
            targetBranch: attempt.base_branch 
          };
          break;
      }
      
      const result = await gitApi.getDiff(attempt.worktree_path, mode);
      setDiffResult(result);
      
      // Select first file if none selected
      if (result.files.length > 0 && !selectedFile) {
        setSelectedFile(result.files[0]);
      }
    } catch (error) {
      console.error("Failed to load diff:", error);
      toast({
        title: t('common.error'),
        description: "Failed to load diff",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkRebaseStatus = async () => {
    if (!attempt.worktree_path || !attempt.base_branch) return;
    
    try {
      const status = await gitApi.checkRebaseStatus(
        attempt.worktree_path, 
        attempt.base_branch
      );
      setRebaseStatus(status);
    } catch (error) {
      console.error("Failed to check rebase status:", error);
    }
  };

  useEffect(() => {
    loadDiff();
    checkRebaseStatus();
  }, [diffMode, attempt]);

  const getFileStatusColor = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-600';
      case 'deleted':
        return 'text-red-600';
      case 'modified':
        return 'text-blue-600';
      case 'renamed':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getFileStatusSymbol = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return '+';
      case 'deleted':
        return '-';
      case 'modified':
        return 'M';
      case 'renamed':
        return 'R';
      default:
        return '?';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode selector */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <Select value={diffMode} onValueChange={(v: any) => setDiffMode(v)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="working">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4" />
                  <span>Working Directory</span>
                </div>
              </SelectItem>
              <SelectItem value="branch">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>Branch Changes</span>
                </div>
              </SelectItem>
              <SelectItem value="remote">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>Against Remote</span>
                </div>
              </SelectItem>
              <SelectItem value="merge">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-4 h-4" />
                  <span>Merge Preview</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="ghost"
            onClick={loadDiff}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Stats */}
        {diffResult && (
          <div className="flex gap-4 mt-2 text-sm">
            <span>{diffResult.stats.filesChanged} files</span>
            <span className="text-green-600">+{diffResult.stats.additions}</span>
            <span className="text-red-600">-{diffResult.stats.deletions}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* File list */}
        <div className="w-64 border-r">
          <ScrollArea className="h-full">
            {diffResult?.files.map((file) => (
              <div
                key={file.path}
                className={cn(
                  "px-4 py-2 cursor-pointer hover:bg-accent",
                  selectedFile?.path === file.path && "bg-accent"
                )}
                onClick={() => setSelectedFile(file)}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("font-mono text-sm", getFileStatusColor(file.status))}>
                    {getFileStatusSymbol(file.status)}
                  </span>
                  <span className="text-sm truncate">{file.path}</span>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground ml-6">
                  <span className="text-green-600">+{file.additions}</span>
                  <span className="text-red-600">-{file.deletions}</span>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Diff content */}
        <div className="flex-1">
          {selectedFile ? (
            <ScrollArea className="h-full">
              <div className="p-4">
                <h3 className="font-mono text-sm mb-4">{selectedFile.path}</h3>
                {selectedFile.binary ? (
                  <div className="text-muted-foreground">Binary file</div>
                ) : (
                  <pre className="text-xs font-mono">
                    {/* Simple diff display - can be enhanced with syntax highlighting */}
                    {selectedFile.chunks.map((chunk, i) => (
                      <div key={i} className="mb-4">
                        <div className="text-blue-600 bg-blue-50 px-2 py-1">
                          @@ -{chunk.oldStart},{chunk.oldLines} +{chunk.newStart},{chunk.newLines} @@
                        </div>
                        {chunk.lines.map((line, j) => (
                          <div
                            key={j}
                            className={cn(
                              "px-2",
                              line.lineType === 'addition' && "bg-green-50 text-green-800",
                              line.lineType === 'deletion' && "bg-red-50 text-red-800"
                            )}
                          >
                            <span className="select-none pr-2">
                              {line.lineType === 'addition' && '+'}
                              {line.lineType === 'deletion' && '-'}
                              {line.lineType === 'context' && ' '}
                            </span>
                            {line.content}
                          </div>
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a file to view changes
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      {rebaseStatus && rebaseStatus.needsRebase && (
        <div className="border-t p-2 bg-yellow-50">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span>Base branch is {rebaseStatus.commitsBehind} commits ahead</span>
            {rebaseStatus.canFastForward && (
              <span className="text-xs">(can fast-forward)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}