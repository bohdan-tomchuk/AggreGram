import { IsString, IsEnum, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(['news', 'personal_blog', 'official'])
  channelType?: 'news' | 'personal_blog' | 'official';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  crawlPriority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
