/**
 * React hook for subscribing to events with automatic cleanup
 */

import { useEffect } from 'react';
import { eventBus } from './EventBus';
import { AppEventName, EventHandler } from './EventTypes';

/**
 * Hook to subscribe to events with automatic cleanup on unmount
 * @param event - The event name to subscribe to
 * @param handler - The handler function to call when the event is emitted
 * @param deps - Optional dependency array to control when the handler is re-subscribed
 */
export function useEvent<T extends AppEventName>(
  event: T,
  handler: EventHandler<T>,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(event, handler);
    
    return () => {
      unsubscribe();
    };
  }, [event, ...deps]);
}

/**
 * Hook to emit an event
 * @returns A function to emit events
 */
export function useEmitEvent() {
  return eventBus.emit.bind(eventBus);
}