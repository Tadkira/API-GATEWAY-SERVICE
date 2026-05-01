import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Flights & Bookings')
@Controller()
export class FlightProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get flightServiceUrl(): string {
    return this.configService.get<string>('services.flight')!;
  }

  // /flights/*
  @Public()
  @All('flights/:id')
  @ApiOperation({ summary: 'Détails d\'un vol par son ID' })
  @ApiParam({ name: 'id', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({ status: 200, description: 'Détails du vol' })
  getFlightById(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  @Public()
  @All('flights/number/:flightNumber')
  @ApiOperation({ summary: 'Détails d\'un vol par son numéro' })
  @ApiParam({ name: 'flightNumber', example: 'AH6192' })
  getFlightByNumber(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  // /bookings/*
  @ApiBearerAuth('JWT-Auth')
  @All('bookings/pnr/:pnr')
  @ApiOperation({ summary: 'Récupérer une réservation par PNR' })
  @ApiParam({ name: 'pnr', example: 'ABC123' })
  getBookingByPnr(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('bookings/user/:userId')
  @ApiOperation({ summary: 'Récupérer les réservations d\'un utilisateur' })
  getBookingsByUser(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('bookings/:id')
  @ApiOperation({ summary: 'Détails d\'une réservation par ID' })
  getBookingById(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('bookings/:id/claim')
  @ApiOperation({ summary: 'Lier une réservation (PNR) à son compte' })
  claimBooking(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  // /passengers/*
  @ApiBearerAuth('JWT-Auth')
  @All('passengers/:id')
  @ApiOperation({ summary: 'Détails d\'un passager' })
  getPassengerById(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('passengers/booking/:bookingId')
  @ApiOperation({ summary: 'Liste des passagers d\'une réservation' })
  getPassengersByBooking(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }
}
