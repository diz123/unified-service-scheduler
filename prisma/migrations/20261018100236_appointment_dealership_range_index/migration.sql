-- Overlap lookups by dealership (booking availability and technician workload) filter on
-- "dealershipId" = $1 AND tstzrange("startTime", "endTime", '[)') && $range AND "status" = 'Confirmed'.
-- The btree ("dealershipId", "startTime") index cannot serve the range overlap, so it read every past
-- appointment of the dealership. btree_gist is already installed (init migration).
CREATE INDEX "Appointment_dealership_range_confirmed_idx" ON "Appointment"
  USING gist ("dealershipId", tstzrange("startTime", "endTime", '[)'))
  WHERE "status" = 'Confirmed';
