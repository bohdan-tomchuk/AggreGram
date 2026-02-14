import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSourceDto {
  @ApiProperty({
    description: 'Telegram channel username (without @)',
    example: 'TechCrunch',
  })
  @IsString()
  @IsNotEmpty()
  channelUsername: string;
}
