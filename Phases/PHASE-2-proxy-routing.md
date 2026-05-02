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
```

---

## 🗺️ Table de Routage Complète (Mise à jour)

| Route Source | Méthode | Service Cible | Protégé JWT | Rate Limit |
|-------------|---------|---------------|-------------|-----------|
| **Auth Service** | | | | |
| `/auth/register` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 5 req/60s |
| `/auth/login` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 10 req/60s |
| `/auth/google*` | GET | `AUTH_SERVICE_URL` | 🟢 Non | 10 req/60s |
| `/auth/refresh` | POST | `AUTH_SERVICE_URL` | 🟢 Non | 10 req/60s |
| `/auth/logout` | POST | `AUTH_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/auth/profile/image` | PATCH | `AUTH_SERVICE_URL` | 🔐 Oui | 10 req/60s |
| `/users/me` | GET/PATCH | `AUTH_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| **Flight Service** | | | | |
| `/flights/:id` | GET | `FLIGHT_SERVICE_URL` | 🟢 Non | 100 req/60s |
| `/flights/number/:num`| GET | `FLIGHT_SERVICE_URL` | 🟢 Non | 100 req/60s |
| `/bookings/pnr/:pnr` | GET | `FLIGHT_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/bookings/:id/claim` | PATCH | `FLIGHT_SERVICE_URL` | 🔐 Oui | 10 req/60s |
| `/passengers/*` | GET | `FLIGHT_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| **Check-in Service** | | | | |
| `/checkin/*` | ALL | `CHECKIN_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/seats/:flightId` | GET | `CHECKIN_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/seats/lock` | POST/DELETE | `CHECKIN_SERVICE_URL` | 🔐 Oui | 10 req/30s |
| **OCR Service** | | | | |
| `/ocr/sessions` | POST | `OCR_SERVICE_URL` | 🔐 Oui | 5 req/5min |
| `/ocr/sessions/:id` | GET | `OCR_SERVICE_URL` | 🔐 Oui | 100 req/60s |
| `/ocr/sessions/confirm`| PATCH | `OCR_SERVICE_URL` | 🔐 Oui | 10 req/60s |
| **Boarding Pass** | | | | |
| `/boarding-passes/*` | ALL | `BOARDING_PASS_SERVICE_URL`| 🔐 Oui | 100 req/60s |

---

## 💻 Implémentation

L'implémentation repose sur le `ProxyService` qui utilise `@nestjs/axios` pour forwarder les requêtes de manière transparente. Les contrôleurs proxy (`AuthProxyController`, `OcrProxyController`, etc.) définissent les points d'entrée et appellent le service de proxy.

Navigation:
⬅️ **[Phase 1 — Init & Configuration](./PHASE-1-init-configuration.md)**  
➡️ **[Phase 3 — JWT Security Filter](./PHASE-3-jwt-security.md)**
