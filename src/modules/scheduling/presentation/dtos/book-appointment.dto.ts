import { IsBoolean, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** UTC with the `Z` suffix, minute-aligned (DESIGN.md Validation order step 1). */
const UTC_MINUTE_ALIGNED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(\.0{1,3})?Z$/;

/** HTTP request body for Book Appointment (DESIGN.md, API Contract). */
export class BookAppointmentDto {
  // DESIGN.md Assumption 11: identity fields must not be blank.
  @IsString()
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/\d/, { message: 'phone must contain at least one digit' })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @Matches(/[A-Za-z0-9]/, { message: 'licensePlate must contain at least one letter or digit' })
  @MaxLength(20)
  licensePlate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @IsString()
  @IsNotEmpty()
  dealershipId!: string;

  @IsString()
  @IsNotEmpty()
  serviceTypeId!: string;

  @IsISO8601({ strict: true })
  @Matches(UTC_MINUTE_ALIGNED, { message: 'startTime must be UTC with a Z suffix and zero seconds' })
  startTime!: string;

  @IsOptional()
  @IsBoolean()
  overnightConsent?: boolean;
}
