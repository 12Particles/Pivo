/**
 * Centralized event bus for managing all application events
 * Handles both local events and Tauri events with automatic cleanup
 */

import { listen, emit, Event as TauriEvent } from '@tauri-apps/api/event';
import { AppEvents, AppEventName, EventHandler, UnsubscribeFn } from './EventTypes';
import { logger } from '@/lib/logger';

type TauriUnlistenFn = () => void;

export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<string, Set<EventHandler<any>>>();
  private tauriUnlisteners = new Map<string, TauriUnlistenFn>();
  private eventCounts = new Map<string, number>();
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance of EventBus
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Subscribe to an event with a typed handler
   * Automatically subscribes to both local and Tauri events
   */
  subscribe<T extends AppEventName | string>(
    event: T,
    handler: (payload: T extends AppEventName ? AppEvents[T] : any) => void | Promise<void>
  ): UnsubscribeFn {
    logger.debug(`Subscribing to event: ${event}`);
    
    // Add to local listeners
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    // Subscribe to Tauri event if not already subscribed
    if (!this.tauriUnlisteners.has(event)) {
      listen(event, (tauriEvent: TauriEvent<any>) => {
        this.handleTauriEvent(event, tauriEvent.payload);
      }).then(unlisten => {
        this.tauriUnlisteners.set(event, unlisten);
      }).catch(error => {
        logger.error(`Failed to subscribe to Tauri event: ${event}`, error);
      });
    }
    
    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        
        // If no more handlers, unsubscribe from Tauri event
        if (handlers.size === 0) {
          this.listeners.delete(event);
          const tauriUnlisten = this.tauriUnlisteners.get(event);
          if (tauriUnlisten) {
            tauriUnlisten();
            this.tauriUnlisteners.delete(event);
          }
        }
      }
    };
  }
  
  /**
   * Subscribe to an event that will only fire once
   */
  once<T extends AppEventName | string>(
    event: T,
    handler: (payload: T extends AppEventName ? AppEvents[T] : any) => void | Promise<void>
  ): UnsubscribeFn {
    const wrappedHandler = async (payload: any) => {
      unsubscribe();
      await handler(payload);
    };
    
    const unsubscribe = this.subscribe(event, wrappedHandler);
    return unsubscribe;
  }
  
  /**
   * Emit an event to all listeners (local and Tauri)
   */
  async emit<T extends AppEventName | string>(
    event: T,
    payload: T extends AppEventName ? AppEvents[T] : any
  ): Promise<void> {
    logger.debug(`Emitting event: ${event}`, { payload });
    
    // Track event count for debugging
    this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);
    
    // Emit to local listeners
    const handlers = this.listeners.get(event);
    if (handlers) {
      const promises: Promise<void>[] = [];
      
      handlers.forEach(handler => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            promises.push(result.catch(error => {
              logger.error(`Error in event handler for ${event}:`, error);
            }));
          }
        } catch (error) {
          logger.error(`Sync error in event handler for ${event}:`, error);
        }
      });
      
      // Wait for all async handlers to complete
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }
    
    // Also emit as Tauri event for cross-window communication
    try {
      await emit(event, payload);
    } catch (error) {
      logger.error(`Failed to emit Tauri event: ${event}`, error);
    }
  }
  
  /**
   * Handle events coming from Tauri backend
   */
  private handleTauriEvent(
    event: string,
    payload: any
  ): void {
    logger.debug(`Received Tauri event: ${event}`, { payload });
    
    // Track event count
    this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);
    
    // Dispatch to local handlers
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          const result = handler(payload);
          if (result instanceof Promise) {
            result.catch(error => {
              logger.error(`Error in Tauri event handler for ${event}:`, error);
            });
          }
        } catch (error) {
          logger.error(`Sync error in Tauri event handler for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Remove all listeners for a specific event
   */
  removeAllListeners(event?: AppEventName): void {
    if (event) {
      this.listeners.delete(event);
      const tauriUnlisten = this.tauriUnlisteners.get(event);
      if (tauriUnlisten) {
        tauriUnlisten();
        this.tauriUnlisteners.delete(event);
      }
    } else {
      // Remove all listeners
      this.listeners.clear();
      this.tauriUnlisteners.forEach(unlisten => unlisten());
      this.tauriUnlisteners.clear();
    }
  }
  
  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: AppEventName): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }
  
  /**
   * Get event statistics for debugging
   */
  getEventStats(): Record<string, { listeners: number; emitCount: number }> {
    const stats: Record<string, { listeners: number; emitCount: number }> = {};
    
    this.listeners.forEach((handlers, event) => {
      stats[event] = {
        listeners: handlers.size,
        emitCount: this.eventCounts.get(event) || 0
      };
    });
    
    return stats;
  }
  
  /**
   * Clean up all resources
   */
  destroy(): void {
    logger.info('Destroying EventBus');
    this.removeAllListeners();
    this.eventCounts.clear();
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();