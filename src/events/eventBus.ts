import { TrackerEvent, EventCode, Severity } from "../types";

export type EventListener = (event: TrackerEvent) => void;

export class EventBus {
  private listeners: Set<EventListener> = new Set();
  private eventHistory: TrackerEvent[] = [];
  private maxHistory: number = 2000;

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(
    sessionId: string,
    tS: number,
    severity: Severity,
    code: EventCode,
    message: string,
    data?: Record<string, number | string | boolean>
  ): TrackerEvent {
    const event: TrackerEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      tS,
      wallClockIso: new Date().toISOString(),
      severity,
      code,
      message,
      data,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in event listener:", err);
      }
    }

    return event;
  }

  getHistory(): TrackerEvent[] {
    return [...this.eventHistory];
  }

  clear(): void {
    this.eventHistory = [];
  }
}

export const globalEventBus = new EventBus();
