import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Get overall feed system health metrics.
   * Public endpoint for monitoring.
   */
  @Public()
  @Get('feeds')
  async getFeedHealth() {
    return this.healthService.getFeedHealth();
  }

  /**
   * Get session health for the current user.
   * Requires authentication.
   */
  @UseGuards(JwtAuthGuard)
  @Get('session')
  async getMySessionHealth(@CurrentUser('id') userId: string) {
    return this.healthService.getSessionHealth(userId);
  }

  /**
   * Get session health for a specific user (admin/debug endpoint).
   * Requires authentication.
   */
  @UseGuards(JwtAuthGuard)
  @Get('session/:userId')
  async getSessionHealth(@Param('userId') userId: string) {
    return this.healthService.getSessionHealth(userId);
  }
}
