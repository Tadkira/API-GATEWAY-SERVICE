import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly httpService: HttpService) {}

  async forward(
    req: Request,
    res: Response,
    targetBaseUrl: string,
    targetPath?: string,
  ): Promise<void> {

    const path = targetPath ?? req.path;
    const targetUrl = `${targetBaseUrl}${path}`;
    const startTime = Date.now();

    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');

    // Forward headers safely
    const headersToForward: any = { ...req.headers };

    delete headersToForward['host'];
    delete headersToForward['connection'];

    // IMPORTANT: do NOT break multipart boundary
    if (!isMultipart) {
      delete headersToForward['content-length'];
    }

    this.logger.log(
      `→ Forwarding [${req.method}] ${req.originalUrl} → ${targetUrl}`,
    );

    try {
      const response = await lastValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          headers: headersToForward,

          // ✅ KEY FIX
          // JSON routes → req.body
          // Multipart routes → raw req stream
          data: isMultipart ? req : req.body,

          params: req.query,
          responseType: 'arraybuffer',
          validateStatus: () => true,

          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );

      const duration = Date.now() - startTime;

      this.logger.log(
        `← Response [${response.status}] from ${targetUrl} (${duration}ms)`,
      );

      // Forward response headers
      const responseHeaders = response.headers as Record<string, string>;

      Object.keys(responseHeaders).forEach((key) => {
        if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, responseHeaders[key]);
        }
      });

      res.status(response.status).send(response.data);

    } catch (error) {
      const duration = Date.now() - startTime;
      const axiosError = error as AxiosError;

      this.logger.error(
        `✗ Service unavailable: ${targetUrl} (${duration}ms) — ${axiosError.message}`,
      );

      throw new ServiceUnavailableException(
        'Target service is temporarily unavailable. Please try again later.',
      );
    }
  }
}