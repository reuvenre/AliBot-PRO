import { IsString, IsArray, IsOptional, IsNumber, IsIn, Min } from 'class-validator';

export class CampaignDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_discount?: number;

  @IsString()
  schedule_cron: string;

  @IsNumber()
  @Min(1)
  posts_per_run: number;

  @IsOptional()
  @IsIn(['he', 'en', 'ar'])
  language?: string;

  @IsOptional()
  @IsNumber()
  markup_percent?: number;

  @IsOptional()
  @IsString()
  post_template?: string;
}
