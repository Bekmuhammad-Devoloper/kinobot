import { IsString, IsOptional, IsBoolean, IsNumber, MaxLength, MinLength } from 'class-validator';

export class CreateMovieDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  file_id: string;

  @IsOptional()
  @IsString()
  file_type?: string;

  @IsOptional()
  @IsString()
  thumbnail_file_id?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  file_size?: number;

  @IsOptional()
  @IsBoolean()
  is_premiere?: boolean;

  @IsOptional()
  @IsNumber()
  premiere_order?: number;

  @IsOptional()
  @IsNumber()
  uploaded_by?: number;
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  file_id?: string;

  @IsOptional()
  @IsString()
  thumbnail_file_id?: string;

  @IsOptional()
  @IsBoolean()
  is_premiere?: boolean;

  @IsOptional()
  @IsNumber()
  premiere_order?: number;
}

export class SetPremiereDto {
  @IsBoolean()
  is_premiere: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}
