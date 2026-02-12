import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class SubmitCodeDto {
  @ApiProperty({
    example: '12345',
    description: 'Telegram verification code (5 digits)',
  })
  @IsString()
  @Length(5, 5, { message: 'Code must be exactly 5 digits' })
  @Matches(/^\d{5}$/, { message: 'Code must contain only digits' })
  code: string;
}
