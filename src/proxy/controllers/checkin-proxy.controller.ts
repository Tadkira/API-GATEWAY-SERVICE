import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { ThrottleSeatLock } from '../../common/decorators/throttle.decorator';

@ApiTags('Check-In & Seats')
@Controller()
export class CheckinProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get checkinServiceUrl(): string {
    return this.configService.get<string>('services.checkin')!;
  }

  // /checkin/*
  @ApiBearerAuth('JWT-Auth')
  @All('checkin/*')
  @ApiOperation({ summary: 'Toutes les opérations de check-in (forwarding)' })
  checkin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  // /seats/*
  @ApiBearerAuth('JWT-Auth')
  @All('seats/:flightId')
  @ApiOperation({ summary: 'Récupérer la carte des sièges d\'un vol' })
  @ApiParam({ name: 'flightId', example: 'uuid-vol-123' })
  getSeats(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @ThrottleSeatLock()
  @All('seats/lock')
  @ApiOperation({ summary: 'Verrouiller temporairement un siège' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        flightId: { type: 'string' },
        seatNumber: { type: 'string', example: '12A' },
      },
    },
  })
  lockSeat(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('seats/confirm')
  @ApiOperation({ summary: 'Confirmer la sélection du siège' })
  confirmSeat(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }
}
