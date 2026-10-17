'use client';

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import {
  type BookedAppointment,
  bookAppointment,
  type Dealership,
  listDealerships,
  listServiceTypes,
  type ServiceType,
} from '../lib/api';
import { toUserMessage } from '../lib/error-messages';
import { formatLocal } from '../lib/local-time';
import { type BookingForm as BookingFormValues, buildBookingPayload } from '../lib/payloads';

const EMPTY: BookingFormValues = {
  name: '',
  phone: '',
  licensePlate: '',
  make: '',
  model: '',
  dealershipId: '',
  serviceTypeId: '',
  date: '',
  time: '',
  overnightConsent: false,
};

type TextField = 'name' | 'phone' | 'licensePlate' | 'make' | 'model' | 'date' | 'time';

interface Feedback {
  message: string;
  details: string[];
}

interface Confirmation {
  appointment: BookedAppointment;
  timezone: string;
}

/** Book Appointment (DESIGN.md API Contract), fields in the agreed booking-flow order. */
export function BookingForm() {
  const [values, setValues] = useState<BookingFormValues>(EMPTY);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isConsentAsked, setIsConsentAsked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // Only the latest dealership selection may fill the service-type list.
  const selectedDealership = useRef('');

  useEffect(() => {
    let isActive = true;
    listDealerships().then((result) => {
      if (!isActive) return;
      if (result.ok) setDealerships(result.data);
      else setLoadError(toUserMessage(result.error).message);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const dealership = dealerships.find((d) => d.id === values.dealershipId);

  const handleText = (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
  };

  async function handleDealershipChange(event: ChangeEvent<HTMLSelectElement>) {
    const dealershipId = event.target.value;
    selectedDealership.current = dealershipId;
    setValues((current) => ({ ...current, dealershipId, serviceTypeId: '' }));
    setServiceTypes([]);
    setLoadError(null);
    if (dealershipId === '') return;
    const result = await listServiceTypes(dealershipId);
    if (selectedDealership.current !== dealershipId) return;
    if (result.ok) setServiceTypes(result.data);
    else setLoadError(toUserMessage(result.error).message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dealership === undefined || isSubmitting) return;
    const payload = buildBookingPayload(values, dealership.timezone);
    setIsSubmitting(true);
    setFeedback(null);
    const result = await bookAppointment(payload);
    setIsSubmitting(false);
    if (result.ok) {
      setConfirmation({ appointment: result.data, timezone: dealership.timezone });
      return;
    }
    if (result.error.kind === 'response' && result.error.code === 'OVERNIGHT_CONSENT_REQUIRED') {
      setIsConsentAsked(true);
    }
    // Every form value is kept so the customer can adjust and resubmit (DESIGN.md Frontend handling).
    setFeedback(toUserMessage(result.error));
  }

  function handleBookAnother() {
    selectedDealership.current = '';
    setValues(EMPTY);
    setServiceTypes([]);
    setFeedback(null);
    setIsConsentAsked(false);
    setConfirmation(null);
  }

  if (confirmation !== null) {
    const { appointment, timezone } = confirmation;
    return (
      <section className="confirmation" aria-live="polite">
        <h2>Appointment confirmed</h2>
        <dl>
          <dt>Start</dt>
          <dd>{formatLocal(appointment.startTime, timezone)}</dd>
          <dt>End</dt>
          <dd>{formatLocal(appointment.endTime, timezone)}</dd>
          <dt>Status</dt>
          <dd>{appointment.status}</dd>
        </dl>
        <p className="hint">Times are in the dealership&apos;s local time ({timezone}).</p>
        <button type="button" onClick={handleBookAnother}>
          Book another
        </button>
      </section>
    );
  }

  return (
    <form className="booking" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Your details</legend>
        <label>
          Name
          <input value={values.name} onChange={handleText('name')} required maxLength={100} autoComplete="name" />
        </label>
        <label>
          Phone
          <input
            type="tel"
            value={values.phone}
            onChange={handleText('phone')}
            required
            maxLength={20}
            autoComplete="tel"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Vehicle</legend>
        <label>
          License plate
          <input value={values.licensePlate} onChange={handleText('licensePlate')} required maxLength={20} />
        </label>
        <label>
          Make <span className="optional">(optional)</span>
          <input value={values.make} onChange={handleText('make')} maxLength={50} />
        </label>
        <label>
          Model <span className="optional">(optional)</span>
          <input value={values.model} onChange={handleText('model')} maxLength={50} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Service</legend>
        <label>
          Dealership
          <select value={values.dealershipId} onChange={handleDealershipChange} required>
            <option value="">Choose a dealership</option>
            {dealerships.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (open {d.openTime}–{d.closeTime})
              </option>
            ))}
          </select>
        </label>
        <label>
          Service type
          <select
            value={values.serviceTypeId}
            onChange={(event) => {
              const serviceTypeId = event.target.value;
              setValues((current) => ({ ...current, serviceTypeId }));
            }}
            required
            disabled={values.dealershipId === ''}
          >
            <option value="">Choose a service</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {loadError !== null && (
          <p className="error" role="alert">
            {loadError}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>When</legend>
        <p className="hint">Date and time are in the dealership&apos;s local time.</p>
        <div className="row">
          <label>
            Date
            <input type="date" value={values.date} onChange={handleText('date')} required />
          </label>
          <label>
            Time
            <input type="time" value={values.time} onChange={handleText('time')} required />
          </label>
        </div>
        {isConsentAsked && (
          <label className="consent">
            <input
              type="checkbox"
              checked={values.overnightConsent}
              onChange={(event) => {
                const overnightConsent = event.target.checked;
                setValues((current) => ({ ...current, overnightConsent }));
              }}
            />
            I agree to leave my vehicle overnight
          </label>
        )}
      </fieldset>

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

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Booking…' : 'Book appointment'}
      </button>
    </form>
  );
}
