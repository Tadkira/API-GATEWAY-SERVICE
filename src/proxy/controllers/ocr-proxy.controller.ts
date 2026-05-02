import {
  Controller,
  Post,
  Get,
  Patch,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { ThrottleOcr } from '../../common/decorators/throttle.decorator';
import * as FormData from 'form-data';

@ApiTags('OCR')
@ApiBearerAuth('JWT-Auth')
@Controller('ocr')
export class OcrProxyController {
  private readonly targetUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly proxyService: ProxyService,
  ) {
    this.targetUrl = this.configService.get<string>('OCR_SERVICE_URL')!;
  }

  // ─── POST /ocr/sessions ──────────────────────────────────────────────────
  @Post('sessions')
  @ThrottleOcr()
  @ApiOperation({
    summary: 'Initier une session OCR',
    description: 'Upload d\'une image de passeport pour extraction automatique des données MRZ. Limité à 5 requêtes par 5 minutes.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['passport_image', 'checkin_id', 'passenger_id'],
      properties: {
        passport_image: { type: 'string', format: 'binary', description: 'Image du passeport (JPEG, PNG, WebP — max 10MB)' },
        checkin_id: { type: 'string', format: 'uuid', example: 'a3c1e2f4-...' },
        passenger_id: { type: 'string', format: 'uuid', example: 'b7d9f1a2-...' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Session OCR créée, extraction en cours' })
  @ApiResponse({ status: 400, description: 'Image manquante ou format non supporté' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 429, description: 'Trop de requêtes (max 5 / 5min)' })
  @ApiResponse({ status: 503, description: 'OCR Service indisponible' })
  @UseInterceptors(FileInterceptor('passport_image'))
  async initiateSession(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const formData = new FormData();
    formData.append('passport_image', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    Object.keys(body).forEach(key => {
      formData.append(key, body[key]);
    });
    (req as any).body = formData;
    const headers = { ...req.headers, ...formData.getHeaders() };
    delete headers['content-length'];
    (req as any).headers = headers;
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── GET /ocr/sessions/:id ───────────────────────────────────────────────
  @Get('sessions/:id')
  @ApiOperation({
    summary: 'Statut d\'une session OCR',
    description: 'Polling du statut d\'extraction (PENDING → PROCESSING → VERIFIED / FAILED)',
  })
  @ApiResponse({ status: 200, description: 'Statut et données extraites retournés' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Session OCR introuvable' })
  @ApiResponse({ status: 503, description: 'OCR Service indisponible' })
  async getSessionStatus(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── GET /ocr/sessions?passenger_id=xxx ─────────────────────────────────
  @Get('sessions')
  @ApiOperation({
    summary: 'Historique des sessions OCR d\'un passager',
    description: 'Paramètre requis : `?passenger_id=<uuid>`',
  })
  @ApiResponse({ status: 200, description: 'Liste des sessions OCR' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 503, description: 'OCR Service indisponible' })
  async getSessionsByPassenger(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── POST /ocr/sessions/:id/validate ────────────────────────────────────
  @Post('sessions/:id/validate')
  @ApiOperation({
    summary: 'Valider OCR contre données PNR',
    description: 'Validation croisée entre les données OCR extraites et les données de la réservation (PNR)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pnr_last_name', 'pnr_first_name'],
      properties: {
        pnr_last_name: { type: 'string', example: 'BENSEMANE' },
        pnr_first_name: { type: 'string', example: 'REDA' },
        pnr_date_of_birth: { type: 'string', example: '1999-03-15' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Résultat de validation (match / mismatch)' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 404, description: 'Session OCR introuvable' })
  @ApiResponse({ status: 503, description: 'OCR Service indisponible' })
  async validateAgainstPnr(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  // ─── PATCH /ocr/sessions/confirm ────────────────────────────────────────
  @Patch('sessions/confirm')
  @ApiOperation({
    summary: 'Confirmer / corriger les données OCR',
    description: 'Permet au passager de corriger manuellement les données extraites par OCR',
  })
  @ApiResponse({ status: 200, description: 'Données OCR confirmées / corrigées' })
  @ApiResponse({ status: 400, description: 'Données de confirmation invalides' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide' })
  @ApiResponse({ status: 503, description: 'OCR Service indisponible' })
  async confirmOcrData(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }
}
