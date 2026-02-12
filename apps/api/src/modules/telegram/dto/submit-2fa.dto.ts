import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Submit2FADto {
  @ApiProperty({
    example: 'my_2fa_password',
    description: 'Telegram two-factor authentication password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password must not be empty' })
  password: string;
}
