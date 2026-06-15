import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { Task, TaskSchema } from '@modules/tasks/schemas/task.schema';
import { AppConfigModule } from '@config/config.module';
import { AppConfigService } from '@config/config.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    // configure multer to keep files in memory buffer
    // FilesService streams directly to MinIO — no disk needed
    MulterModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: (config: AppConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.maxUploadBytes },
      }),
      inject: [AppConfigService],
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
