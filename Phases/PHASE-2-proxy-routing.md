# Phase 2 — Proxy & Routage vers les Microservices

> **ID Backlog** : AG-2  
> **Priorité** : 🔴 Critique  
> **Dépendances** : AG-1 (Phase 1 terminée)  
> **Durée estimée** : 3–4 heures

---

## 🎯 Objectif

Implémenter le **mécanisme de proxy et de routage HTTP** qui redirige chaque requête entrante vers le microservice approprié. L'API Gateway ne doit contenir **aucune logique métier** — uniquement de la logique de forwarding transparent.

---

## ✅ Critères d'Acceptation

- [ ] Toutes les routes de la table de routage sont fonctionnelles
- [ ] Les requêtes (headers, body, query params) sont transmises **fidèlement** au service cible
- [ ] Les réponses des services cibles sont retournées avec le **bon status code HTTP**
- [ ] En cas d'indisponibilité d'un service : réponse `503 Service Unavailable` claire
- [ ] Les logs de chaque requête routée sont enregistrés (méthode, route, service, durée)
- [ ] Tous les microservices de la table de routage sont couverts

---

## 📦 Dépendances à Installer

```bash
# Proxy HTTP et client HTTP
npm install @nestjs/axios axios

# Types
npm install -D @types/express
```

---

## 🗺️ Table de Routage Complète

| Route Source | Méthode | Service Cible | Protégé JWT | Rate Limit |
|-------------|---------|---------------|-------------|-----------|
| `/auth/register` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 5 req/60s |
| `/auth/login` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 10 req/60s |
| `/auth/google` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 10 req/60s |
| `/auth/profile` | GET | `AUTH_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/flights/search` | GET | `FLIGHT_SERVICE_URL` | 🟢 Non | 100 req/60s |
| `/flights/:id` | GET | `FLIGHT_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/checkin/seats/:flightId` | GET | `CHECKIN_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/checkin/seat/lock` | POST | `CHECKIN_SERVICE_URL` | 🔐 Oui | 10 req/30s |
| `/checkin/start` | POST | `CHECKIN_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/checkin/complete` | POST | `CHECKIN_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/ocr/passport` | POST | `OCR_SERVICE_URL` | 🔐 Oui | 5 req/5min |
| `/boarding-pass/:checkInId` | GET | `BOARDING_PASS_SERVICE_URL` | 🔐 Oui | 100 req/60s |

---

## 💻 Implémentation Étape par Étape

### Étape 2.1 — Configuration du ProxyModule

```typescript
// src/proxy/proxy.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ProxyService } from './proxy.service';
import { AuthProxyController } from './controllers/auth-proxy.controller';
import { FlightProxyController } from './controllers/flight-proxy.controller';
import { CheckinProxyController } from './controllers/checkin-proxy.controller';
import { OcrProxyController } from './controllers/ocr-proxy.controller';
import { BoardingPassProxyController } from './controllers/boarding-pass-proxy.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,        // 10 secondes max par requête upstream
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  controllers: [
    AuthProxyController,
    FlightProxyController,
    CheckinProxyController,
    OcrProxyController,
    BoardingPassProxyController,
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
```

---

### Étape 2.2 — Service de Proxy (`src/proxy/proxy.service.ts`)

```typescript
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
   * Forwarder une requête vers un service cible
   * Transmet : méthode, headers, body, query params
   */
  async forward(
    req: Request,
    res: Response,
    targetBaseUrl: string,
    targetPath?: string,
  ): Promise<void> {
    const path = targetPath ?? req.path;
    const targetUrl = `${targetBaseUrl}${path}`;
    const startTime = Date.now();

    // Headers à transmettre (sans ceux liés à la connexion HTTP)
    const headersToForward = { ...req.headers };
    delete headersToForward['host'];
    delete headersToForward['content-length'];

    this.logger.log(
      `→ Forwarding [${req.method}] ${req.path} → ${targetUrl}`,
    );

    try {
      const response = await lastValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          headers: headersToForward,
          data: req.body,
          params: req.query,
          responseType: 'arraybuffer', // Support fichiers binaires (PDF, images)
          validateStatus: () => true,  // Ne pas lancer d'erreur sur 4xx/5xx
        }),
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `← Response [${response.status}] from ${targetUrl} (${duration}ms)`,
      );

      // Copier les headers de réponse du service cible
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
        `✗ Service unavailable : ${targetUrl} (${duration}ms) — ${axiosError.message}`,
      );

      throw new ServiceUnavailableException(
        `Le service cible est temporairement indisponible. Réessayez dans quelques instants.`,
      );
    }
  }
}
```

---

### Étape 2.3 — Contrôleur Auth Proxy

```typescript
// src/proxy/controllers/auth-proxy.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get authServiceUrl(): string {
    return this.configService.get<string>('services.auth')!;
  }

  // Routes publiques
  @Public()
  @All('register')
  register(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('login')
  login(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('google')
  googleLogin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  // Route protégée (JWT Guard appliqué globalement)
  @All('profile')
  profile(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }
}
```

---

### Étape 2.4 — Contrôleur Flight Proxy

```typescript
// src/proxy/controllers/flight-proxy.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Flights')
@Controller('flights')
export class FlightProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get flightServiceUrl(): string {
    return this.configService.get<string>('services.flight')!;
  }

  @Public()
  @All('search')
  search(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }

  // /flights/:id — protégé (JWT Guard global)
  @All(':id')
  getById(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.flightServiceUrl);
  }
}
```

---

### Étape 2.5 — Contrôleur Check-In Proxy

```typescript
// src/proxy/controllers/checkin-proxy.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';

@ApiTags('Check-In')
@Controller('checkin')
export class CheckinProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get checkinServiceUrl(): string {
    return this.configService.get<string>('services.checkin')!;
  }

  @All('seats/:flightId')
  getSeats(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  @All('seat/lock')
  lockSeat(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  @All('start')
  startCheckin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }

  @All('complete')
  completeCheckin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }
}
```

---

### Étape 2.6 — Contrôleurs OCR & Boarding Pass

```typescript
// src/proxy/controllers/ocr-proxy.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';

@ApiTags('OCR')
@Controller('ocr')
export class OcrProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  @All('passport')
  scanPassport(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(
      req, res,
      this.configService.get<string>('services.ocr')!,
    );
  }
}
```

```typescript
// src/proxy/controllers/boarding-pass-proxy.controller.ts
import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';

@ApiTags('Boarding Pass')
@Controller('boarding-pass')
export class BoardingPassProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  @All(':checkInId')
  getBoardingPass(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(
      req, res,
      this.configService.get<string>('services.boardingPass')!,
    );
  }
}
```

---

### Étape 2.7 — Ajouter ProxyModule dans AppModule

```typescript
// src/app.module.ts (mise à jour)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import servicesConfig from './config/services.config';
import { HealthModule } from './health/health.module';
import { ProxyModule } from './proxy/proxy.module';  // ← Ajout

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, jwtConfig, redisConfig, servicesConfig],
    }),
    HealthModule,
    ProxyModule,  // ← Ajout
  ],
})
export class AppModule {}
```

---

## 🧪 Tests à Valider

```bash
# Tester le forwarding vers Auth (avec un service mock ou réel)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"secret123"}'

# Tester la recherche de vol (route publique)
curl "http://localhost:3000/flights/search?pnr=ABC123&lastName=Dupont"

# Tester route protégée sans token → doit retourner 401
curl http://localhost:3000/auth/profile
# Attendu : { "statusCode": 401, "message": "Unauthorized" }

# Tester service indisponible → doit retourner 503
# (arrêter le service auth et faire une requête)
# Attendu : { "statusCode": 503, "message": "Le service cible est temporairement indisponible." }
```

---

## 🔗 Navigation

⬅️ **[Phase 1 — Init & Configuration](./PHASE-1-init-configuration.md)**  
➡️ **[Phase 3 — JWT Security Filter](./PHASE-3-jwt-security.md)**
