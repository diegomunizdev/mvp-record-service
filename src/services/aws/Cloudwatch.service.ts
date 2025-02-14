import { Injectable } from '@nestjs/common';
import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

@Injectable()
export class CloudWatchLogsService {
  private logs: CloudWatchLogsClient;

  constructor() {
    this.logs = new CloudWatchLogsClient({
      endpoint: 'http://localhost:4566',
      region: 'sa-east-1',
      credentials: {
        accessKeyId: 'admin',
        secretAccessKey: 'admin',
      },
    });
  }

  async sendLogEvent({
    group,
    stream,
    message,
  }: {
    group: string;
    stream: string;
    message: string;
  }) {
    const command = new PutLogEventsCommand({
      logGroupName: group,
      logStreamName: stream,
      logEvents: [
        {
          message: message,
          timestamp: new Date().getTime(),
        },
      ],
    });

    try {
      await this.logs.send(command);
    } catch (error) {
      throw new Error(error);
    }
  }

  async logUpload({ message }: { message: string }) {
    await this.sendLogEvent({
      group: 'upload-group',
      stream: 'upload-stream',
      message,
    });
  }
}
