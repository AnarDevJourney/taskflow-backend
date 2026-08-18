import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfigService } from '@config/config.service';
import { toObjectId } from '@common/utils/object-id';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { WS_EVENT_COUNT, WS_EVENT_NEW } from './notifications.constants';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
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
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  // ─── Connection lifecycle ────────────────────────────────────────
  async handleConnection(socket: Socket) {
    const token = this.extractToken(socket);

    if (!token) {
      // tell the client *why* — it refreshes its access token and retries
      // instead of reconnect-looping forever against an expired cookie
      socket.emit('unauthorized', { reason: 'missing_token' });
      socket.disconnect();
      return;
    }

    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.jwtSecret,
      });
      userId = payload.sub;
    } catch {
      socket.emit('unauthorized', { reason: 'invalid_token' });
      socket.disconnect();
      return;
    }

    // room per user — the worker pushes to `user:<id>`, which reaches every
    // tab that user has open without tracking socket ids at the call site
    await socket.join(`user:${userId}`);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);
    socket.data.userId = userId;

    // seed the bell badge immediately on connect, so a freshly opened tab
    // is correct before the first REST call resolves
    socket.emit(WS_EVENT_COUNT, { unreadCount: await this.unreadCount(userId) });

    this.logger.log(`User ${userId} connected (socket: ${socket.id})`);
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data?.userId;
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    sockets?.delete(socket.id);
    if (sockets && sockets.size === 0) {
      this.userSockets.delete(userId);
    }
    this.logger.log(`User ${userId} disconnected (socket: ${socket.id})`);
  }

  // ─── Push helpers (called by the BullMQ worker and the service) ──
  // one new notification + the recipient's authoritative unread count, so
  // the client never has to derive the badge number itself
  pushNotification(
    userId: string,
    notification: unknown,
    unreadCount: number,
  ): void {
    this.server
      .to(`user:${userId}`)
      .emit(WS_EVENT_NEW, { notification, unreadCount });
  }

  // count-only update — used when notifications are marked read, so other
  // open tabs of the same user stay in sync
  pushUnreadCount(userId: string, unreadCount: number): void {
    this.server.to(`user:${userId}`).emit(WS_EVENT_COUNT, { unreadCount });
  }

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  // access_token lives in an HttpOnly cookie, so the browser can't put it
  // into handshake.auth — read the handshake's Cookie header first and only
  // then fall back to the explicit forms (native/mobile clients, tests)
  private extractToken(socket: Socket): string | null {
    const cookieHeader = socket.handshake.headers?.cookie;
    if (cookieHeader) {
      for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === 'access_token' && rest.length) {
          return decodeURIComponent(rest.join('='));
        }
      }
    }

    const authToken = (socket.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (authToken) return authToken;

    const header = socket.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    return null;
  }

  private unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId: toObjectId(userId),
      isRead: false,
    });
  }
}
