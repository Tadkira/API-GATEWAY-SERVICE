import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '../proxy.service';
import { Public } from '../../common/decorators/public.decorator';
import { ThrottleLogin, ThrottleRegister } from '../../common/decorators/throttle.decorator';

@ApiTags('Auth')
@Controller()
export class AuthProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly configService: ConfigService,
  ) {}

  private get authServiceUrl(): string {
    return this.configService.get<string>('services.auth')!;
  }

  // /auth/* routes
  @Public()
  @ThrottleRegister()
  @All('auth/register')
  @ApiOperation({ summary: 'Inscription d\'un nouveau passager' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Ahmed Ben' },
        email: { type: 'string', example: 'ahmed@example.com' },
        password: { type: 'string', example: 'SecurePass123!' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Compte créé' })
  register(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @ThrottleLogin()
  @All('auth/login')
  @ApiOperation({ summary: 'Connexion par email et mot de passe' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'ahmed@example.com' },
        password: { type: 'string', example: 'SecurePass123!' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  login(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @ThrottleLogin()
  @All('auth/google*')
  @ApiOperation({ summary: 'Connexion via Google SSO' })
  google(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('auth/refresh')
  @ApiOperation({ summary: 'Rafraîchir le token de session' })
  refresh(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('auth/logout')
  @ApiOperation({ summary: 'Déconnexion de l\'utilisateur' })
  logout(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('auth/profile/image')
  @ApiOperation({ summary: 'Mettre à jour la photo de profil' })
  uploadProfileImage(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('auth/verify-email')
  @ApiOperation({ summary: 'Vérifier l\'adresse email (OTP)' })
  verifyEmail(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @Public()
  @All('auth/resend-otp')
  @ApiOperation({ summary: 'Renvoyer le code de vérification' })
  resendOtp(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  // /users/* routes
  @ApiBearerAuth('JWT-Auth')
  @All('users/me')
  @ApiOperation({ summary: 'Gérer mon profil utilisateur' })
  manageMe(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }

  @ApiBearerAuth('JWT-Auth')
  @All('users/device-token')
  @ApiOperation({ summary: 'Enregistrer le token de notification (FCM)' })
  saveDeviceToken(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, this.authServiceUrl);
  }
}
