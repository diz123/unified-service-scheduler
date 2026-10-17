import { IsString, Matches } from 'class-validator';

/** HTTP request body for Look Up Appointments; same identity rules as Book Appointment (DESIGN.md A-11). */
export class LookUpAppointmentsDto {
  @IsString()
  @Matches(/[A-Za-z0-9]/, { message: 'licensePlate must contain at least one letter or digit' })
  licensePlate!: string;

  @IsString()
  @Matches(/\d/, { message: 'phone must contain at least one digit' })
  phone!: string;
}
