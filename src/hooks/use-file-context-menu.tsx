import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import {
  Copy,
  FolderSearch,
  ExternalLink,
  Eye,
  Terminal,
} from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  openInEditor,
  showInFileManager,
  openInTerminal,
  copyToClipboard,
} from "@/lib/file-operations";
import { getFileName } from "@/lib/path-utils";

interface FileContextMenuOptions {
  filePath: string;
  fileName: string;
  isFile: boolean;
  onViewDiff?: () => void;
}

export function useFileContextMenu() {
  const { t } = useTranslation();

  const handleCopyPath = async (path: string) => {
    try {
      await copyToClipboard(path);
      toast({
        title: t("common.copied", "Copied"),
        description: t("git.pathCopied", "File path copied to clipboard"),
      });
    } catch (error) {
      toast({
        title: t("common.error", "Error"),
        description: t("git.copyFailed", "Failed to copy to clipboard"),
        variant: "destructive",
      });
    }
  };

  const handleCopyFilename = async (name: string) => {
    try {
      await copyToClipboard(name);
      toast({
        title: t("common.copied", "Copied"),
        description: t("git.filenameCopied", "Filename copied to clipboard"),
      });
    } catch (error) {
      toast({
        title: t("common.error", "Error"),
        description: t("git.copyFailed", "Failed to copy to clipboard"),
        variant: "destructive",
      });
    }
  };

  const handleOpenInEditor = async (path: string) => {
    try {
      await openInEditor(path);
    } catch (error) {
      console.error("Failed to open in editor:", error);
      const fileName = getFileName(path);
      toast({
        title: t("common.error", "Error"),
        description: t("git.openInEditorFailed", `Failed to open ${fileName} in editor`),
        variant: "destructive",
      });
    }
  };

  const handleShowInFileManager = async (path: string) => {
    try {
      await showInFileManager(path);
    } catch (error) {
      console.error("Failed to show in file manager:", error);
      const fileName = getFileName(path);
      toast({
        title: t("common.error", "Error"),
        description: t("git.showInFileManagerFailed", `Failed to show ${fileName} in file manager`),
        variant: "destructive",
      });
    }
  };

  const handleOpenInTerminal = async (path: string, isFile: boolean) => {
    try {
      let dirPath = path;
      if (isFile) {
        const lastSlash = path.lastIndexOf("/");
        const lastBackslash = path.lastIndexOf("\\");
        const lastSeparator = Math.max(lastSlash, lastBackslash);
        dirPath = lastSeparator > 0 ? path.substring(0, lastSeparator) : ".";
      }
      await openInTerminal(dirPath);
    } catch (error) {
      console.error("Failed to open in terminal:", error);
      toast({
        title: t("common.error", "Error"),
        description: t("git.openInTerminalFailed", "Failed to open terminal"),
        variant: "destructive",
      });
    }
  };

  const renderContextMenuItems = (options: FileContextMenuOptions) => {
    const { filePath, fileName, isFile, onViewDiff } = options;

    return (
      <>
        {isFile && onViewDiff && (
          <>
            <DropdownMenuItem onClick={onViewDiff}>
              <Eye className="h-4 w-4 mr-2" />
              {t("git.viewDiff", "View Diff")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenInEditor(filePath)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("git.openInEditor", "Open in Editor")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => handleCopyPath(filePath)}>
          <Copy className="h-4 w-4 mr-2" />
          {t("git.copyPath", "Copy Path")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopyFilename(fileName)}>
          <Copy className="h-4 w-4 mr-2" />
          {t("git.copyFilename", "Copy Filename")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleShowInFileManager(filePath)}>
          <FolderSearch className="h-4 w-4 mr-2" />
          {t("git.showInFileManager", "Show in File Manager")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleOpenInTerminal(filePath, isFile)}>
          <Terminal className="h-4 w-4 mr-2" />
          {t("git.openInTerminal", "Open Terminal Here")}
        </DropdownMenuItem>
      </>
    );
  };

  return {
    renderContextMenuItems,
    handleCopyPath,
    handleCopyFilename,
    handleOpenInEditor,
    handleShowInFileManager,
    handleOpenInTerminal,
  };
}