import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

/**
 * Open a file in the default system editor
 */
export async function openInEditor(filePath: string): Promise<void> {
  try {
    await shellOpen(filePath);
  } catch (error) {
    console.error('Failed to open file in editor:', error);
    throw error;
  }
}

/**
 * Show a file in the system file manager
 */
export async function showInFileManager(filePath: string): Promise<void> {
  await invoke("show_in_file_manager", { filePath });
}

/**
 * Open a terminal at the specified directory
 */
export async function openInTerminal(directoryPath: string): Promise<void> {
  await invoke("open_in_terminal", { path: directoryPath });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}