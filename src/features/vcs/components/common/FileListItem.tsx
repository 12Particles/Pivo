import { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileContextMenu } from "@/hooks/use-file-context-menu";
import { joinPath, getFileName } from "@/lib/path-utils";

interface FileListItemProps {
  file: string;
  projectPath: string;
  icon: ReactNode;
  selected?: boolean;
  onToggleSelection?: () => void;
  showCheckbox?: boolean;
}

export function FileListItem({
  file,
  projectPath,
  icon,
  selected = false,
  onToggleSelection,
  showCheckbox = true,
}: FileListItemProps) {
  const { renderContextMenuItems } = useFileContextMenu();
  const filePath = joinPath(projectPath, file);
  const fileName = getFileName(file);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div 
          className="flex items-center gap-2 hover:bg-accent/50 p-1 rounded cursor-pointer"
          onContextMenu={(e) => e.preventDefault()}
        >
          {showCheckbox && (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelection}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {icon}
          <span className="text-sm flex-1 truncate">{file}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {renderContextMenuItems({
          filePath,
          fileName,
          isFile: true,
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}