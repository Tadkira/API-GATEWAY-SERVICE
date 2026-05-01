<div align="center">

# 🛫 Tadkira — API Gateway Service

### Point d'entrée unique, sécurité et routage de l'architecture microservices

[![NestJS](https://img.shields.io/badge/NestJS-v10+-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Swagger](https://img.shields.io/badge/Swagger-API_Docs-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://swagger.io/)

</div>

---

## 📋 Table des Matières

1. [État d'Avancement du Projet](#-état-davancement-du-projet)
2. [Contexte du Projet](#-contexte-du-projet)
3. [Architecture Globale Microservices](#️-architecture-globale-microservices)
3. [Stack Technique](#️-stack-technique)
4. [Description du Service API Gateway](#-description-du-service-api-gateway)
5. [Backlogs API Gateway](#-backlogs-api-gateway)
6. [Phases de Développement](#-phases-de-développement)
7. [Structure du Projet](#-structure-du-projet)
8. [Variables d'Environnement](#️-variables-denvironnement)
9. [Installation & Démarrage](#-installation--démarrage)
10. [Endpoints & Routing](#-endpoints--routing)
11. [Critères d'Évaluation](#-critères-dévaluation)

---

## 📊 État d'Avancement du Projet

| Service / Composant | État | Port | Détails de l'intégration |
|:---:|:---:|:---:|---|
| **API Gateway** | 🟢 Opérationnel | `3000` | **Infrastructure complète** (Phases 1 à 6 terminées) |
| **Auth Service** | 🟢 Intégré | `3001` | Service de **Meriem** — Entièrement proxifié & sécurisé |
| **Flight Service** | 🟢 Intégré | `3002` | Service de **Meriem** — Entièrement proxifié |
| **Check-in Service** | 🟢 Intégré | `3003` | Service de **Meriem** — Entièrement proxifié & Rate Limited |
| **OCR Service** | 🔴 En attente | `3004` | *Attente développement collègue* |
| **Boarding Pass** | 🔴 En attente | `3005` | *Attente développement collègue* |
| **Shared Infra** | 🟢 Déployé | — | Un seul Redis, RabbitMQ & MinIO pour toute l'app |

---

## 🎯 Contexte du Projet

**Tadkira** est un projet académique de fin d'études (Promotion 2026, 2CS SIL — _Techniques de Développement Mobile_) réalisé à l'**École Nationale Supérieure d'Informatique (ESI)**. L'objectif est de concevoir et développer une **application mobile d'enregistrement en ligne pour une compagnie aérienne**.

### Vision Produit

L'application permet aux passagers de **compléter tout le processus d'enregistrement à distance**, avant d'arriver à l'aéroport :

- 🪪 **Vérification d'identité** par scan de passeport (OCR)
- 💺 **Choix du siège** via une carte interactive de l'avion
- 🧳 **Déclaration de bagages** et demandes spéciales
- 📱 **Carte d'embarquement digitale** avec QR Code unique
- 📶 **Mode hors-ligne** pour accès sans connexion à l'aéroport

L'équipe a opté pour une **architecture microservices** en backend, avec une application mobile native **Kotlin/Jetpack Compose** côté client, dont le point d'entrée unique est ce service : l'**API Gateway**.

---

## 👥 Acteurs du Système

| Acteur                                           | Rôle                   | Interaction                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passager (Client)**                            | Utilisateur principal  | Via l'application mobile Kotlin. Peut s'inscrire, s'authentifier, rechercher ses vols, effectuer le check-in, choisir son siège, déclarer ses bagages et télécharger sa carte d'embarquement. |
| **Système de Réservation Externe (GDS)**         | Fournisseur de données | Global Distribution System / Airline ERP. Fournit les données de vol et de réservation initiales (PNR).                                                                                       |
| **Agent Aéroportuaire / Système d'Embarquement** | Valideur               | Acteurs ou systèmes automatisés utilisant le QR Code généré pour valider l'embarquement ou vérifier les bagages.                                                                              |

---

## 📱 Fonctionnalités Principales de l'Application

### 1. Inscription & Connexion

Le passager peut créer un compte via :

- **Inscription classique** : Nom, adresse email, numéro de téléphone, mot de passe (hashé)
- **SSO Google** : Connexion rapide via compte Google

Processus détaillé :

1. L'utilisateur télécharge l'application et choisit son mode de création de compte
2. Vérification des informations de contact et création du profil utilisateur
3. Génération d'un **token JWT sécurisé** pour les sessions futures

### 2. Consultation de Vol (Flight Lookup)

Le passager accède à ses informations de voyage en saisissant :

- Sa **référence de réservation (PNR)**
- Son **nom de famille**

Le système retourne l'itinéraire complet avec le statut du check-in (ouvert/fermé) et un timer dynamique si le départ est dans moins de 24h.

### 3. Enregistrement en Ligne (Check-In)

> ⚠️ **Disponible uniquement dans les 24 heures précédant le départ**

Workflow séquentiel :

1. **Scan de Passeport (OCR)** : Le passager photographie la première page de son passeport. L'application envoie l'image au service OCR. Les données sont extraites et **vérifiées par rapport aux informations de réservation** (PNR).
2. **Validation des Détails** : Revue et confirmation des informations extraites (prénom, nom, date de naissance, numéro de document).
3. **Sélection de Siège** : Affichage d'une carte interactive de l'avion en temps réel. Verrouillage distribué du siège sélectionné via Redis pour éviter les doubles réservations.
4. **Déclaration de Bagages & Demandes Spéciales** : Bagages en soute, repas spéciaux, assistance, animaux de compagnie.
5. **Finalisation** : Validation globale de la transaction → Publication d'un **événement asynchrone RabbitMQ** (`CHECKIN_COMPLETED_EVENT`).

### 4. Carte d'Embarquement (Boarding Pass)

À la suite de l'événement de finalisation :

1. Génération d'un **QR Code unique signé cryptographiquement** (payload JWT)
2. Composition d'un **document PDF** contenant le QR Code + résumé du vol, uploadé sur MinIO S3
3. L'application mobile télécharge et met en **cache ces documents pour le mode hors-ligne**

Le QR Code peut être scanné aux :

- Comptoirs de dépôt des bagages
- Points de contrôle de sécurité
- Portes d'embarquement

### 5. Mode Hors-Ligne & Synchronisation

- La carte d'embarquement et les informations de vol sont **stockées localement** dans la base de données Room du smartphone
- Le passager peut accéder à l'application **sans connexion internet** (aux checkpoints de sécurité, portes d'embarquement)
- Au retour d'une connexion réseau, l'application **synchronise discrètement** les données (porte d'embarquement, retards, etc.) via Android WorkManager

---

## 🏗️ Architecture Globale Microservices

L'approche technique repose sur une **séparation claire** entre l'interface utilisateur native, une Gateway API, et des microservices orientés domaine. Cette conception assure **scalabilité, performance et intégration continue**.

```
┌─────────────────────────────────────────────────────┐
│                APPLICATION MOBILE                    │
│              (Kotlin + Jetpack Compose)              │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS / TLS
                        ▼
┌─────────────────────────────────────────────────────┐
│            🌐 API GATEWAY  ◄── CE SERVICE            │
│  • Routage vers les microservices                    │
│  • Validation JWT (Security Filter Global)           │
│  • Rate Limiting (Redis)                             │
│  • Documentation Swagger Globale                     │
│  • Logging centralisé & gestion d'erreurs            │
└──┬──────────┬──────────┬──────────┬────────┬────────┘
   │          │          │          │        │
   ▼          ▼          ▼          ▼        ▼
┌──────┐  ┌───────┐  ┌───────┐  ┌──────┐ ┌──────────┐
│ Auth │  │Flight │  │Check- │  │ OCR  │ │ Boarding │
│ Svc  │  │& Book │  │In &   │  │ Doc  │ │  Pass    │
│ :3001│  │  Svc  │  │ Seat  │  │ Svc  │ │   Svc    │
│      │  │ :3002 │  │ :3003 │  │:3004 │ │  :3005   │
└──────┘  └───────┘  └───┬───┘  └──────┘ └──────────┘
                          │ RabbitMQ Event
                          ▼
                    ┌──────────────┐
                    │ Notification │
                    │   Service    │
                    │ (Push/Email) │
                    └──────────────┘
```

### Topologie des Microservices

| #     | Service                        | Responsabilité                                              | Stack                      |
| ----- | ------------------------------ | ----------------------------------------------------------- | -------------------------- |
| **1** | **API Gateway** _(ce service)_ | Point d'entrée unique, routage, JWT, rate-limiting, Swagger | NestJS, Redis              |
| **2** | **Auth Service**               | Inscription, Google SSO, émission & validation JWT          | NestJS, Prisma, PostgreSQL |
| **3** | **Flight & Booking Service**   | Données de vols, récupération par PNR                       | NestJS, Prisma, PostgreSQL |
| **4** | **Check-In & Seat Service**    | Workflow check-in, carte sièges, verrous Redis              | NestJS, Redis, Prisma      |
| **5** | **Document OCR Service**       | Analyse passeport (Tesseract), upload MinIO temporaire      | NestJS, Tesseract, MinIO   |
| **6** | **Boarding Pass Service**      | Génération QR Code JWT signé, composition PDF               | NestJS, MinIO, PDFKit      |
| **7** | **Notification Service**       | Consommateur RabbitMQ, Push Firebase (FCM), Email           | NestJS, RabbitMQ, Firebase |

### Communication Inter-Services

- **gRPC** : Appels synchrones de haute performance entre services internes
- **RabbitMQ** : Événements asynchrones (ex: `CHECKIN_COMPLETED_EVENT`)
- **Redis** : Cache partagé, verrous distribués, tokens rapides

---

## 🛠️ Stack Technique

| Couche                 | Technologie              | Usage dans ce service                 |
| ---------------------- | ------------------------ | ------------------------------------- |
| **Framework**          | NestJS (TypeScript)      | Structure du service Gateway          |
| **Cache / Rate Limit** | Redis 7.x                | Stockage compteurs rate-limiting      |
| **Sécurité**           | JWT / Passport           | Validation des tokens d'accès         |
| **Documentation**      | Swagger / OpenAPI        | UI de documentation centralisée       |
| **Logging**            | Winston / Pino           | Logs structurés JSON (compatible ELK) |
| **Conteneurisation**   | Docker                   | Packaging et isolation                |
| **Orchestration**      | Kubernetes               | Déploiement haute disponibilité       |
| **CI/CD**              | GitHub Actions + Jenkins | Intégration et déploiement continus   |

---

## 🌐 Description du Service API Gateway

L'**API Gateway** est le **point d'entrée unique et exclusif** de toute l'architecture Tadkira. Chaque requête provenant de l'application mobile Kotlin passe **obligatoirement** par ce service avant d'atteindre un microservice cible.

Il concentre les responsabilités **transversales** suivantes :

| Responsabilité                  | Description                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **🔀 Routing / Proxy**          | Analyse chaque requête entrante et la redirige fidèlement vers le microservice approprié (headers, body, query params)               |
| **🔐 Security Filter (JWT)**    | Guard global qui valide le token JWT sur toutes les routes protégées avant transmission ; routes publiques exemptées via `@Public()` |
| **⏱️ Rate Limiting**            | Limites par IP via Redis pour protéger contre les abus et attaques DDoS (global + règles spécifiques par route)                      |
| **📚 Swagger Centralisé**       | Documentation OpenAPI agrégée de tous les services, accessible à `/api/docs` avec authentification Bearer                            |
| **📋 Logging & Error Handling** | Logging structuré JSON de chaque requête avec `requestId` unique ; filtre global normalisant toutes les réponses d'erreur            |

### Flux d'une Requête

```
Mobile App
    │
    ▼ HTTPS
API Gateway
    │
    ├─→ [Rate Limiter] → 429 si dépassement
    │
    ├─→ [JWT Guard]   → 401 si token invalide/absent
    │                    (bypass si route @Public)
    │
    ├─→ [Logger]      → log + requestId assigné
    │
    └─→ [Proxy Router] → forwarde vers le microservice cible
                              │
                              └─→ Réponse retournée au client
```

---

## 📋 Backlogs API Gateway (Détaillé)

Ce backlog détaille les tâches techniques réalisées pour l'infrastructure de la Gateway et l'intégration des services de **Meriem** (Auth, Flight, Check-in).

| Phase | Tâches Détaillées | État | Cible / Service |
|:---:|:---|:---:|:---:|
| **1** | Initialisation NestJS, ConfigModule (Namespaces), HealthModule & Dockerfile. | ✅ | Core Gateway |
| **2** | Implémentation `ProxyService` (Axios) & Forwarding transparent (Headers, Body). | ✅ | Core / Proxy |
| **2** | Création des contrôleurs Proxy pour les services de Meriem. | ✅ | Auth, Flight, Checkin |
| **3** | Implémentation `JwtAuthGuard` global & Décorateur `@Public()`. | ✅ | Sécurité |
| **3** | Injection automatique des headers d'identité (`X-User-Id`, `X-User-Email`). | ✅ | Intégration Meriem |
| **4** | Mise en place `RedisThrottlerStorage` (Compatible NestJS v5+). | ✅ | Sécurité / Redis |
| **4** | Application de limites spécifiques (Login: 10/min, Register: 5/min). | ✅ | Auth Service |
| **5** | Configuration `setupSwagger` centralisée avec Support Bearer Auth. | ✅ | Documentation |
| **5** | Annotation Swagger détaillée de tous les endpoints proxifiés de Meriem. | ✅ | UI / Swagger |
| **6** | Configuration Winston (JSON logs) & Intercepteur de logging (Duration). | ✅ | Observabilité |
| **6** | `AllExceptionsFilter` pour normaliser les erreurs des microservices. | ✅ | Core / Errors |
| **6** | Génération et propagation du `requestId` (UUID) dans tous les logs. | ✅ | Traçabilité |
| **7** | **Orchestration Docker Compose finale avec réseau `tadkira-network`.** | ⏳ | Déploiement |
| **+** | *Intégration future : OCR Service (Scan passeport)* | 🔴 | En attente |
| **+** | *Intégration future : Boarding Pass Service (PDF/QR)* | 🔴 | En attente |

### Vue d'ensemble des User Stories

| ID          | En tant que…        | Je veux…                                             | Afin de…                                                         |
| ----------- | ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **US-AG-1** | Développeur         | Initialiser le projet NestJS avec toutes les configs | Avoir une base solide et prête pour les phases suivantes         |
| **US-AG-2** | Application mobile  | Envoyer une requête à un seul endpoint               | Atteindre le bon microservice sans connaître son adresse interne |
| **US-AG-3** | Système             | Valider le JWT de chaque requête entrante            | Protéger tous les microservices des accès non autorisés          |
| **US-AG-4** | Système             | Limiter le nombre de requêtes par IP                 | Prévenir les abus, force-brute et surcharges                     |
| **US-AG-5** | Développeur/Testeur | Avoir une doc Swagger complète et centralisée        | Comprendre et tester l'API sans documentation externe            |
| **US-AG-6** | Équipe DevOps       | Avoir des logs structurés et des erreurs normalisées | Monitorer le service et diagnostiquer rapidement les incidents   |

### Règles de Routage (Tableau Complet)

| Route Source (Gateway)      | Méthode | Service Cible                 | Auth      | Rate Limit  |
| --------------------------- | ------- | ----------------------------- | --------- | ----------- |
| `/health`                   | GET     | _(interne)_                   | 🟢 Public | Non         |
| `/api/docs`                 | GET     | _(interne)_                   | 🟢 Public | Non         |
| `/auth/register`            | POST    | Auth Service `:3001`          | 🟢 Public | 5 req/60s   |
| `/auth/login`               | POST    | Auth Service `:3001`          | 🟢 Public | 10 req/60s  |
| `/auth/google*`             | GET     | Auth Service `:3001`          | 🟢 Public | 10 req/60s  |
| `/auth/refresh`             | POST    | Auth Service `:3001`          | 🟢 Public | 10 req/60s  |
| `/auth/logout`              | POST    | Auth Service `:3001`          | 🔐 JWT    | 100 req/60s |
| `/auth/profile/image`       | PATCH   | Auth Service `:3001`          | 🔐 JWT    | 10 req/60s  |
| `/auth/verify-email`        | POST    | Auth Service `:3001`          | 🟢 Public | 5 req/60s   |
| `/auth/resend-otp`          | POST    | Auth Service `:3001`          | 🟢 Public | 5 req/60s   |
| `/users/me`                 | GET/PATCH| Auth Service `:3001`          | 🔐 JWT    | 100 req/60s |
| `/users/device-token`       | POST    | Auth Service `:3001`          | 🔐 JWT    | 100 req/60s |
| `/flights/:id`              | GET     | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/flights/number/*`         | GET     | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/bookings/pnr/:pnr`        | GET     | Flight Service `:3002`        | 🔐 JWT    | 100 req/60s |
| `/bookings/user/:userId`    | GET     | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/bookings/:id`             | GET     | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/bookings/:id/claim`       | PATCH   | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/passengers/*`             | GET     | Flight Service `:3002`        | 🟢 Public | 100 req/60s |
| `/checkin/*`                | ALL     | CheckIn Service `:3003`       | 🔐 JWT    | 100 req/60s |
| `/seats/:flightId`          | GET     | CheckIn Service `:3003`       | 🟢 Public | 100 req/60s |
| `/seats/lock`               | POST/DEL| CheckIn Service `:3003`       | 🔐 JWT    | 10 req/30s  |
| `/seats/confirm`            | PATCH   | CheckIn Service `:3003`       | 🔐 JWT    | 10 req/30s  |
| `/ocr/passport`             | POST    | OCR Service `:3004`           | 🔐 JWT    | 5 req/5min  |
| `/boarding-pass/:id`        | GET     | Boarding Pass Service `:3005` | 🔐 JWT    | 100 req/60s |

---


---

## 📂 Structure du Projet Actualisée

```text
API-GATEWAY-SERVICE/
├── src/
│   ├── main.ts                        # Bootstrap, config Swagger & guards globaux
│   ├── app.module.ts                  # Module racine
│   │
│   ├── config/
│   │   ├── app.config.ts              # Configuration générale (port, env)
│   │   ├── jwt.config.ts              # Secret JWT, expiration
│   │   └── redis.config.ts            # Connexion Redis (rate-limiting)
│   │
│   ├── common/
│   │   ├── decorators/                # @Public(), @ThrottleLogin(), etc.
│   │   ├── filters/                   # AllExceptionsFilter (Erreurs microservices)
│   │   ├── guards/                    # JwtAuthGuard (Security Filter)
│   │   ├── interceptors/              # LoggingInterceptor (requestId + duration)
│   │   └── throttler/                 # RedisThrottlerStorage (v5 compatible)
│   ├── proxy/
│   │   ├── controllers/               # AuthProxy, FlightProxy, CheckinProxy
│   │   ├── proxy.module.ts            # Configuration Nest Axios
│   │   └── proxy.service.ts           # Logique de forwarding transparent
│   ├── health/                        # Health check endpoint
│   └── swagger/                       # Configuration Swagger centralisée
├── Phases/                            # Backlogs et guides par phase
├── test/                              # Tests unitaires et E2E
├── .env.example                       # Template des variables requises
└── docker-compose.yml                 # Orchestration du service
```

---

## ⚙️ Variables d'Environnement

```env
# ─── Application ───────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── JWT ───────────────────────────────────────────
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

## 🚀 Installation & Démarrage

### Prérequis

- Node.js >= 18.x
- npm >= 9.x
- Redis >= 7.x (local ou Docker)
- Docker & Docker Compose

### Installation

```bash
# Cloner le dépôt
git clone <repository-url>
cd api-gateway

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
```

### Démarrage en Développement

```bash
# Démarrer Redis via Docker
docker run -d -p 6379:6379 redis:7-alpine

# Démarrer en mode watch
npm run start:dev
```

### Démarrage avec Docker Compose

```bash
docker-compose up -d
```

### Tests

```bash
npm run test          # Tests unitaires
npm run test:cov      # Avec rapport de coverage
npm run test:e2e      # Tests end-to-end
npm run lint          # Lint TypeScript
```

---

## 🔌 Endpoints & Routing

### Public 🟢

| Méthode | Route                         | Description             |
| ------- | ----------------------------- | ----------------------- |
| `GET`   | `/health`                     | Health check du service |
| `GET`   | `/api/docs`                   | Swagger UI              |
| `POST`  | `/auth/register`              | Inscription             |
| `POST`  | `/auth/login`                 | Connexion email/mdp     |
| `GET`   | `/auth/google*`               | Connexion SSO Google    |
| `POST`  | `/auth/refresh`               | Rafraîchir le token     |
| `GET`   | `/flights/:id`                | Détails d'un vol        |
| `GET`   | `/flights/number/*`           | Recherche par numéro    |
| `GET`   | `/seats/:flightId`            | Carte des sièges        |

### Protégé 🔐 (JWT requis)

| Méthode      | Route                       | Service Cible         |
| ------------ | --------------------------- | --------------------- |
| `GET/PATCH`  | `/users/me`                 | Auth Service          |
| `POST`       | `/auth/logout`              | Auth Service          |
| `PATCH`      | `/auth/profile/image`       | Auth Service          |
| `GET`        | `/bookings/pnr/:pnr`        | Flight Service        |
| `ALL`        | `/checkin/*`                | CheckIn Service       |
| `POST/DELETE`| `/seats/lock`               | CheckIn Service       |
| `PATCH`      | `/seats/confirm`            | CheckIn Service       |
| `POST`       | `/ocr/passport`             | OCR Service           |
| `GET`        | `/boarding-pass/:id`        | Boarding Pass Service |

---

## 📊 Critères d'Évaluation

| Critère            | Attendu pour l'API Gateway                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| **Architecture**   | Code modulaire NestJS, séparation claire : proxy / guard / throttler / logger |
| **Sécurité**       | Guard JWT global robuste, routes publiques correctement exemptées, HTTPS      |
| **Performance**    | Rate limiting Redis fonctionnel, faible latence de routage                    |
| **Fonctionnalité** | Toutes les routes routées correctement, 503 sur service indisponible          |
| **Observabilité**  | Logs JSON structurés avec requestId, erreurs normalisées                      |
| **Documentation**  | Swagger complet avec Bearer auth, tous les endpoints documentés               |

---

<div align="center">

**Projet Tadkira — API Gateway Service**  
École Nationale Supérieure d'Informatique (ESI) · Promotion 2026 · 2CS SIL

_Développé par l'équipe Tadkira_

</div>
