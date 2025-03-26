import type {
  BroadcastMessage,
} from './api';

import zod from 'zod';

export interface WsEvent<T> {
  type: T,
  data: unknown
}

export const EventSchema = zod.object({
  type: zod.string(),
  data: zod.any(),
});

export interface MessageSendFromClient extends WsEvent<'send-message'> {
  data: string;
}

export interface MessageReceiveFromServer extends WsEvent<'receive-message'> {
  data: BroadcastMessage;
}

export interface HeartbeatEvent extends WsEvent<'heartbeat'> {
  data: {
    heartbeat: 'ping' | 'pong'
  };
}

export type WsEventMap = {
  'send-message': MessageSendFromClient
  'receive-message': MessageReceiveFromServer
  'heartbeat': HeartbeatEvent
}

export type DefaultEvent = WsEventMap[keyof WsEventMap];

export interface WsEventListener {
  register<T extends keyof WsEventMap, E extends WsEventMap[T]>(event: T, callback: (event: E) => Promise<void>): void;

  call<T extends keyof WsEventMap, E extends WsEventMap[T]>(event: string, data: E): void;

  resolve(rawEvent: WsEvent<string>): void;
}

export class CommonWsListener implements WsEventListener {
  map = new Map<keyof WsEventMap, Set<<E extends WsEvent<string>>(event: E) => Promise<void>>>();

  register<T extends keyof WsEventMap, E extends WsEventMap[T]>(event: T, callback: (event: E) => Promise<void>): void {
    if (!this.map.has(event)) {
      this.map.set(event, new Set());
    }
    this.map.get(event)?.add(callback as any);
  }

  async call<T extends keyof WsEventMap, E extends WsEventMap[T]>(event: string, data: E): Promise<void> {
    const callbacks = this.map.get(event as keyof WsEventMap);
    if (callbacks) {
      for (const callback of callbacks) {
        await callback(data);
      }
    }
  }

  async resolve(rawEvent: WsEvent<string>) {
    await this.call(rawEvent.type, rawEvent as WsEventMap[keyof WsEventMap]);
  }
}

type EventData<T extends keyof WsEventMap> = WsEventMap[T]['data']

export function emit<N extends keyof WsEventMap>(this: WebSocket, eventName: N, event: EventData<N>) {
  this.send(JSON.stringify({
    type: eventName,
    data: event
  }));
}

declare module 'ws'{
  interface WebSocket {
    myEmit<N extends keyof WsEventMap>(eventName: N, event: EventData<N>): void;
  }
}
