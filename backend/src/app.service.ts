import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { message: string; version: string; status: string } {
    return {
      message: 'Hello from BrewLite Backend API!',
      version: '1.0.0',
      status: 'active',
    };
  }
}
