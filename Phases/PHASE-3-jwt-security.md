# Phase 3 — Security Filter Global — Validation JWT

> **ID Backlog** : AG-3  
> **Priorité** : 🔴 Critique  
> **Dépendances** : AG-1 (Phase 1 terminée)  
> **Durée estimée** : 3–4 heures

---

## 🎯 Objectif

Implémenter un **Guard NestJS global** qui intercepte **toutes les requêtes entrantes** pour valider le token JWT avant de laisser passer la requête vers le service cible. Les routes publiques (login, register, etc.) doivent être **explicitement exemptées** via un décorateur `@Public()`.

---

## ✅ Critères d'Acceptation

- [ ] Guard JWT appliqué **globalement** à tous les contrôleurs (via `APP_GUARD`)
- [ ] Décorateur `@Public()` créé et fonctionnel pour bypasser le guard
- [ ] Routes publiques exemptées : `/auth/register`, `/auth/login`, `/auth/google`, `/health`
- [ ] Retour `401 Unauthorized` si le header `Authorization` est absent
- [ ] Retour `401 Unauthorized` si le format `Bearer {token}` est invalide
- [ ] Retour `401 Unauthorized` si la signature JWT est invalide
- [ ] Retour `401 Unauthorized` avec message `Token expired` si le JWT est expiré
- [ ] Le `userId` et `email` du payload JWT sont injectés dans les headers de la requête forwarded (`X-User-Id`, `X-User-Email`)
- [ ] Tests unitaires : cas valide, token absent, token invalide, token expiré

---

## 📦 Dépendances à Installer

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install -D @types/passport-jwt
```

---

## 🔄 Flux de Validation JWT

```
Requête entrante
       │
       ▼
  ┌────────────────────────────────────────┐
  │           Global JWT Guard              │
  │                                         │
  │  Réflecteur → Route @Public() ?         │
  │       │ Oui → Laisser passer (bypass)   │
  │       │                                 │
  │       │ Non ↓                           │
  │                                         │
  │  Header "Authorization" présent ?       │
  │       │ Non → 401 Unauthorized          │
  │       │                                 │
  │       │ Oui ↓                           │
  │                                         │
  │  Format "Bearer <token>" correct ?      │
  │       │ Non → 401 Unauthorized          │
  │       │                                 │
  │       │ Oui ↓                           │
  │                                         │
  │  Signature JWT valide ?                 │
  │       │ Non → 401 Unauthorized          │
  │       │                                 │
  │       │ Oui ↓                           │
  │                                         │
  │  Token expiré ?                         │
  │       │ Oui → 401 "Token expired"       │
  │       │                                 │
  │       │ Non ↓                           │
  │                                         │
  │  Injecter userId, email dans les        │
  │  headers de la requête forwarded        │
  │  (X-User-Id, X-User-Email)              │
  │       │                                 │
  └───────┼─────────────────────────────────┘
          │
          ▼
    Proxy vers microservice cible
```

---

## 💻 Implémentation Étape par Étape

### Étape 3.1 — Décorateur `@Public()`

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Décorateur pour marquer une route comme publique.
 * Le JWT Guard sera bypassé pour ces routes.
 *
 * @example
 * @Public()
 * @Post('login')
 * login() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

### Étape 3.2 — Interface du Payload JWT

```typescript
// src/common/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;      // userId (UUID)
  email: string;    // Email du passager
  iat?: number;     // Issued at
  exp?: number;     // Expiration timestamp
}
```

---

### Étape 3.3 — Guard JWT Global

```typescript
// src/common/guards/jwt-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Vérifier si la route est marquée @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('Route publique — bypass JWT');
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Token d\'authentification manquant. Veuillez vous connecter.',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Injecter les infos utilisateur dans les headers
      // → Ainsi les microservices en aval les reçoivent directement
      request.headers['x-user-id'] = payload.sub;
      request.headers['x-user-email'] = payload.email;

      // Stocker le payload dans la requête pour usage éventuel
      (request as any).user = payload;

      this.logger.debug(`JWT valide pour userId: ${payload.sub}`);
      return true;
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Token expiré. Veuillez vous reconnecter.',
        );
      }

      if (error?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(
          'Token invalide. Authentification refusée.',
        );
      }

      this.logger.error(`Erreur JWT inattendue : ${error?.message}`);
      throw new UnauthorizedException('Authentification échouée.');
    }
  }

  /**
   * Extrait le token Bearer du header Authorization
   * Format attendu : "Authorization: Bearer <token>"
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Format du token invalide. Utilisez : Authorization: Bearer <token>',
      );
    }

    return token;
  }
}
```

---

### Étape 3.4 — Enregistrement Global du Guard & JwtModule

```typescript
// src/app.module.ts (mise à jour complète)
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import servicesConfig from './config/services.config';
import { HealthModule } from './health/health.module';
import { ProxyModule } from './proxy/proxy.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, jwtConfig, redisConfig, servicesConfig],
    }),

    // Configuration JWT (utilisé par le Guard)
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '24h',
        },
      }),
      inject: [ConfigService],
    }),

    HealthModule,
    ProxyModule,
  ],
  providers: [
    // Enregistrement GLOBAL du Guard JWT
    // → S'applique automatiquement à TOUS les contrôleurs
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

---

### Étape 3.5 — Marquer les Routes Publiques dans les Contrôleurs

```typescript
// Exemple : src/proxy/controllers/auth-proxy.controller.ts
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthProxyController {

  @Public()           // ← Route exempte de JWT
  @All('register')
  register(@Req() req: Request, @Res() res: Response) { ... }

  @Public()           // ← Route exempte de JWT
  @All('login')
  login(@Req() req: Request, @Res() res: Response) { ... }

  @Public()           // ← Route exempte de JWT
  @All('google')
  googleLogin(@Req() req: Request, @Res() res: Response) { ... }

  // Pas de @Public() → JWT requis
  @All('profile')
  profile(@Req() req: Request, @Res() res: Response) { ... }
}
```

```typescript
// Health controller — toujours public
@Public()   // ← Tout le contrôleur est public
@Controller('health')
export class HealthController { ... }
```

---

### Étape 3.6 — Tests Unitaires du Guard

```typescript
// test/jwt-auth.guard.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
  });

  const mockContext = (headers: Record<string, string> = {}) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

  describe('Routes publiques', () => {
    it('doit laisser passer une route @Public()', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const result = await guard.canActivate(mockContext());
      expect(result).toBe(true);
    });
  });

  describe('Routes protégées', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('doit rejeter si le header Authorization est absent', async () => {
      await expect(guard.canActivate(mockContext({}))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('doit rejeter si le format Bearer est invalide', async () => {
      await expect(
        guard.canActivate(mockContext({ authorization: 'Token abc123' })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('doit rejeter si le JWT est invalide', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue({
        name: 'JsonWebTokenError',
        message: 'invalid signature',
      });

      await expect(
        guard.canActivate(
          mockContext({ authorization: 'Bearer invalid.token.here' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('doit rejeter si le JWT est expiré', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue({
        name: 'TokenExpiredError',
        message: 'jwt expired',
      });

      await expect(
        guard.canActivate(
          mockContext({ authorization: 'Bearer expired.token.here' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('doit accepter un JWT valide et injecter userId dans les headers', async () => {
      const payload = { sub: 'uuid-user-123', email: 'user@test.com' };
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload as any);

      const request = { headers: { authorization: 'Bearer valid.token' } };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(request.headers['x-user-id']).toBe('uuid-user-123');
      expect(request.headers['x-user-email']).toBe('user@test.com');
    });
  });
});
```

---

## 🧪 Tests Manuels à Valider

```bash
# 1. Route publique — doit retourner 200
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"secret"}'

# 2. Route protégée sans token — doit retourner 401
curl http://localhost:3000/auth/profile
# Attendu : { "statusCode": 401, "message": "Token d'authentification manquant..." }

# 3. Token avec format invalide — doit retourner 401
curl http://localhost:3000/auth/profile \
  -H "Authorization: Basic invalid"
# Attendu : { "statusCode": 401, "message": "Format du token invalide..." }

# 4. Token invalide — doit retourner 401
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer invalid.jwt.token"
# Attendu : { "statusCode": 401, "message": "Token invalide..." }

# 5. Token valide — doit forwarder vers Auth Service
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer <VOTRE_TOKEN_VALIDE>"
# Attendu : réponse du Auth Service
```

---

## 🔗 Navigation

⬅️ **[Phase 2 — Proxy & Routage](./PHASE-2-proxy-routing.md)**  
➡️ **[Phase 4 — Rate Limiting Redis](./PHASE-4-rate-limiting.md)**
