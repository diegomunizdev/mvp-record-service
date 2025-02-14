import { Module } from '@nestjs/common';
import { AwsSsmService } from '../services/aws/SSM.service';
import { CloudWatchLogsService } from 'src/services/aws/Cloudwatch.service';

@Module({
  providers: [AwsSsmService, CloudWatchLogsService],
  exports: [AwsSsmService, CloudWatchLogsService],
})
export class AWSModule {}
