import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @MaxLength(255)
  channel_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel_title?: string;

  @IsOptional()
  @IsString()
  invite_link?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel_username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  channel_title?: string;

  @IsOptional()
  @IsString()
  invite_link?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
