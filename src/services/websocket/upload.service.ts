import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
@WebSocketGateway(3002, {
  cors: {
    origin: '*', // Permite qualquer origem (ajuste conforme necessário)
    methods: ['GET', 'POST'],
  },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(UploadGateway.name);
  private s3: S3Client;
  private clients = new Map<string, Buffer[]>(); // Armazena buffers temporários por cliente

  constructor() {
    this.s3 = new S3Client({
      endpoint: 'http://localhost:4566',
      region: 'sa-east-1',
      credentials: {
        accessKeyId: 'admin',
        secretAccessKey: 'admin',
      },
    });
  }

  handleConnection(client: Socket) {
    this.clients.set(client.id, []);
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('upload')
  handleUpload(@MessageBody() data: Buffer, client: Socket) {
    if (this.clients.has(client.id)) {
      this.clients.get(client.id)?.push(data);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { message: 'pong' });
  }

  @SubscribeMessage('stop')
  async handleStop(client: Socket) {
    if (!this.clients.has(client.id)) return;

    const finalBuffer = Buffer.concat(this.clients.get(client.id) || []);
    const fileName = `recordings/${uuidv4()}.webm`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: 'mvp-record',
          Key: fileName,
          Body: finalBuffer,
          ContentType: 'video/webm',
        }),
      );

      this.logger.log(`File uploaded to S3: ${fileName}`);
      client.emit('uploadComplete', { success: true, fileName });
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      client.emit('uploadComplete', { success: false, error: error.message });
    }

    this.clients.delete(client.id);
  }
}
