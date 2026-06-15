import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@config/config.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // userId → Set of socket IDs (user can have multiple tabs open)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private config: AppConfigService,
  ) {}

  // ─── Connection lifecycle ────────────────────────────────────────
  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.jwtSecret,
      });

      const userId: string = payload.sub;

      // join a room named after the userId for targeted pushes
      socket.join(`user:${userId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      socket.data.userId = userId;
      this.logger.log(`User ${userId} connected (socket: ${socket.id})`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data?.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(socket.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
      this.logger.log(`User ${userId} disconnected (socket: ${socket.id})`);
    }
  }

  // ─── Push to user ────────────────────────────────────────────────
  // called by NotificationsService to push real-time notification
  pushToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }
}
