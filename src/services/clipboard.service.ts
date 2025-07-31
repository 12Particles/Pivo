/**
 * Clipboard service using Tauri's clipboard plugin
 */
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

export class ClipboardService {
  /**
   * Write text to clipboard
   */
  static async writeText(text: string): Promise<void> {
    try {
      await writeText(text);
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
      // Fallback to browser API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    }
  }

  /**
   * Read text from clipboard
   */
  static async readText(): Promise<string> {
    try {
      const text = await readText();
      return text || '';
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
      // Fallback to browser API if available
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
      return '';
    }
  }
}