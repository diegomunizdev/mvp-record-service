import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';

@WebSocketGateway(3002, {
  cors: {
    origin: '*', // Permite qualquer origem (ajuste conforme necessário)
  },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private s3: S3Client;
  private uploadId: string | null = null;
  private parts: { PartNumber: number; ETag: string }[] = [];
  private partNumber = 1;
  private chunks: Buffer[] = [];
  private isMultipart = false;
  private fileKey = `stream/${Date.now()}.webm`;

  constructor() {
    this.s3 = new S3Client({
      endpoint: 'http://127.0.0.1:4566',
      region: 'sa-east-1',
      forcePathStyle: true, // Importante para compatibilidade com LocalStack
      credentials: {
        accessKeyId: 'admin',
        secretAccessKey: 'admin',
      },
    });
  }
  // Quando um cliente se conecta
  handleConnection(client: any) {
    console.log('Cliente conectado');
  }

  // Quando um cliente se desconecta
  handleDisconnect(client: any) {
    console.log('Cliente desconectado');
  }

  async startMultipartUpload() {
    const command = new CreateMultipartUploadCommand({
      Bucket: 'mvp-record',
      Key: this.fileKey,
      ContentType: 'video/webm',
    });
    const response = await this.s3.send(command);
    this.uploadId = response.UploadId || null;
  }

  async uploadPart(chunk: Buffer) {
    if (!this.uploadId) await this.startMultipartUpload();
    const command = new UploadPartCommand({
      Bucket: 'mvp-record',
      Key: this.fileKey,
      UploadId: this.uploadId!,
      PartNumber: this.partNumber,
      Body: chunk,
    });
    const response = await this.s3.send(command);
    this.parts.push({ PartNumber: this.partNumber, ETag: response.ETag! });
    this.partNumber++;
  }

  async completeUpload() {
    if (this.isMultipart && this.uploadId) {
      const command = new CompleteMultipartUploadCommand({
        Bucket: 'mvp-record',
        Key: this.fileKey,
        UploadId: this.uploadId,
        MultipartUpload: { Parts: this.parts },
      });
      await this.s3.send(command);
      console.log('UPLOAD MULTIPART CONCLUÍDO COM SUCESSO!');
    } else {
      const finalBuffer = Buffer.concat(this.chunks);
      const command = new PutObjectCommand({
        Bucket: 'mvp-record',
        Key: this.fileKey,
        Body: finalBuffer,
        ContentType: 'video/webm',
      });
      await this.s3.send(command);
      console.log('UPLOAD CONCLUÍDO COM SUCESSO!');
    }
    this.resetUploadState();
  }

  resetUploadState() {
    this.uploadId = null;
    this.parts = [];
    this.partNumber = 1;
    this.chunks = [];
    this.isMultipart = false;
  }

  @SubscribeMessage('message')
  async handleUploadVideo(@MessageBody() data: Buffer) {
    const values = Object.values(data);
    const uint8Array = new Uint8Array(values);
    const buffer = Buffer.from(uint8Array);
    if (buffer.length > 5 * 1024 * 1024) {
      this.isMultipart = true;
      await this.uploadPart(buffer);
    } else {
      this.chunks.push(buffer);
      console.log('Salvando chunks:', this.chunks?.length);
    }
  }

  @SubscribeMessage('end')
  async handleEnd() {
    console.log('# GRAVAÇÃO FINALIZADA.');
    await this.completeUpload();
  }
}
