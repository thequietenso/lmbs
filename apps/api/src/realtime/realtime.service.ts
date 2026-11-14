import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
export interface Notification {
  event: string;
  payload: unknown;
  timestamp: string;
}
@Injectable()
export class RealtimeService extends EventEmitter {
  override emit(event: string, payload: unknown): boolean {
    return super.emit('notification', {
      event,
      payload,
      timestamp: new Date().toISOString(),
    } satisfies Notification);
  }
}
