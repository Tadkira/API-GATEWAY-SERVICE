# 🏗️ Tadkira — Infrastructure Partagée

Ce dossier contient la stack d'infrastructure **commune à tous les microservices** du projet Tadkira.

## Services inclus

| Service | Port | Usage | Console |
|---------|------|-------|---------|
| **Redis** | `6379` | Rate-limiting (API Gateway), Verrous sièges (Check-In Service) | — |
| **RabbitMQ** | `5672` / `15672` | Événements asynchrones inter-services (`CHECKIN_COMPLETED_EVENT`) | http://localhost:15672 |
| **MinIO (S3)** | `9000` / `9001` | Images passeports (OCR), PDFs boarding pass | http://localhost:9001 |

## Buckets MinIO créés automatiquement

| Bucket | Usage | Visibilité |
|--------|-------|-----------|
| `passport-scans` | Images passeport temporaires (TTL — supprimées après OCR) | Privé |
| `boarding-passes` | QR Codes + PDFs d'embarquement | Public download |

## Démarrage

```bash
# 1. Copier et configurer les variables d'environnement
cp infra/.env.example infra/.env

# 2. Lancer l'infrastructure (une seule fois pour tout le projet)
docker-compose -f infra/docker-compose.infra.yml up -d

# 3. Vérifier que tout est healthy
docker-compose -f infra/docker-compose.infra.yml ps
```

## Connexion des microservices

Chaque microservice se connecte au réseau `tadkira-network` déclaré comme **externe** :

```yaml
# Dans le docker-compose.yml de chaque microservice
networks:
  tadkira-network:
    external: true
    name: tadkira-network
```

Variables d'environnement à utiliser dans les microservices :

```env
# Redis
REDIS_HOST=tadkira-redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://tadkira:tadkira_pass@tadkira-rabbitmq:5672

# MinIO
MINIO_ENDPOINT=tadkira-minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=tadkira_admin
MINIO_SECRET_KEY=tadkira_secret
```

## Arrêt

```bash
docker-compose -f infra/docker-compose.infra.yml down          # Arrêter (données conservées)
docker-compose -f infra/docker-compose.infra.yml down -v       # Arrêter + supprimer les volumes
```
