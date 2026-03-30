# Phase 4 — Rate Limiting avec Redis

> **ID Backlog** : AG-4  
> **Priorité** : 🟡 Important  
> **Dépendances** : AG-1 (Phase 1 terminée)  
> **Durée estimée** : 2–3 heures

---

## 🎯 Objectif

Implémenter un système de **limitation du débit des requêtes (Rate Limiting)** basé sur Redis pour protéger l'API Gateway contre les **abus, attaques DDoS et force-brute**. Les compteurs de chaque IP sont stockés dans Redis avec une expiration automatique (TTL).

---

## ✅ Critères d'Acceptation

- [ ] Connexion Redis configurée et fonctionnelle
- [ ] Rate limiter **global** appliqué à toutes les routes (100 req/60s par IP)
- [ ] Rate limiters **spécifiques** sur les routes sensibles
- [ ] Retour `429 Too Many Requests` avec header `Retry-After` quand la limite est atteinte
- [ ] Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` présents dans chaque réponse
- [ ] Les compteurs sont stockés dans Redis avec TTL automatique
- [ ] Tests d'intégration vérifiant le comportement de rate limiting

---

## 📦 Dépendances à Installer

```bash
npm install @nestjs/throttler ioredis
```

---

## 📊 Règles de Rate Limiting

| Route | Méthode | Limite | Fenêtre | Raison |
|-------|---------|--------|---------|--------|
| **Toutes les routes** | ALL | 100 req | 60 secondes | Protection générale |
| `/auth/login` | POST | 10 req | 60 secondes | Anti brute-force |
| `/auth/register` | POST | 5 req | 60 secondes | Anti spam inscription |
| `/auth/google` | POST | 10 req | 60 secondes | Anti abus SSO |
| `/ocr/passport` | POST | 5 req | 300 secondes | Upload fichier lourd |
| `/checkin/seat/lock` | POST | 10 req | 30 secondes | Anti double-lock siège |

### Comportement quand la limite est dépassée

```
Client             API Gateway             Redis
  │                     │                    │
  │── POST /auth/login ─→│                    │
  │                     │── INCR counter ────→│
  │                     │← count = 11         │
  │                     │  (limite = 10)      │
  │←── 429 Too Many ────│                    │
  │    Requests         │                    │
  │    Retry-After: 45s │                    │
```

### Headers de réponse

Chaque réponse doit inclure :

```
X-RateLimit-Limit: 100          # Limite totale de la règle
X-RateLimit-Remaining: 87       # Requêtes restantes
X-RateLimit-Reset: 1711807200   # Timestamp UNIX de remise à zéro
Retry-After: 45                 # (si 429) Secondes avant de réessayer
```

---

## 💻 Implémentation Étape par Étape

### Étape 4.1 — Créer le Storage Redis Custom

```typescript
// src/common/throttler/redis-throttler.storage.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Storage Redis pour le ThrottlerModule de NestJS.
 * Chaque compteur de rate-limit est stocké dans Redis avec un TTL automatique.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('redis.host') || 'localhost',
      port: configService.get<number>('redis.port') || 6379,
      password: configService.get<string>('redis.password') || undefined,
      keyPrefix: 'throttle:',  // Préfixe pour isoler les clés rate-limit
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async getRecord(key: string): Promise<number[]> {
    const data = await this.redis.lrange(key, 0, -1);
    return data.map(Number);
  }

  async addRecord(key: string, ttl: number): Promise<void> {
    const now = Date.now();
    await this.redis
      .multi()
      .rpush(key, now)
      .pexpire(key, ttl * 1000)
      .exec();
  }
}
```

---

### Étape 4.2 — Configurer le ThrottlerModule

```typescript
// src/app.module.ts (mise à jour — section throttler)
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

@Module({
  imports: [
    // ... autres imports

    // Configuration du Rate Limiter global avec Redis
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (configService: ConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            // Règle globale par défaut
            name: 'global',
            ttl: configService.get<number>('THROTTLE_TTL') ?? 60,
            limit: configService.get<number>('THROTTLE_LIMIT') ?? 100,
          },
        ],
        storage,
      }),
    }),
  ],
  providers: [
    RedisThrottlerStorage,

    // Guard JWT (Phase 3)
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Guard Rate Limiter (appliqué APRÈS le JWT Guard)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

---

### Étape 4.3 — Décorateurs de Rate Limit Spécifiques par Route

```typescript
// src/common/decorators/throttle.decorator.ts
import { Throttle } from '@nestjs/throttler';

/**
 * Surcharge le throttle global pour une route spécifique.
 * Utilisation : @ThrottleStrict() pour les routes sensibles.
 */

// Anti brute-force : 10 req / 60s
export const ThrottleLogin = () => Throttle({ login: { ttl: 60, limit: 10 } });

// Anti spam : 5 req / 60s
export const ThrottleRegister = () => Throttle({ register: { ttl: 60, limit: 5 } });

// Upload lourd : 5 req / 5 min
export const ThrottleOcr = () => Throttle({ ocr: { ttl: 300, limit: 5 } });

// Anti double-lock : 10 req / 30s
export const ThrottleSeatLock = () => Throttle({ seatlock: { ttl: 30, limit: 10 } });
```

---

### Étape 4.4 — Appliquer les Throttles Spécifiques aux Contrôleurs

```typescript
// src/proxy/controllers/auth-proxy.controller.ts
import { ThrottleLogin, ThrottleRegister } from '../../common/decorators/throttle.decorator';

@Controller('auth')
export class AuthProxyController {

  @Public()
  @ThrottleRegister()   // ← 5 req / 60s
  @All('register')
  register(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @ThrottleLogin()      // ← 10 req / 60s
  @All('login')
  login(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @ThrottleLogin()      // ← 10 req / 60s
  @All('google')
  googleLogin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }
}
```

```typescript
// src/proxy/controllers/ocr-proxy.controller.ts
import { ThrottleOcr } from '../../common/decorators/throttle.decorator';

@Controller('ocr')
export class OcrProxyController {

  @ThrottleOcr()        // ← 5 req / 5 min
  @All('passport')
  scanPassport(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.ocrServiceUrl);
  }
}
```

```typescript
// src/proxy/controllers/checkin-proxy.controller.ts
import { ThrottleSeatLock } from '../../common/decorators/throttle.decorator';

@Controller('checkin')
export class CheckinProxyController {

  @ThrottleSeatLock()   // ← 10 req / 30s
  @All('seat/lock')
  lockSeat(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.checkinServiceUrl);
  }
}
```

---

### Étape 4.5 — Personnaliser la Réponse 429

```typescript
// src/common/filters/throttler-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Filtre personnalisé pour les erreurs 429 du ThrottlerGuard.
 * Ajoute les headers X-RateLimit-* et Retry-After.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const retryAfter = 60; // secondes (à adapter selon la règle déclenchée)

    response
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .set({
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + retryAfter),
      })
      .json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Trop de requêtes. Réessayez dans ${retryAfter} secondes.`,
        retryAfter,
        timestamp: new Date().toISOString(),
      });
  }
}
```

```typescript
// Enregistrer le filtre dans main.ts
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ThrottlerExceptionFilter());
  // ...
}
```

---

### Étape 4.6 — Vérifier la Connexion Redis au Démarrage

```typescript
// src/health/health.controller.ts (mise à jour)
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async check() {
    let redisStatus = 'unknown';

    try {
      const redis = new Redis({
        host: this.configService.get<string>('redis.host'),
        port: this.configService.get<number>('redis.port'),
        lazyConnect: true,
        connectTimeout: 2000,
      });
      await redis.ping();
      await redis.quit();
      redisStatus = 'ok';
    } catch {
      redisStatus = 'unreachable';
    }

    return {
      status: redisStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      dependencies: {
        redis: redisStatus,
      },
    };
  }
}
```

---

## 🧪 Tests à Valider

```bash
# 1. Vérifier que Redis est connecté
curl http://localhost:3000/health
# Attendu : { "status": "ok", "dependencies": { "redis": "ok" } }

# 2. Tester le dépassement de limite (login)
# Envoyer 11 requêtes rapidement → la 11ème doit retourner 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Les 10 premières : 200 ou 401 (selon le service)
# La 11ème : 429

# 3. Vérifier les headers de rate-limit
curl -v http://localhost:3000/health 2>&1 | grep -i x-rate
# Attendu : X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

# 4. Tester le header Retry-After sur 429
curl -v -X POST http://localhost:3000/ocr/passport \
  -H "Authorization: Bearer <TOKEN>" \
  (après dépassement de la limite)
# Attendu : Retry-After: 300
```

---

## 🔗 Navigation

⬅️ **[Phase 3 — JWT Security Filter](./PHASE-3-jwt-security.md)**  
➡️ **[Phase 5 — Documentation Swagger](./PHASE-5-swagger.md)**
