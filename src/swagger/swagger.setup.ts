import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

/**
 * Setup Swagger UI for the API Gateway.
 * Configures tags, security schemes, and server descriptions.
 */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);

  // Check if Swagger is enabled (default: true)
  const swaggerEnabled = configService.get<boolean>('app.swagger.enabled') ?? true;
  if (!swaggerEnabled) {
    console.log('📋 Swagger UI is disabled (SWAGGER_ENABLED=false)');
    return;
  }

  const swaggerPath = configService.get<string>('app.swagger.path') || 'api/docs';

  const config = new DocumentBuilder()
    .setTitle('🛫 Tadkira API Gateway')
    .setDescription(
      `## Airline Online Check-in API Ecosystem
      
Point d'entrée unique de l'architecture microservices Tadkira.
Toutes les requêtes de l'application mobile Kotlin passent par ce service.

### Services Intégrés
| Service | Port | Description |
|---------|------|-------------|
| **Auth Service** | 3001 | Authentification & gestion des comptes |
| **Flight Service** | 3002 | Données de vols et réservations (PNR) |
| **Check-In Service** | 3003 | Workflow d'enregistrement, sièges |
| **OCR Service** | 3004 | Scan et analyse de passeport |
| **Boarding Pass Service** | 3005 | Génération QR Code et PDF |

### Authentification
Utilisez le bouton **Authorize** pour saisir votre token JWT.
Format : \`Bearer <votre_token>\`

### Codes d'erreur communs
| Code | Signification |
|------|--------------|
| \`401\` | Token JWT absent, invalide ou expiré |
| \`429\` | Trop de requêtes (rate limiting) |
| \`503\` | Service cible temporairement indisponible |
      `,
    )
    .setVersion('1.0.0')
    .setContact('Équipe Tadkira', '', 'contact@tadkira.esi.dz')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Saisir le token JWT obtenu après /auth/login',
        in: 'header',
      },
      'JWT-Auth',
    )
    .addTag('Health', '🩺 État du service API Gateway')
    .addTag('Auth', '🔑 Authentification & profils utilisateurs')
    .addTag('Flights', '✈️ Vols, réservations et passagers')
    .addTag('Check-In & Seats', '📋 Enregistrement et sélection de sièges')
    .addTag('OCR', '🪪 Scan et analyse de passeport')
    .addTag('Boarding Pass', '🎫 Cartes d\'embarquement')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
    },
    customSiteTitle: 'Tadkira API Gateway Documentation',
  });

  const port = configService.get<number>('app.port') || 3000;
  console.log(`📋 Swagger UI disponible : http://localhost:${port}/${swaggerPath}`);
}
