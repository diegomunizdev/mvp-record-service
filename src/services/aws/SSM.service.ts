import { Injectable } from '@nestjs/common';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

@Injectable()
export class AwsSsmService {
  private ssm: SSMClient;

  constructor() {
    this.ssm = new SSMClient({
      endpoint: 'http://localhost:4566',
      region: 'sa-east-1',
      credentials: {
        accessKeyId: 'admin',
        secretAccessKey: 'admin',
      },
    });
  }

  async getParameter(name: string): Promise<string> {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true,
    });

    const response = await this.ssm.send(command);
    return response.Parameter?.Value ?? '';
  }
}
