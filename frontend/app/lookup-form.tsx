'use client';

import { type FormEvent, useId, useState } from 'react';
import { type AppointmentSummary, type Dealership, lookUpAppointments } from '../lib/api';
import { toUserMessage } from '../lib/error-messages';
import { formatLocal } from '../lib/local-time';
import { withTimezones } from '../lib/lookup-rows';
import { buildLookupPayload, type LookupForm as LookupFormValues } from '../lib/payloads';
import { Alert, describedBy, Field, Icon, Spinner, StatusBadge, useFieldErrors } from './booking-form';

interface Feedback {
  message: string;
  details: string[];
}

const SKELETON_ROWS = 2;

/** Look Up Appointments (DESIGN.md Read-Only Operations): one row per appointment, as returned, newest first. */
export function LookupForm({ dealerships }: { dealerships: Dealership[] }) {
  const [values, setValues] = useState<LookupFormValues>({ licensePlate: '', phone: '' });
  const [appointments, setAppointments] = useState<AppointmentSummary[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fields = useFieldErrors();
  const uid = useId();
  const id = (field: string): string => `${uid}-${field}`;

  const rows = appointments === null ? [] : withTimezones(appointments, dealerships);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.validateForm(event.currentTarget)) return;
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

  const control = (field: string) => ({
    id: id(field),
    name: field,
    onBlur: fields.handleBlur,
    'aria-invalid': fields.errors[field] ? true : undefined,
    'aria-describedby': describedBy(id(field), undefined, fields.errors[field]),
  });

  return (
    <div className="lookup-body">
      <form onSubmit={handleSubmit} noValidate>
        <Field id={id('licensePlate')} label="License plate" isRequired error={fields.errors.licensePlate}>
          <input
            {...control('licensePlate')}
            value={values.licensePlate}
            onChange={(event) => {
              const licensePlate = event.target.value;
              setValues((current) => ({ ...current, licensePlate }));
              fields.recheck(event.target);
            }}
            required
            maxLength={20}
            placeholder="51A-123.45"
          />
        </Field>
        <Field id={id('phone')} label="Phone" isRequired error={fields.errors.phone}>
          <input
            {...control('phone')}
            type="tel"
            value={values.phone}
            onChange={(event) => {
              const phone = event.target.value;
              setValues((current) => ({ ...current, phone }));
              fields.recheck(event.target);
            }}
            required
            maxLength={20}
            autoComplete="tel"
            placeholder="0901 234 567"
          />
        </Field>
        <button
          type="submit"
          className="button button-outline button-block"
          disabled={isSubmitting}
          onPointerDown={fields.holdForSubmit}
        >
          {isSubmitting ? <Spinner /> : <Icon name="search" />}
          {isSubmitting ? 'Searching…' : 'Find appointments'}
        </button>
      </form>

      {feedback !== null && <Alert message={feedback.message} details={feedback.details} />}

      {isSubmitting && (
        <div className="results" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="appointment is-skeleton">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="results" aria-live="polite">
          <div className="results-head">
            <p className="results-count">
              {rows.length} {rows.length === 1 ? 'appointment' : 'appointments'}
            </p>
            <p className="muted">Dealership local time</p>
          </div>
          <ol className="appointment-list">
            {rows.map(({ appointment, timezone }) => (
              <li key={appointment.id} className="appointment">
                <div className="appointment-head">
                  <span className="appointment-dealer">{appointment.dealership.name}</span>
                  <StatusBadge status={appointment.status} />
                </div>
                <p className="appointment-service">{appointment.serviceType.name}</p>
                <p className="appointment-time">
                  {formatLocal(appointment.startTime, timezone)} → {formatLocal(appointment.endTime, timezone)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
