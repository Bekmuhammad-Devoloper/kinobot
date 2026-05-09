import { IsString, IsOptional, IsInt, IsBoolean, Min, Max, MinLength } from 'class-validator';

export class CreateBotDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  owner_telegram_id: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  duration_days?: number; // default 31

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBotDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  token?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  owner_telegram_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExtendLicenseDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  days: number;
}
