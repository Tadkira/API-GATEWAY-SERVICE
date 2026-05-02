import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

/**
 * Phase 6 — Winston Logger Configuration
 *
 * - Development : colored, human-readable console output
 * - Production  : structured JSON (ELK-compatible) to console + log files
 */
export const loggerConfig: WinstonModuleOptions = {
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // ─── Console transport (always active) ────────────────────────────────
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          // JSON pur en production → ingéré par ELK / Loki
          ? winston.format.json()
          // Coloré & lisible en développement
          : winston.format.combine(
              winston.format.colorize({ all: true }),
              winston.format.printf(({ level, message, timestamp, ms, ...meta }) => {
                const metaStr = Object.keys(meta).length
                  ? `\n${JSON.stringify(meta, null, 2)}`
                  : '';
                return `[${timestamp}] ${level} ${ms}: ${message}${metaStr}`;
              }),
            ),
      ),
    }),

    // ─── File transports (production only) ────────────────────────────────
    ...(process.env.NODE_ENV === 'production'
      ? [
          // Errors only
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
          // All levels
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ]
      : []),
  ],
};
