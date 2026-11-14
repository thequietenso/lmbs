import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeService } from './realtime.service';
import type { Notification } from './realtime.service';
import { AuthService } from '../authentication/auth.service';
import { validateEnvironment } from '../config/environment';
@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin: (
      process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000'
    )
      .split(',')
      .map((x) => x.trim()),
    methods: ['GET', 'POST'],
  },
})
export class RealtimeGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly listener = (notification: Notification) => {
    void this.broadcast(notification).catch(() => undefined);
  };
  constructor(
    private readonly realtime: RealtimeService,
    private readonly auth: AuthService,
  ) {}
  afterInit(server: Server) {
    const origins = validateEnvironment().origins;
    server.use((client, next) => {
      const origin = client.handshake.headers.origin;
      if (origin && !origins.includes(origin))
        return next(new Error('Origin not permitted'));
      const token = client.handshake.auth.token as unknown;
      if (typeof token !== 'string')
        return next(new Error('Authentication required'));
      void this.auth
        .authenticate(token)
        .then((member) => {
          client.data.token = token;
          client.data.memberId = member.id;
          if (['librarian', 'admin'].includes(member.role))
            void client.join('staff');
          next();
        })
        .catch(() => next(new Error('Authentication required')));
    });
    this.realtime.on('notification', this.listener);
  }
  private async broadcast(notification: Notification) {
    // Revalidate account and role on each notification, not only at handshake.
    // This also prevents expired tokens and newly suspended staff retaining private access.
    await Promise.all(
      [...this.server.sockets.sockets.values()].map(async (client) => {
        try {
          const member = await this.auth.authenticate(
            client.data.token as string,
          );
          const staff = ['librarian', 'admin'].includes(member.role);
          if (!staff) {
            await client.leave('staff');
          } else if (!client.rooms.has('staff')) await client.join('staff');
          if (notification.event.startsWith('book.') || staff)
            client.emit(notification.event, notification);
        } catch {
          client.disconnect(true);
        }
      }),
    );
  }
  onModuleDestroy() {
    this.realtime.off('notification', this.listener);
  }
}
