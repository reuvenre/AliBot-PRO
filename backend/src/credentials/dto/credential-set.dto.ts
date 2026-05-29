import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CredentialSetDto {
  @IsOptional()
  @IsString()
  aliexpress_app_key?: string;

  @IsOptional()
  @IsString()
  aliexpress_app_secret?: string;

  @IsOptional()
  @IsString()
  aliexpress_tracking_id?: string;

  @IsOptional()
  @IsString()
  telegram_bot_token?: string;

  @IsOptional()
  @IsString()
  telegram_channel_id?: string;

  @IsOptional()
  @IsString()
  openai_api_key?: string;

  @IsOptional()
  @IsString()
  openai_model?: string;

  @IsOptional()
  @IsString()
  currency_pair?: string;

  @IsOptional()
  @IsBoolean()
  schedule_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  schedule_start_hour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  schedule_end_hour?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  schedule_interval_minutes?: number;
}
