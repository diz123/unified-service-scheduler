-- A-16: an empty [) range overlaps nothing, so zero-length intervals would bypass the overlap query and the exclusion constraints.
ALTER TABLE "ServiceType"
  ADD CONSTRAINT "service_type_duration_positive" CHECK ("durationMinutes" > 0);

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_end_after_start" CHECK ("endTime" > "startTime");
