import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  usernameOrLink: string;

  @IsString()
  topic: string;

  @IsEnum(['news', 'personal_blog', 'official'])
  channelType: 'news' | 'personal_blog' | 'official';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  crawlPriority?: number;
}
