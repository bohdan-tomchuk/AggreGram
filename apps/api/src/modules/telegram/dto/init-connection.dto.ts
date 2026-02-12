import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class InitConnectionDto {
  @ApiProperty({
    example: 'qr',
    description: 'Authentication method: QR code scan or phone number',
    enum: ['qr', 'phone'],
  })
  @IsString()
  @IsIn(['qr', 'phone'])
  method: 'qr' | 'phone';
}
