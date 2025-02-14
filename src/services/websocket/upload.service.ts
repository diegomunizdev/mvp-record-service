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
import {
  DynamoDB,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { v4 as uuidV4 } from 'uuid';

@WebSocketGateway(3002, {
  cors: {
    origin: '*', // Permite qualquer origem (ajuste conforme necessário)
  },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private s3: S3Client;
  private dynamodb: DynamoDB;
  private uploadId: string | null = null;
  private parts: { PartNumber: number; ETag: string }[] = [];
  private partNumber = 1;
  private chunks: Buffer[] = [];
  private isMultipart = false;

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

    this.dynamodb = new DynamoDB({
      endpoint: 'http://127.0.0.1:4566',
      region: 'sa-east-1',
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

  async startMultipartUpload(fileKey) {
    const command = new CreateMultipartUploadCommand({
      Bucket: 'mvp-record',
      Key: `stream/${fileKey}.webm`,
      ContentType: 'video/webm',
    });
    const response = await this.s3.send(command);
    this.uploadId = response.UploadId || null;
  }

  async uploadPart(fileKey: string, chunk: Buffer) {
    if (!this.uploadId) await this.startMultipartUpload(fileKey);
    const command = new UploadPartCommand({
      Bucket: 'mvp-record',
      Key: `stream/${fileKey}.webm`,
      UploadId: this.uploadId!,
      PartNumber: this.partNumber,
      Body: chunk,
    });
    const response = await this.s3.send(command);
    this.parts.push({ PartNumber: this.partNumber, ETag: response.ETag! });
    this.partNumber++;
  }

  async completeUpload(fileKey: string) {
    if (this.isMultipart && this.uploadId) {
      const command = new CompleteMultipartUploadCommand({
        Bucket: 'mvp-record',
        Key: `stream/${fileKey}.webm`,
        UploadId: this.uploadId,
        MultipartUpload: { Parts: this.parts },
      });
      await this.s3.send(command);
      console.log('UPLOAD MULTIPART CONCLUÍDO COM SUCESSO!');
    } else {
      const results = await this.dynamodb.send(
        new QueryCommand({
          TableName: 'video_chunk',
          KeyConditionExpression: 'streamId = :s',
          ExpressionAttributeValues: {
            ':s': { S: fileKey },
          },
          ProjectionExpression: 'chunkData, createdAt',
        }),
      );

      const finalBuffer = Buffer.concat(
        results.Items.sort(
          (a, b) =>
            new Date(a.createdAt.S).getTime() -
            new Date(b.createdAt.S).getTime(),
        ).map((i) => Buffer.from(i.chunkData.B)),
      );

      const command = new PutObjectCommand({
        Bucket: 'mvp-record',
        Key: `stream/${fileKey}.webm`,
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
  async handleUploadVideo(
    @MessageBody() data: { streamId: string; buffer: Buffer },
  ) {
    const values = Object.values(data.buffer);
    const uint8Array = new Uint8Array(values);
    const buffer = Buffer.from(uint8Array);
    if (buffer.length > 5 * 1024 * 1024) {
      this.isMultipart = true;
      await this.uploadPart(data.streamId.toString(), buffer);
    } else {
      try {
        const id = uuidV4();
        const params = {
          TableName: 'video_chunk',
          Item: {
            chunkData: { B: buffer },
            id: { S: id.toString() },
            streamId: { S: data.streamId.toString() },
            createdAt: { S: new Date().toISOString() },
          },
        };
        await this.dynamodb.send(new PutItemCommand(params));
        console.log('Salvando chunks');
      } catch (err) {
        console.log(err);
      }
    }
  }

  @SubscribeMessage('end')
  async handleEnd(@MessageBody() data: { streamId: string }) {
    const array = [];
    array.push({ streamId: data.streamId });
    try {
      await this.completeUpload(data.streamId.toString());
    } catch (error) {
      console.log('ERROR:', error);
    }
  }
}
