import { Controller, Get } from '@nestjs/common';
import { Public } from './common/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'online', service: 'maretravel-backend' };
  }
}