import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { ConnectionService } from './services/connection.service';
import { InitConnectionDto } from './dto/init-connection.dto';
import { SubmitPhoneDto } from './dto/submit-phone.dto';
import { SubmitCodeDto } from './dto/submit-code.dto';
import { Submit2FADto } from './dto/submit-2fa.dto';

@ApiTags('Telegram')
@ApiBearerAuth()
@Controller('telegram')
export class TelegramController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Post('connect/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start Telegram connection (QR or phone)' })
  @ApiResponse({ status: 200, description: 'Auth flow initialized' })
  @ApiResponse({ status: 400, description: 'Invalid method or flow error' })
  async initConnection(
    @CurrentUser('id') userId: string,
    @Body() dto: InitConnectionDto,
  ) {
    return this.connectionService.initConnection(userId, dto.method);
  }

  @Post('connect/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit phone number for verification' })
  @ApiResponse({ status: 200, description: 'Code sent to phone' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  async submitPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitPhoneDto,
  ) {
    return this.connectionService.submitPhone(userId, dto.phoneNumber);
  }

  @Post('connect/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit Telegram verification code' })
  @ApiResponse({ status: 200, description: 'Code verified' })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  async submitCode(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitCodeDto,
  ) {
    return this.connectionService.submitCode(userId, dto.code);
  }

  @Post('connect/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit two-factor authentication password' })
  @ApiResponse({ status: 200, description: '2FA verified, setup starting' })
  @ApiResponse({ status: 400, description: 'Incorrect password' })
  async submit2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: Submit2FADto,
  ) {
    return this.connectionService.submit2FA(userId, dto.password);
  }

  @Post('connect/qr/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a new QR code' })
  @ApiResponse({ status: 200, description: 'New QR code generated' })
  @ApiResponse({ status: 400, description: 'No active QR session' })
  async refreshQr(@CurrentUser('id') userId: string) {
    return this.connectionService.refreshQr(userId);
  }

  @Get('connection')
  @ApiOperation({ summary: 'Get current Telegram connection status' })
  @ApiResponse({ status: 200, description: 'Connection status returned' })
  async getConnection(@CurrentUser('id') userId: string) {
    return this.connectionService.getStatus(userId);
  }

  @Delete('connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Telegram account' })
  @ApiResponse({ status: 200, description: 'Telegram disconnected' })
  async disconnect(@CurrentUser('id') userId: string) {
    await this.connectionService.disconnect(userId);
    return { message: 'Telegram disconnected successfully' };
  }
}
