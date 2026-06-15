import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onApplicationBootstrap() {
    const state = this.connection.readyState;

    if (state === ConnectionStates.connected) {
      this.logger.log(
        `MongoDB connected — ${this.connection.host}/${this.connection.name}`,
      );
    } else {
      this.logger.error(`MongoDB connection failed — state: ${state}`);
    }
  }

  isConnected(): boolean {
    return this.connection.readyState === ConnectionStates.connected;
  }

  getDbName(): string {
    return this.connection.name;
  }
}
