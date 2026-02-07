import { IsEmail, IsString, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @Match('password', { message: 'confirmPassword must match password' })
  confirmPassword: string;
}
