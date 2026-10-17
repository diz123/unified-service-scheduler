import { IsString, Matches, MaxLength } from 'class-validator';

/** HTTP request body for Look Up Appointments; same identity rules as Book Appointment (DESIGN.md A-11). */
export class LookUpAppointmentsDto {
  @IsString()
  @Matches(/[A-Za-z0-9]/, { message: 'licensePlate must contain at least one letter or digit' })
  @MaxLength(20)
  licensePlate!: string;

  @IsString()
  @Matches(/\d/, { message: 'phone must contain at least one digit' })
  @MaxLength(20)
  phone!: string;
}
