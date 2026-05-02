import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';

@ApiTags('Boarding Pass Proxy')
@ApiBearerAuth('JWT-Auth')
@Controller('boarding-passes')
export class BoardingProxyController {
  private readonly targetUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetUrl = this.configService.get<string>('BOARDING_PASS_SERVICE_URL')!;
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les boarding passes' })
  async findAll(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer par ID' })
  async findOne(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Get('flight/:flight_id')
  @ApiOperation({ summary: 'Récupérer par vol' })
  async findByFlight(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un boarding pass' })
  async create(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un boarding pass' })
  async update(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Patch(':id/invalidate')
  @ApiOperation({ summary: 'Invalider un boarding pass' })
  async invalidate(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un boarding pass' })
  async remove(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }
}
