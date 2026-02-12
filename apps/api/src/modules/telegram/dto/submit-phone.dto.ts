import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SubmitPhoneDto {
  @ApiProperty({
    example: '+15551234567',
    description: 'Phone number in full international format',
  })
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone number must be in international format (e.g. +15551234567)',
  })
  phoneNumber: string;
}
