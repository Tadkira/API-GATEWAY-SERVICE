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
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';

@ApiTags('Boarding Pass')
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

  // ─── GET /boarding-passes ─────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Lister tous les boarding passes',
    description: 'Retourne tous les boarding passes. Principalement à usage admin/système.',
  })
  @ApiResponse({ status: 200, description: 'Liste des boarding passes' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async findAll(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── GET /boarding-passes/:id ─────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un boarding pass par ID',
    description: 'Retourne les détails d\'un boarding pass, y compris le QR Code et le lien PDF.',
  })
  @ApiResponse({ status: 200, description: 'Boarding pass trouvé' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Boarding pass introuvable' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async findOne(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── GET /boarding-passes/flight/:flight_id ───────────────────────────────
  @Get('flight/:flight_id')
  @ApiOperation({
    summary: 'Boarding passes par vol',
    description: 'Retourne tous les boarding passes émis pour un vol donné.',
  })
  @ApiResponse({ status: 200, description: 'Liste des boarding passes pour ce vol' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async findByFlight(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── POST /boarding-passes ────────────────────────────────────────────────
  @Post()
  @ApiOperation({
    summary: 'Créer un boarding pass manuellement',
    description: 'Génération manuelle (admin/système) d\'un boarding pass avec QR Code.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['booking_id', 'passenger_id', 'flight_id', 'seat_code'],
      properties: {
        booking_id: { type: 'string', format: 'uuid' },
        passenger_id: { type: 'string', format: 'uuid' },
        flight_id: { type: 'string', format: 'uuid' },
        seat_code: { type: 'string', example: '14C' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Boarding pass créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données de création invalides' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async create(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── PATCH /boarding-passes/:id ───────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour un boarding pass',
    description: 'Mise à jour des données (statut, siège, etc.) d\'un boarding pass existant.',
  })
  @ApiResponse({ status: 200, description: 'Boarding pass mis à jour' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Boarding pass introuvable' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async update(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── PATCH /boarding-passes/:id/invalidate ────────────────────────────────
  @Patch(':id/invalidate')
  @ApiOperation({
    summary: 'Invalider un boarding pass',
    description: 'Invalide un boarding pass (vol annulé, réaffectation de siège, etc.). QR Code désactivé.',
  })
  @ApiResponse({ status: 200, description: 'Boarding pass invalidé' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Boarding pass introuvable' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async invalidate(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── DELETE /boarding-passes/:id ──────────────────────────────────────────
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer un boarding pass',
    description: 'Suppression définitive d\'un boarding pass. Action irréversible.',
  })
  @ApiResponse({ status: 200, description: 'Boarding pass supprimé' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Boarding pass introuvable' })
  @ApiResponse({ status: 503, description: 'Boarding Pass Service indisponible' })
  async remove(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }
}
