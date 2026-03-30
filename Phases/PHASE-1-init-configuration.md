# Phase 1 — Initialisation NestJS & Configuration de Base

> **ID Backlog** : AG-1  
> **Priorité** : 🔴 Critique — Bloquant pour toutes les autres phases  
> **Dépendances** : Aucune  
> **Durée estimée** : 2–3 heures

---

## 🎯 Objectif

Initialiser le microservice **API Gateway** sous NestJS/TypeScript, configurer l'environnement, mettre en place la structure de dossiers du projet, créer le health check endpoint, et packager le service dans un Dockerfile.

---

## ✅ Critères d'Acceptation

- [ ] Projet NestJS initialisé avec TypeScript strict
- [ ] Module `@nestjs/config` configuré avec variables d'environnement
- [ ] Fichier `.env.example` complet et documenté
- [ ] Health check `GET /health` retournant `{ status: "ok", timestamp: "..." }`
- [ ] Structure de dossiers conforme à l'architecture définie
- [ ] `Dockerfile` fonctionnel (multi-stage build)
- [ ] `docker-compose.yml` local (Gateway + Redis)
- [ ] Le service démarre sans erreur avec `npm run start:dev`

---

## 📦 Dépendances à Installer

```bash
# Créer le projet NestJS
npx @nestjs/cli new api-gateway --package-manager npm

# Dépendances de production
npm install @nestjs/config dotenv

# Dépendances de développement
npm install -D @types/node
```

---

## 🗂️ Structure de Dossiers à Créer

```
api-gateway/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── jwt.config.ts
│   │   └── redis.config.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── proxy/
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   └── swagger/
│       └── swagger.setup.ts
├── Phases/
├── test/
├── .env
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 💻 Implémentation Étape par Étape

### Étape 1.1 — Fichier `.env.example`

Créer le fichier `.env.example` à la racine :

```env
# ─── Application ───────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── JWT ───────────────────────────────────────────
# Doit correspondre exactement au secret de l'Auth Service
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRATION=24h

# ─── Redis (Rate Limiting) ──────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ─── URLs des Microservices ─────────────────────────
AUTH_SERVICE_URL=http://auth-service:3001
FLIGHT_SERVICE_URL=http://flight-service:3002
CHECKIN_SERVICE_URL=http://checkin-service:3003
OCR_SERVICE_URL=http://ocr-service:3004
BOARDING_PASS_SERVICE_URL=http://boarding-pass-service:3005

# ─── Rate Limiting Global ───────────────────────────
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# ─── Swagger ───────────────────────────────────────
SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs
```

---

### Étape 1.2 — Configuration Applicative (`src/config/app.config.ts`)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    path: process.env.SWAGGER_PATH || 'api/docs',
  },
}));
```

---

### Étape 1.3 — Configuration JWT (`src/config/jwt.config.ts`)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRATION || '24h',
}));
```

---

### Étape 1.4 — Configuration Redis (`src/config/redis.config.ts`)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));
```

---

### Étape 1.5 — Configuration URLs des Services (`src/config/services.config.ts`)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('services', () => ({
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  flight: process.env.FLIGHT_SERVICE_URL || 'http://localhost:3002',
  checkin: process.env.CHECKIN_SERVICE_URL || 'http://localhost:3003',
  ocr: process.env.OCR_SERVICE_URL || 'http://localhost:3004',
  boardingPass: process.env.BOARDING_PASS_SERVICE_URL || 'http://localhost:3005',
}));
```

---

### Étape 1.6 — Module Racine (`src/app.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import servicesConfig from './config/services.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Configuration globale avec variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, jwtConfig, redisConfig, servicesConfig],
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

---

### Étape 1.7 — Health Check (`src/health/health.controller.ts`)

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Vérification de l\'état du service API Gateway' })
  @ApiResponse({
    status: 200,
    description: 'Service opérationnel',
    schema: {
      example: { status: 'ok', timestamp: '2026-03-30T14:00:00.000Z', service: 'api-gateway' },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
    };
  }
}
```

```typescript
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

---

### Étape 1.8 — Point d'Entrée (`src/main.ts`)

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  // CORS pour l'application mobile
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  await app.listen(port);
  console.log(`🚀 API Gateway démarré sur le port ${port}`);
  console.log(`📋 Health check : http://localhost:${port}/health`);
}

bootstrap();
```

---

### Étape 1.9 — Dockerfile (Multi-stage)

```dockerfile
# ─── Stage 1 : Build ───────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# ─── Stage 2 : Production ──────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
```

---

### Étape 1.10 — Docker Compose Local (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  api-gateway:
    build: .
    container_name: tadkira-gateway
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: development
      PORT: 3000
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      AUTH_SERVICE_URL: ${AUTH_SERVICE_URL:-http://host.docker.internal:3001}
      FLIGHT_SERVICE_URL: ${FLIGHT_SERVICE_URL:-http://host.docker.internal:3002}
      CHECKIN_SERVICE_URL: ${CHECKIN_SERVICE_URL:-http://host.docker.internal:3003}
      OCR_SERVICE_URL: ${OCR_SERVICE_URL:-http://host.docker.internal:3004}
      BOARDING_PASS_SERVICE_URL: ${BOARDING_PASS_SERVICE_URL:-http://host.docker.internal:3005}
      SWAGGER_ENABLED: 'true'
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: tadkira-redis
    ports:
      - '6379:6379'
    command: redis-server --save 60 1 --loglevel warning
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
```

---

## 🧪 Tests à Valider

```bash
# Démarrer le service
npm run start:dev

# Tester le health check
curl http://localhost:3000/health
# Attendu : { "status": "ok", "timestamp": "...", "service": "api-gateway" }

# Tester avec Docker
docker-compose up -d
curl http://localhost:3000/health
```

---

## 🔗 Lien vers la Phase Suivante

➡️ **[Phase 2 — Proxy & Routage vers les Microservices](./PHASE-2-proxy-routing.md)**
