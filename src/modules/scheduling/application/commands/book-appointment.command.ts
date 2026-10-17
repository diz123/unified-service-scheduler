export interface BookAppointmentCommand {
  name: string;
  phone: string;
  licensePlate: string;
  make?: string;
  model?: string;
  dealershipId: string;
  serviceTypeId: string;
  startTime: Date;
  overnightConsent?: boolean;
}
