import { Module } from '@nestjs/common';
import { AwsSsmService } from '../services/aws/SSM.service';

@Module({
  providers: [AwsSsmService],
  exports: [AwsSsmService],
})
export class AWSModule {}
