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

  /**
   * Forwards a request to a target microservice.
   * Transmits method, headers, body, and query params.
   */
  async forward(
    req: Request,
    res: Response,
    targetBaseUrl: string,
    targetPath?: string,
  ): Promise<void> {
    // ✅ req.path au lieu de req.originalUrl
    // req.path = "/bookings/pnr/ABCD123"       (sans query params)
    // req.originalUrl = "/bookings/pnr/ABCD123?lastName=Meriem" (avec query params)
    // On passe les query params séparément via params: req.query
    // pour éviter le doublon
    const path = targetPath ?? req.path;
    const targetUrl = `${targetBaseUrl}${path}`;

    const startTime = Date.now();

    // Headers to forward
    const headersToForward = { ...req.headers };
    delete headersToForward['host'];
    delete headersToForward['connection'];
    delete headersToForward['content-length'];

    this.logger.log(
      `→ Forwarding [${req.method}] ${req.originalUrl} → ${targetUrl}`,
    );

    try {
      const response = await lastValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          headers: headersToForward,
          data: req.body,
          params: req.query,        // ✅ query params passés UNE SEULE FOIS
          responseType: 'arraybuffer',
          validateStatus: () => true,
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
        `Target service is temporarily unavailable. Please try again later.`,
      );
    }
  }
}