'use client';

import { type FormEvent, useState } from 'react';
import { type AppointmentSummary, type Dealership, lookUpAppointments } from '../lib/api';
import { toUserMessage } from '../lib/error-messages';
import { formatLocal } from '../lib/local-time';
import { withTimezones } from '../lib/lookup-rows';
import { buildLookupPayload, type LookupForm as LookupFormValues } from '../lib/payloads';

interface Feedback {
  message: string;
  details: string[];
}

/** Look Up Appointments (DESIGN.md Read-Only Operations): one row per appointment, as returned, newest first. */
export function LookupForm({ dealerships }: { dealerships: Dealership[] }) {
  const [values, setValues] = useState<LookupFormValues>({ licensePlate: '', phone: '' });
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rows = appointments === null ? [] : withTimezones(appointments, dealerships);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    setAppointments(null);
    const result = await lookUpAppointments(buildLookupPayload(values));
    setIsSubmitting(false);
    // On an error the entered values are kept; APPOINTMENTS_NOT_FOUND shows its message, not an empty list.
    if (result.ok) setAppointments(result.data);
    else setFeedback(toUserMessage(result.error));
  }

  return (
    <div className="lookup-body">
      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Your vehicle</legend>
          <div className="row">
            <label>
              License plate
              <input
                value={values.licensePlate}
                onChange={(event) => {
                  const licensePlate = event.target.value;
                  setValues((current) => ({ ...current, licensePlate }));
                }}
                required
                maxLength={20}
              />
            </label>
            <label>
              Phone
              <input
                type="tel"
                value={values.phone}
                onChange={(event) => {
                  const phone = event.target.value;
                  setValues((current) => ({ ...current, phone }));
                }}
                required
                maxLength={20}
                autoComplete="tel"
              />
            </label>
          </div>
        </fieldset>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Searching…' : 'Find appointments'}
        </button>
      </form>

      {feedback !== null && (
        <div className="error" role="alert">
          <p>{feedback.message}</p>
          {feedback.details.length > 0 && (
            <ul>
              {feedback.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="results" aria-live="polite">
          <table>
            <caption>Times are in each dealership&apos;s local time.</caption>
            <thead>
              <tr>
                <th scope="col">Dealership</th>
                <th scope="col">Service</th>
                <th scope="col">Start</th>
                <th scope="col">End</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ appointment, timezone }) => (
                <tr key={appointment.id}>
                  <td>{appointment.dealership.name}</td>
                  <td>{appointment.serviceType.name}</td>
                  <td>{formatLocal(appointment.startTime, timezone)}</td>
                  <td>{formatLocal(appointment.endTime, timezone)}</td>
                  <td>{appointment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
