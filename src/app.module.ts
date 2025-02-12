import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AWSModule } from './modules/aws.module';
import { ConfigModule } from '@nestjs/config';
import { UploadGateway } from './services/websocket/upload.service';

@Module({
  imports: [ConfigModule.forRoot(), AWSModule],
  controllers: [AppController],
  providers: [AppService, UploadGateway],
})
export class AppModule {}
