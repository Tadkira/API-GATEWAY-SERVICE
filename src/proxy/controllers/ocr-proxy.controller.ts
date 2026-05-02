import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import * as FormData from 'form-data';

@ApiTags('Ocr Proxy')
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

  @Post('sessions')
  @ApiOperation({ summary: 'Démarrer une session OCR avec upload passeport' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        passport_image: { type: 'string', format: 'binary' },
        checkin_id: { type: 'string', format: 'uuid' },
        passenger_id: { type: 'string', format: 'uuid' },
      },
      required: ['passport_image', 'checkin_id', 'passenger_id'],
    },
  })
  @UseInterceptors(FileInterceptor('passport_image'))
  async initiateSession(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // For OCR upload, we reconstruct the FormData to send it to the microservice
    const formData = new FormData();
    formData.append('passport_image', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    
    // Append other body fields
    Object.keys(body).forEach(key => {
      formData.append(key, body[key]);
    });

    // Re-patching request body for ProxyService
    (req as any).body = formData;
    
    // We need to update headers for multipart
    const headers = {
      ...req.headers,
      ...formData.getHeaders(),
    };
    delete headers['content-length'];
    (req as any).headers = headers;

    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Récupérer le statut OCR par session' })
  async getSessionStatus(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Lister les sessions OCR par passager' })
  async getSessionsByPassenger(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Post('sessions/:id/validate')
  @ApiOperation({ summary: 'Valider OCR contre données PNR' })
  async validateAgainstPnr(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }

  @Patch('sessions/confirm')
  @ApiOperation({ summary: 'Confirmer/corriger les données OCR' })
  async confirmOcrData(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.targetUrl);
  }
}
