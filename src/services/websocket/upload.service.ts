import { Logger } from '@nestjs/common';
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
import { Readable } from 'stream';

@WebSocketGateway(3002, {
  cors: {
    origin: '*', // Permite qualquer origem (ajuste conforme necessário)
  },
})
export class UploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private s3: S3Client;

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
  // Quando um cliente se conecta
  handleConnection(client: any) {
    console.log('Cliente conectado', client.id);
  }

  // Quando um cliente se desconecta
  handleDisconnect(client: any) {
    console.log('Cliente desconectado', client.id);
  }

  @SubscribeMessage('upload')
  async handleUploadVideo(@MessageBody() videoBlob: any) {
    try {
      // Converte o vídeo (blob) para um stream legível
      const videoStream = Readable.from(videoBlob);

      // Configuração do S3 para upload do vídeo
      const params = {
        Bucket: 'your-bucket-name',
        Key: `videos/${Date.now()}.webm`, // Nome do arquivo no S3
        Body: videoStream,
        ContentType: 'video/webm',
      };

      // Realiza o upload do vídeo para o S3
      const command = new PutObjectCommand(params);
      const data = await this.s3.send(command);

      console.log('Upload bem-sucedido', data);

      // Envia uma confirmação de sucesso para o cliente
      return { message: 'Upload bem-sucedido!' };
    } catch (error) {
      console.error('Erro no upload:', error);
      return { message: 'Erro no upload' };
    }
  }
}
