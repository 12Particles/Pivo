/**
 * React hook for subscribing to events with automatic cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import { eventBus } from '@/lib/events/EventBus';
import { AppEventName, EventHandler } from '@/lib/events/EventTypes';

/**
 * Subscribe to an event with automatic cleanup on unmount
 */
export function useEvent<T extends AppEventName>(
  event: T,
  handler: EventHandler<T>,
  deps: React.DependencyList = []
): void {
  const savedHandler = useRef<EventHandler<T>>();
  
  // Update handler ref on each render
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  
  useEffect(() => {
    // Create stable handler that calls the latest version
    const stableHandler: EventHandler<T> = (payload) => {
      if (savedHandler.current) {
        return savedHandler.current(payload);
      }
    };
    
    // Subscribe to event
    const unsubscribe = eventBus.subscribe(event, stableHandler);
    
    // Cleanup on unmount or when deps change
    return () => {
      unsubscribe();
    };
  }, [event, ...deps]);
}

/**
 * Get an event emitter function
 */
export function useEventEmitter() {
  return useCallback(async <T extends AppEventName | string>(
    event: T,
    payload: T extends AppEventName ? import('@/lib/events/EventTypes').AppEvents[T] : any
  ) => {
    await eventBus.emit(event, payload);
  }, []);
}

/**
 * Subscribe to an event that only fires once
 */
export function useEventOnce<T extends AppEventName>(
  event: T,
  handler: EventHandler<T>,
  deps: React.DependencyList = []
): void {
  const savedHandler = useRef<EventHandler<T>>();
  
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  
  useEffect(() => {
    const stableHandler: EventHandler<T> = (payload) => {
      if (savedHandler.current) {
        return savedHandler.current(payload);
      }
    };
    
    const unsubscribe = eventBus.once(event, stableHandler);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [event, ...deps]);
}

/**
 * Hook to get event statistics for debugging
 */
export function useEventStats() {
  return useCallback(() => {
    return eventBus.getEventStats();
  }, []);
}