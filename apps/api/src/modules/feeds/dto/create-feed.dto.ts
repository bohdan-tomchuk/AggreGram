import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';

export class CreateFeedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  pollingIntervalSec?: number;
}
