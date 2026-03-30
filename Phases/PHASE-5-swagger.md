# Phase 5 — Documentation Swagger Globale Centralisée

> **ID Backlog** : AG-5  
> **Priorité** : 🟡 Important  
> **Dépendances** : AG-2 (Proxy), AG-3 (JWT Guard)  
> **Durée estimée** : 2–3 heures

---

## 🎯 Objectif

Configurer et exposer une **documentation Swagger/OpenAPI complète et centralisée** pour tous les endpoints de l'API Gateway. La documentation doit couvrir chaque route proxied, documenter les DTOs, les codes de réponse, et intégrer l'authentification Bearer JWT directement dans l'UI Swagger.

---

## ✅ Critères d'Acceptation

- [ ] Swagger UI accessible à `GET /api/docs`
- [ ] OpenAPI JSON accessible à `GET /api/docs-json`
- [ ] Tous les endpoints documentés avec tags, descriptions et exemples
- [ ] Schéma de sécurité **Bearer JWT** configuré (bouton "Authorize" fonctionnel)
- [ ] DTOs annotés avec `@ApiProperty()` pour génération automatique des schémas
- [ ] Codes de réponse HTTP documentés (`@ApiResponse`) pour chaque endpoint
- [ ] Swagger désactivable en production via `SWAGGER_ENABLED=false`

---

## 📦 Dépendances à Installer

```bash
npm install @nestjs/swagger swagger-ui-express
```

---

## 💻 Implémentation Étape par Étape

### Étape 5.1 — Configuration Swagger Centralisée

```typescript
// src/swagger/swagger.setup.ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);

  // Désactiver en production si configuré ainsi
  const swaggerEnabled = configService.get<boolean>('app.swagger.enabled') ?? true;
  if (!swaggerEnabled) {
    console.log('📋 Swagger UI désactivé (SWAGGER_ENABLED=false)');
    return;
  }

  const swaggerPath = configService.get<string>('app.swagger.path') || 'api/docs';

  const config = new DocumentBuilder()
    .setTitle('🛫 Tadkira API Gateway')
    .setDescription(
      `## API d'enregistrement en ligne pour compagnie aérienne

Point d'entrée unique de l'architecture microservices Tadkira.  
Toutes les requêtes de l'application mobile Kotlin passent par ce service.

### Services en aval
| Service | Port | Description |
|---------|------|-------------|
| Auth Service | 3001 | Authentification & gestion des comptes |
| Flight Service | 3002 | Données de vols et réservations (PNR) |
| Check-In Service | 3003 | Workflow d'enregistrement, sièges |
| OCR Service | 3004 | Scan et analyse de passeport |
| Boarding Pass Service | 3005 | Génération QR Code et PDF |

### Authentification
Utilisez le bouton **Authorize** ci-dessous pour saisir votre token JWT.  
Format : \`Bearer <votre_token>\`

### Codes d'erreur communs
| Code | Signification |
|------|--------------|
| \`401\` | Token JWT absent, invalide ou expiré |
| \`429\` | Trop de requêtes (rate limiting) |
| \`503\` | Service en aval temporairement indisponible |
      `,
    )
    .setVersion('1.0.0')
    .setContact('Équipe Tadkira', '', 'contact@tadkira.esi.dz')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    // Authentification Bearer JWT
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Saisir le token JWT obtenu après /auth/login ou /auth/register',
        in: 'header',
      },
      'JWT-Auth', // Nom du schéma de sécurité
    )
    .addTag('Health', '🩺 État du service API Gateway')
    .addTag('Auth', '🔑 Authentification & gestion des comptes')
    .addTag('Flights', '✈️ Consultation des vols et réservations')
    .addTag('Check-In', '📋 Workflow d\'enregistrement en ligne')
    .addTag('OCR', '🪪 Service de scan et analyse de passeport')
    .addTag('Boarding Pass', '🎫 Cartes d\'embarquement (QR Code & PDF)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // Garder le token entre les rechargements
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Tadkira API Docs',
  });

  console.log(`📋 Swagger UI disponible : http://localhost:${configService.get('app.port') || 3000}/${swaggerPath}`);
}
```

---

### Étape 5.2 — Intégrer dans `main.ts`

```typescript
// src/main.ts (mise à jour)
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  app.useGlobalFilters(new ThrottlerExceptionFilter());

  // Configuration Swagger (Phase 5)
  setupSwagger(app);

  await app.listen(port);
  console.log(`🚀 API Gateway démarré sur le port ${port}`);
}

bootstrap();
```

---

### Étape 5.3 — Annoter les Contrôleurs avec Swagger

#### Health Controller

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {

  @Get()
  @ApiOperation({
    summary: 'Vérification de l\'état du service',
    description: 'Vérifie que l\'API Gateway est opérationnel et que Redis est accessible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service opérationnel',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-03-30T14:00:00.000Z',
        service: 'api-gateway',
        dependencies: { redis: 'ok' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Service dégradé (Redis inaccessible)',
    schema: {
      example: {
        status: 'degraded',
        dependencies: { redis: 'unreachable' },
      },
    },
  })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'api-gateway' };
  }
}
```

---

#### Auth Proxy Controller

```typescript
// src/proxy/controllers/auth-proxy.controller.ts (annotations Swagger)
import {
  ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {

  @Public()
  @All('register')
  @ApiOperation({
    summary: 'Inscription d\'un nouveau passager',
    description: 'Crée un nouveau compte utilisateur. Forwardé vers Auth Service.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: { type: 'string', example: 'Ahmed Benali' },
        email: { type: 'string', example: 'ahmed@example.com' },
        phone: { type: 'string', example: '+213555123456' },
        password: { type: 'string', example: 'SecurePass123!' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides ou email déjà utilisé' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives d\'inscription' })
  @ApiResponse({ status: 503, description: 'Auth Service indisponible' })
  register(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('login')
  @ApiOperation({
    summary: 'Connexion par email et mot de passe',
    description: 'Authentifie le passager et retourne un token JWT valide 24h.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'ahmed@example.com' },
        password: { type: 'string', example: 'SecurePass123!' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie — Token JWT retourné',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: '24h',
        user: { id: 'uuid', name: 'Ahmed Benali', email: 'ahmed@example.com' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives — Anti brute-force' })
  @ApiResponse({ status: 503, description: 'Auth Service indisponible' })
  login(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('google')
  @ApiOperation({
    summary: 'Connexion via Google SSO',
    description: 'Authentification rapide avec un compte Google (OAuth2).',
  })
  @ApiBody({
    schema: {
      properties: {
        idToken: { type: 'string', description: 'Token Google OAuth2' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Connexion Google réussie' })
  @ApiResponse({ status: 503, description: 'Auth Service indisponible' })
  googleLogin(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('profile')
  @ApiOperation({
    summary: 'Récupérer le profil utilisateur connecté',
    description: '🔐 Requiert un token JWT valide.',
  })
  @ApiResponse({ status: 200, description: 'Profil utilisateur retourné' })
  @ApiResponse({ status: 401, description: 'Token JWT invalide ou absent' })
  @ApiResponse({ status: 503, description: 'Auth Service indisponible' })
  profile(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }
}
```

---

#### Flight, Check-In, OCR & Boarding Pass

```typescript
// Annotations à appliquer de manière similaire sur tous les contrôleurs

// Flights
@ApiTags('Flights')
@ApiOperation({ summary: 'Rechercher un vol par PNR et nom' })
@ApiQuery({ name: 'pnr', required: true, example: 'ABC123' })
@ApiQuery({ name: 'lastName', required: true, example: 'Dupont' })

// Check-In
@ApiTags('Check-In')
@ApiBearerAuth('JWT-Auth')
@ApiOperation({ summary: 'Récupérer la carte des sièges du vol' })
@ApiParam({ name: 'flightId', example: 'uuid-vol-123' })

// OCR
@ApiTags('OCR')
@ApiBearerAuth('JWT-Auth')
@ApiOperation({ summary: 'Scanner et analyser un passeport' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      passport: { type: 'string', format: 'binary', description: 'Image du passeport (JPEG/PNG)' },
    },
  },
})

// Boarding Pass
@ApiTags('Boarding Pass')
@ApiBearerAuth('JWT-Auth')
@ApiOperation({ summary: 'Télécharger la carte d\'embarquement' })
@ApiResponse({
  status: 200,
  description: 'Carte d\'embarquement (QR Code + URL PDF)',
  schema: {
    example: {
      qrCodeUrl: 'https://minio.tadkira.com/boarding-passes/uuid.png',
      pdfUrl: 'https://minio.tadkira.com/boarding-passes/uuid.pdf',
      checkInId: 'uuid-checkin',
    },
  },
})
```

---

## 🧪 Tests à Valider

```bash
# 1. Vérifier que Swagger UI est accessible
curl -I http://localhost:3000/api/docs
# Attendu : HTTP/1.1 200 OK

# 2. Vérifier que le JSON OpenAPI est disponible
curl http://localhost:3000/api/docs-json | python -m json.tool | head -30
# Attendu : JSON structuré avec info.title, paths, components...

# 3. Via navigateur
# Ouvrir : http://localhost:3000/api/docs
# → Vérifier bouton "Authorize" présent
# → Vérifier tous les tags : Health, Auth, Flights, Check-In, OCR, Boarding Pass
# → Tester un endpoint depuis l'UI Swagger

# 4. Test Swagger désactivé en production
SWAGGER_ENABLED=false npm run start:dev
curl -I http://localhost:3000/api/docs
# Attendu : HTTP/1.1 404 Not Found
```

---

## 🔗 Navigation

⬅️ **[Phase 4 — Rate Limiting Redis](./PHASE-4-rate-limiting.md)**  
➡️ **[Phase 6 — Logging & Gestion des Erreurs](./PHASE-6-logging-errors.md)**
