import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

  @SubscribeMessage('message')
  async handleUploadVideo(@MessageBody() data: Buffer) {
    try {
      // Converte o vídeo (blob) para um stream legível
      // Configuração do S3 para upload do vídeo
      const params = {
        Bucket: 'mvp-record',
        Key: `stream/${Date.now()}.webm`, // Nome do arquivo no S3
        Body: data,
        ContentType: 'video/webm',
      };

      // Realiza o upload do vídeo para o S3
      const command = new PutObjectCommand(params);
      const saved = await this.s3.send(command);

      console.log('Upload bem-sucedido', saved);
      // Envia uma confirmação de sucesso para o cliente
      return { message: 'Upload bem-sucedido!' };
    } catch (error) {
      console.error('Erro no upload:', error);
      return { message: 'Erro no upload', error };
    }
  }
}
