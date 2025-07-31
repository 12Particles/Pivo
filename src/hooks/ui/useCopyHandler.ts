/**
 * Global copy/paste handler to fix clipboard functionality in Tauri WebView
 */

import { useEffect } from 'react';
import { ClipboardService } from '@/services/clipboard.service';

export function useCopyHandler() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Handle Ctrl/Cmd + C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          e.preventDefault();
          try {
            await ClipboardService.writeText(selection.toString());
          } catch (error) {
            console.error('Copy failed:', error);
          }
        }
      }
      
      // Handle Ctrl/Cmd + V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          e.preventDefault();
          try {
            const text = await ClipboardService.readText();
            if (text) {
              const target = activeElement as HTMLInputElement | HTMLTextAreaElement;
              const start = target.selectionStart || 0;
              const end = target.selectionEnd || 0;
              const value = target.value;
              const newValue = value.substring(0, start) + text + value.substring(end);
              
              target.value = newValue;
              target.selectionStart = target.selectionEnd = start + text.length;
              
              // Trigger input event for React
              const event = new Event('input', { bubbles: true });
              target.dispatchEvent(event);
            }
          } catch (error) {
            console.error('Paste failed:', error);
          }
        }
      }
      
      // Handle Ctrl/Cmd + A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey && !e.altKey) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          e.preventDefault();
          const target = activeElement as HTMLInputElement | HTMLTextAreaElement;
          target.select();
        }
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
}