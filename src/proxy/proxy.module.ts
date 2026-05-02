import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ProxyService } from './proxy.service';
import { AuthProxyController } from './controllers/auth-proxy.controller';
import { FlightProxyController } from './controllers/flight-proxy.controller';
import { CheckinProxyController } from './controllers/checkin-proxy.controller';
import { OcrProxyController } from './controllers/ocr-proxy.controller';
import { BoardingProxyController } from './controllers/boarding-proxy.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  controllers: [
    AuthProxyController,
    FlightProxyController,
    CheckinProxyController,
    OcrProxyController,
    BoardingProxyController,
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
