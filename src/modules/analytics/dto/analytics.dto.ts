import { IsString, IsOptional, IsDate, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { REPORT_PERIODS, ReportPeriod } from '../interfaces';

export class GetAnalyticsDto {
  @IsEnum(Object.values(REPORT_PERIODS))
  @IsOptional()
  period?: ReportPeriod;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}

export class GenerateDailyReportDto {
  @IsDate()
  @Type(() => Date)
  date: Date;
}

export class ComparePeriodsDto {
  @IsDate()
  @Type(() => Date)
  period1Start: Date;

  @IsDate()
  @Type(() => Date)
  period1End: Date;

  @IsDate()
  @Type(() => Date)
  period2Start: Date;

  @IsDate()
  @Type(() => Date)
  period2End: Date;
}
