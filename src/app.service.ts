import { Injectable } from '@nestjs/common';
import { AwsSsmService } from './services/aws/SSM.service';

@Injectable()
export class AppService {
  constructor(private awsservice: AwsSsmService) {}
  async getHello(): Promise<any> {
    return await this.awsservice.getParameter('TESTANDO');
  }
}
