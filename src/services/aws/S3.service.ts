import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AwsService {
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

  async uploadFile(bucket: string, key: string, fileBuffer: Buffer) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
    });

    return await this.s3.send(command);
  }
}
