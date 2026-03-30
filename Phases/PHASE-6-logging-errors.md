# Phase 6 — Logging Centralisé & Gestion des Erreurs Globale

> **ID Backlog** : AG-6  
> **Priorité** : 🟠 Moyen  
> **Dépendances** : AG-1 (Phase 1 terminée)  
> **Durée estimée** : 2–3 heures

---

## 🎯 Objectif

Implémenter un **système de logging structuré JSON** pour toutes les requêtes traitées par la Gateway, et un **filtre d'exceptions global** pour normaliser toutes les réponses d'erreur vers le client mobile. Le format de log doit être compatible avec la stack **ELK (Elasticsearch, Logstash, Kibana)** pour le monitoring.

---

## ✅ Critères d'Acceptation

- [ ] Chaque requête reçoit un `requestId` unique (UUID v4) injecté dans le header `X-Request-ID`
- [ ] Middleware logge l'entrée de chaque requête (méthode, path, IP, requestId)
- [ ] Intercepteur logge la sortie (status, durée en ms)
- [ ] Filtre d'exceptions global (`AllExceptionsFilter`) normalise **toutes** les erreurs
- [ ] Format des erreurs normalisé : `{ statusCode, error, message, timestamp, path, requestId }`
- [ ] Logs au format JSON structuré (compatible ELK Stack)
- [ ] Niveaux de log appropriés : `DEBUG`, `INFO`, `WARN`, `ERROR`
- [ ] Les erreurs des services en aval (503) sont loggées avec le service cible identifié

---

## 📦 Dépendances à Installer

```bash
npm install winston nest-winston uuid
npm install -D @types/uuid
```

---

## 📋 Format des Logs

### Log d'une Requête Entrante (INFO)

```json
{
  "timestamp": "2026-03-30T14:00:00.000Z",
  "level": "info",
  "service": "api-gateway",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/checkin/start",
  "ip": "192.168.1.1",
  "userAgent": "Tadkira-Android/1.0.0"
}
```

### Log d'une Réponse (INFO)

```json
{
  "timestamp": "2026-03-30T14:00:00.045Z",
  "level": "info",
  "service": "api-gateway",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/checkin/start",
  "statusCode": 200,
  "duration": "45ms",
  "targetService": "checkin-service"
}
```

### Log d'une Erreur (ERROR)

```json
{
  "timestamp": "2026-03-30T14:00:00.023Z",
  "level": "error",
  "service": "api-gateway",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/checkin/start",
  "statusCode": 503,
  "error": "ServiceUnavailableException",
  "message": "Le service cible est temporairement indisponible.",
  "stack": "..."
}
```

## 📋 Format des Réponses d'Erreur Normalisées

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Token JWT invalide ou expiré",
  "timestamp": "2026-03-30T14:00:00.000Z",
  "path": "/checkin/start",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 💻 Implémentation Étape par Étape

### Étape 6.1 — Configuration Winston Logger

```typescript
// src/config/logger.config.ts
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export const loggerConfig: WinstonModuleOptions = {
  transports: [
    // Console colorée en développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()        // JSON pur en production (pour ELK)
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

    // Fichier de logs pour les erreurs (persistance)
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
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
```

---

### Étape 6.2 — Middleware de Logging des Requêtes

```typescript
// src/common/middleware/request-logger.middleware.ts
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware qui :
 * 1. Assigne un requestId unique (UUID) à chaque requête
 * 2. Injecte le requestId dans le header X-Request-ID
 * 3. Logge l'entrée de la requête
 * 4. Logge la sortie avec le status et la durée
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Injecter le requestId dans les headers de requête et réponse
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';

    // Log d'entrée
    this.logger.log({
      message: `→ ${req.method} ${req.path}`,
      requestId,
      method: req.method,
      path: req.path,
      ip,
      userAgent: req.headers['user-agent'],
    });

    // Intercepter la fin de la réponse pour logger la sortie
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 500 ? 'error'
        : res.statusCode >= 400 ? 'warn'
        : 'log';

      this.logger[level]({
        message: `← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  }
}
```

---

### Étape 6.3 — Filtre d'Exceptions Global

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtre global qui intercepte TOUTES les exceptions non gérées
 * et retourne une réponse d'erreur normalisée et cohérente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = request.headers['x-request-id'] as string;

    // Détermination du status code et du message
    let statusCode: number;
    let errorName: string;
    let message: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
      } else {
        message = exception.message;
      }

      errorName = exception.constructor.name.replace('Exception', '');
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = 'InternalServerError';
      message = 'Une erreur interne s\'est produite. Veuillez réessayer.';

      this.logger.error({
        message: `Exception non gérée : ${exception.message}`,
        requestId,
        stack: exception.stack,
        path: request.path,
      });
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = 'UnknownError';
      message = 'Une erreur inconnue s\'est produite.';
    }

    // Log des erreurs 5xx avec stack trace
    if (statusCode >= 500) {
      this.logger.error({
        message: `[${statusCode}] ${message}`,
        requestId,
        path: request.path,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (statusCode >= 400) {
      this.logger.warn({
        message: `[${statusCode}] ${message}`,
        requestId,
        path: request.path,
        method: request.method,
      });
    }

    // Réponse d'erreur normalisée
    response.status(statusCode).json({
      statusCode,
      error: errorName,
      message,
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId,
    });
  }
}
```

---

### Étape 6.4 — Intégrer dans `AppModule` et `main.ts`

```typescript
// src/app.module.ts (mise à jour — ajout Winston et middleware)
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    WinstonModule.forRoot(loggerConfig),
    ConfigModule.forRoot({ ... }),
    JwtModule.registerAsync({ ... }),
    ThrottlerModule.forRootAsync({ ... }),
    HealthModule,
    ProxyModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    RedisThrottlerStorage,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Appliquer le middleware de logging sur TOUTES les routes
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
```

```typescript
// src/main.ts (version finale complète)
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,  // Buffer les logs jusqu'à ce que Winston soit prêt
  });

  // Utiliser Winston comme logger global NestJS
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });

  // Filtres globaux (ordre important : ThrottlerFilter en dernier)
  app.useGlobalFilters(
    new AllExceptionsFilter(),        // Gestion générale des erreurs
    new ThrottlerExceptionFilter(),   // Gestion spécifique du 429
  );

  setupSwagger(app);

  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`🚀 API Gateway démarré sur le port ${port}`, 'Bootstrap');
  logger.log(`📋 Swagger : http://localhost:${port}/api/docs`, 'Bootstrap');
  logger.log(`🩺 Health  : http://localhost:${port}/health`, 'Bootstrap');
}

bootstrap();
```

---

### Étape 6.5 — (Optionnel) Créer le Dossier de Logs

```bash
mkdir logs
echo "logs/*.log" >> .gitignore
```

---

## 🧪 Tests à Valider

```bash
# 1. Vérifier le header X-Request-ID dans les réponses
curl -v http://localhost:3000/health 2>&1 | grep -i x-request-id
# Attendu : X-Request-ID: <uuid-v4>

# 2. Vérifier le format de réponse d'erreur normalisé
curl http://localhost:3000/auth/profile
# Attendu :
# {
#   "statusCode": 401,
#   "error": "Unauthorized",
#   "message": "Token d'authentification manquant...",
#   "timestamp": "2026-03-30T...",
#   "path": "/auth/profile",
#   "requestId": "uuid-v4"
# }

# 3. Vérifier les logs dans la console (développement)
npm run start:dev
# Chaque requête doit afficher 2 lignes :
# → Entrée : "→ GET /health"
# ← Sortie : "← GET /health 200 (5ms)"

# 4. Tester une erreur 500 (service simulé planté)
# Les logs doivent afficher le stack trace complet

# 5. Production — vérifier le format JSON des logs
NODE_ENV=production npm run start
curl http://localhost:3000/health
# Logs dans la console : JSON pur ({"timestamp":"...","level":"info",...})
```

---

## 🏁 Récapitulatif Final — Ordre d'Implémentation Recommandé

Une fois toutes les phases terminées, voici l'état final du service :

```
Phase 1 ✅ → NestJS init, .env, health check, Dockerfile
Phase 2 ✅ → Proxy HTTP vers les 5 microservices
Phase 3 ✅ → JWT Guard global + @Public() decorator
Phase 4 ✅ → Rate Limiting Redis par route
Phase 5 ✅ → Swagger UI centralisée + Bearer JWT
Phase 6 ✅ → Winston logging + AllExceptionsFilter
```

### Commandes Finales de Vérification

```bash
# Démarrer tout l'environnement
docker-compose up -d

# Vérifier l'état complet
curl http://localhost:3000/health

# Ouvrir la documentation
open http://localhost:3000/api/docs

# Lancer tous les tests
npm run test
npm run test:cov

# Lint
npm run lint
```

---

## 🔗 Navigation

⬅️ **[Phase 5 — Documentation Swagger](./PHASE-5-swagger.md)**  
🏠 **[Retour au README principal](../README.md)**
