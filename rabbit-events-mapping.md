# Audit de Connectivité et Mapping des Événements RabbitMQ — Tadkira Ecosystem

Cet audit détaille l'état actuel des connexions entre les microservices et l'infrastructure partagée (Redis, RabbitMQ, MinIO), ainsi que le mapping des événements asynchrones.

## 1. État des Connexions Infrastructure

### 🟢 Redis (Cache & Verrous)
- **Shared Host** : `tadkira-redis:6379` (alias `redis` dans le réseau)
- **Services connectés** :
  - `API-GATEWAY-SERVICE` (Rate Limiting) — **OK**
  - `CHECK-IN-SEAT-SERVICE` (Seat Locks) — **OK**

### 🟡 RabbitMQ (Événements)
- **Shared Host** : `tadkira-rabbitmq:5672` (alias `rabbitmq` dans le réseau)
- **Services connectés** :
  - `CHECK-IN-SEAT-SERVICE` (Publishing) — **OK**
  - `BOARDING-PASS-SERVICE` (Listening) — **ERREUR** : Le service n'est pas démarré en mode microservice dans `main.ts`.

### 🔴 MinIO (Stockage S3)
- **Shared Host** : `tadkira-minio:9000` (alias `minio` dans le réseau)
- **Services connectés** :
  - `OCR-SERVICE` — **OK** (Mapping des clés d'accès correct dans compose)
  - `BOARDING-PASS-SERVICE` — **ERREUR** : Mismatch entre les variables d'env du code (`MINIO_ACCESS_KEY`) et du compose (`MINIO_ROOT_USER`).
- **Mismatch de Buckets** :
  - `TADKIRA-INFRA` crée `boarding-passes`.
  - `BOARDING-PASS-SERVICE` utilise `boarding-pass` (singulier).

---

## 2. Mapping des Événements RabbitMQ

| Événement | Émetteur (Publisher) | Récepteur (Subscriber) | Statut |
|:---|:---|:---|:---|
| `checkin.completed` | `CHECK-IN-SEAT-SERVICE` | *(Personne)* | ⚠️ Orphelin |
| `checkin.approved` | *(Personne)* | `BOARDING-PASS-SERVICE` | ⚠️ Jamais reçu |
| `seat.confirmed` | `CHECK-IN-SEAT-SERVICE` | `CHECK-IN-SEAT-SERVICE` | ✅ Interne |
| `flight.cancelled` | *(Personne)* | `BOARDING-PASS-SERVICE` | ⚠️ Manquant |

### 🔍 Détails des Problèmes Identifiés

#### A. Mismatch de pattern `checkin`
Le `Check-In Service` émet `checkin.completed` à la fin du workflow, mais le `Boarding Pass Service` attend `checkin.approved`. Ils ne communiquent donc pas.

#### B. Absence de Bootstrap Microservice
Dans les fichiers `main.ts` de `BOARDING-PASS-SERVICE` et `CHECK-IN-SEAT-SERVICE`, la méthode `app.connectMicroservice()` n'est pas appelée. Les décorateurs `@MessagePattern` et `@EventPattern` sont donc totalement inactifs.

#### C. Mismatch Configuration MinIO (Boarding Pass)
Le service `Boarding Pass` ne pourra pas uploader ses PDFs car il ne trouve pas les credentials `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` (le compose fournit `MINIO_ROOT_USER/PASSWORD`).

---

## 3. Plan de Correction Proposé

### Phase A : Harmonisation MinIO & Buckets
- Mettre à jour `BOARDING-PASS-SERVICE/docker-compose.yml` pour mapper `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY`.
- Aligner le nom du bucket sur `boarding-passes` (pluriel) dans `BoardingService`.

### Phase B : Activation des Microservices
- Modifier `main.ts` de `BOARDING-PASS-SERVICE` pour ajouter le transport RabbitMQ (Hybrid App).
- Modifier `main.ts` de `CHECK-IN-SEAT-SERVICE` pour supporter la réception d'événements si nécessaire.

### Phase C : Alignement des Événements
- Renommer `checkin.completed` en `checkin.approved` dans `CheckinService` pour déclencher la génération automatique du Boarding Pass.
- Ajouter l'émission de `flight.cancelled` dans `FlightService` lors de l'annulation d'un vol.
