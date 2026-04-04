import { registerAs } from '@nestjs/config';

export default registerAs('services', () => ({
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  flight: process.env.FLIGHT_SERVICE_URL || 'http://localhost:3002',
  checkin: process.env.CHECKIN_SERVICE_URL || 'http://localhost:3003',
  ocr: process.env.OCR_SERVICE_URL || 'http://localhost:3004',
  boardingPass: process.env.BOARDING_PASS_SERVICE_URL || 'http://localhost:3005',
}));
