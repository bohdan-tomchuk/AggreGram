import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
   * Get pipeline health: queue depths + recent aggregation jobs.
   * Requires authentication.
   */
  @UseGuards(JwtAuthGuard)
  @Get('pipeline')
  async getPipelineHealth(@CurrentUser('id') userId: string) {
    return this.healthService.getPipelineHealth(userId);
  }
}
