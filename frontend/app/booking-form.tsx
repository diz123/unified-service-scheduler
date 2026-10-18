'use client';

import { type ChangeEvent, type FormEvent, type ReactNode, useId, useRef, useState } from 'react';
import { type BookedAppointment, bookAppointment, type Dealership, listServiceTypes, type ServiceType } from '../lib/api';
import { dateStrip, type StripDate } from '../lib/date-strip';
import { toUserMessage } from '../lib/error-messages';
import { formatLocal, todayIn } from '../lib/local-time';
import { type BookingForm as BookingFormValues, buildBookingPayload } from '../lib/payloads';
import { timeSlots } from '../lib/time-slots';
import {
  Alert,
  ChipGroup,
  describedBy,
  type Feedback,
  Field,
  Icon,
  type IconName,
  Spinner,
  StatusBadge,
  useFieldErrors,
} from './form-kit';

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

type TextField = 'name' | 'phone' | 'licensePlate' | 'make' | 'model';

/** Approved copy for a date or time the browser did not supply as `YYYY-MM-DD` / `HH:mm` (FD-4). */
const INVALID_DATE_TIME = 'Please enter a valid date and time.';

interface Confirmation {
  appointment: BookedAppointment;
  timezone: string;
}

type SectionKey = 'details' | 'vehicle' | 'service' | 'time';

/** The four form sections and their required fields; display-only progress (Round v2, engineer-approved). */
const SECTIONS: { key: SectionKey; title: string; label: string; icon: IconName; required: (keyof BookingFormValues)[] }[] = [
  { key: 'details', title: 'Your details', label: 'Details', icon: 'person', required: ['name', 'phone'] },
  { key: 'vehicle', title: 'Vehicle', label: 'Vehicle', icon: 'car', required: ['licensePlate'] },
  { key: 'service', title: 'Service', label: 'Service', icon: 'wrench', required: ['dealershipId', 'serviceTypeId'] },
  { key: 'time', title: 'Time', label: 'Time', icon: 'clock', required: ['date', 'time'] },
];

/** Share of a section's required fields that are filled (0–1). */
const filledShare = (values: BookingFormValues, required: (keyof BookingFormValues)[]): number =>
  required.filter((field) => String(values[field]).trim() !== '').length / required.length;

/** Book Appointment (DESIGN.md API Contract), fields in the agreed booking-flow order. */
export function BookingForm({ dealerships }: { dealerships: Dealership[] }) {
  const [values, setValues] = useState<BookingFormValues>(EMPTY);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isConsentAsked, setIsConsentAsked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  const [strip, setStrip] = useState<StripDate[]>([]);
  const [isOtherDate, setIsOtherDate] = useState(false);
  // Earliest slot offered when the chosen date is today (dealership-local HH:mm).
  const [notBefore, setNotBefore] = useState<string | undefined>(undefined);
  // Only the latest dealership selection may fill the service-type list.
  const selectedDealership = useRef('');
  const fields = useFieldErrors();
  const uid = useId();
  const id = (field: string): string => `${uid}-${field}`;

  const dealership = dealerships.find((d) => d.id === values.dealershipId);
  const serviceType = serviceTypes.find((s) => s.id === values.serviceTypeId);
  const slots = dealership === undefined ? [] : timeSlots(dealership.openTime, dealership.closeTime, notBefore);

  /** Dealership-local `HH:mm` now when `date` is today there, so today's past slots are not offered. */
  const slotFloor = (date: string, timezone: string | undefined): string | undefined => {
    if (timezone === undefined || date !== todayIn(timezone)) return undefined;
    return formatLocal(new Date().toISOString(), timezone).slice(11, 16);
  };

  /** New date: today hides past slots, and a chosen time that is no longer offered is cleared. */
  const applyDate = (date: string, timezone: string | undefined) => {
    const floor = slotFloor(date, timezone);
    setNotBefore(floor);
    setValues((current) => ({
      ...current,
      date,
      time: floor !== undefined && current.time !== '' && current.time < floor ? '' : current.time,
    }));
  };

  /** Changing dealership, service, date or time ends the overnight-consent question: alert hidden, box unticked. */
  const clearConsent = () => {
    setIsConsentAsked(false);
    setValues((current) => ({ ...current, overnightConsent: false }));
    setFeedback((current) => (current?.isWarning ? null : current));
  };

  /** A chip was chosen: store its value (same `YYYY-MM-DD` / `HH:mm` format as before) and refresh its message. */
  const selectValue = (field: 'date' | 'time') => (value: string, control: HTMLInputElement) => {
    if (field === 'date') applyDate(value, dealership?.timezone);
    else setValues((current) => ({ ...current, time: value }));
    clearConsent();
    fields.recheck(control);
  };

  const handleText = (field: TextField) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    fields.recheck(event.target);
  };

  async function handleDealershipChange(event: ChangeEvent<HTMLSelectElement>) {
    const dealershipId = event.target.value;
    fields.recheck(event.target);
    selectedDealership.current = dealershipId;
    // The time slots belong to the dealership's hours, so the chosen time resets with it.
    setValues((current) => ({ ...current, dealershipId, serviceTypeId: '', time: '' }));
    setServiceTypes([]);
    setLoadError(null);
    const selected = dealerships.find((d) => d.id === dealershipId);
    setMinDate(selected === undefined ? undefined : todayIn(selected.timezone));
    setStrip(selected === undefined ? [] : dateStrip(selected.timezone));
    setNotBefore(slotFloor(values.date, selected?.timezone));
    clearConsent();
    if (dealershipId === '') return;
    const result = await listServiceTypes(dealershipId);
    if (selectedDealership.current !== dealershipId) return;
    if (result.ok) setServiceTypes(result.data);
    else setLoadError(toUserMessage(result.error).message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.validateForm(event.currentTarget)) return;
    if (dealership === undefined || isSubmitting) return;
    let payload;
    try {
      payload = buildBookingPayload(values, dealership.timezone);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      setFeedback({ message: INVALID_DATE_TIME, details: [] });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    const result = await bookAppointment(payload);
    setIsSubmitting(false);
    if (result.ok) {
      setConfirmation({ appointment: result.data, timezone: dealership.timezone });
      return;
    }
    const isOvernight = result.error.kind === 'response' && result.error.code === 'OVERNIGHT_CONSENT_REQUIRED';
    if (isOvernight) {
      setIsConsentAsked(true);
    }
    // Every form value is kept so the customer can adjust and resubmit (DESIGN.md Frontend handling).
    setFeedback({ ...toUserMessage(result.error), isWarning: isOvernight });
  }

  function handleBookAnother() {
    selectedDealership.current = '';
    setValues(EMPTY);
    setServiceTypes([]);
    setFeedback(null);
    setIsConsentAsked(false);
    setConfirmation(null);
    setMinDate(undefined);
    setStrip([]);
    setIsOtherDate(false);
    setNotBefore(undefined);
    fields.reset();
  }

  if (confirmation !== null) {
    const { appointment, timezone } = confirmation;
    const [startDate, startTime] = formatLocal(appointment.startTime, timezone).split(' ');
    const [endDate, endTime] = formatLocal(appointment.endTime, timezone).split(' ');
    return (
      <section className="confirmation" aria-live="polite">
        <div className="confirmation-head">
          <span className="confirmation-mark">
            <Icon name="check" />
          </span>
          <div className="confirmation-title">
            <div className="confirmation-title-row">
              <h3>Appointment booked</h3>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="muted">
              Bring your vehicle to reception at the start time. You can find this booking under &ldquo;Find my
              appointment&rdquo;.
            </p>
          </div>
        </div>
        <div className="time-box">
          <div>
            <p className="time-label">Start</p>
            <p className="time-big">{startTime}</p>
            <p className="time-date">{startDate}</p>
          </div>
          <span className="time-arrow">
            <Icon name="arrow" />
          </span>
          <div className="time-end">
            <p className="time-label">End</p>
            <p className="time-big">{endTime}</p>
            <p className="time-date">{endDate}</p>
          </div>
        </div>
        <p className="time-note">
          {startDate !== endDate && (
            <>
              <Icon name="moon" />
              Your vehicle stays overnight.{' '}
            </>
          )}
          Times are the dealership&apos;s local time ({timezone}).
        </p>
        <button type="button" className="button button-outline" onClick={handleBookAnother}>
          Book another
        </button>
      </section>
    );
  }

  const control = (field: string, hint?: ReactNode) => ({
    id: id(field),
    name: field,
    onBlur: fields.handleBlur,
    'aria-invalid': fields.errors[field] ? true : undefined,
    'aria-describedby': describedBy(id(field), hint, fields.errors[field]),
  });
  const progress = SECTIONS.map((section) => ({ ...section, share: filledShare(values, section.required) }));
  const completeCount = progress.filter((section) => section.share === 1).length;
  const isComplete = (key: SectionKey): boolean => progress.some((section) => section.key === key && section.share === 1);

  const sectionHead = (key: SectionKey) => {
    const section = SECTIONS.find((s) => s.key === key);
    if (section === undefined) return null;
    const done = isComplete(key);
    return (
      <div className="section-head">
        <span className={done ? 'section-chip is-complete' : 'section-chip'}>
          <Icon name={section.icon} />
        </span>
        <h3 id={id(`${key}-title`)} className="section-title">
          {section.title}
        </h3>
        {done && (
          <span className="complete-tag">
            <Icon name="check" />
            Complete
          </span>
        )}
      </div>
    );
  };

  const hoursHint = (
    <>
      <Icon name="clock" />
      {dealership ? `Open ${dealership.openTime}–${dealership.closeTime}` : 'Opening hours appear after you choose'}
    </>
  );
  const durationHint = (
    <>
      <Icon name="hourglass" />
      {serviceType ? `Duration ${serviceType.durationMinutes} min` : 'Duration appears after you choose'}
    </>
  );
  const timeHint = dealership
    ? `30-minute slots, ${dealership.openTime}–${dealership.closeTime}`
    : 'Available once a dealership is selected';

  return (
    <form className="booking" onSubmit={handleSubmit} noValidate>
      <div className="progress" role="group" aria-label="Booking progress">
        <div className="progress-head">
          <p className="progress-count" aria-live="polite">
            {completeCount} of {SECTIONS.length} sections complete
          </p>
          <p className="progress-note">
            Fields marked{' '}
            <span className="required" aria-hidden="true">
              *
            </span>{' '}
            are required
          </p>
        </div>
        <ol className="progress-steps">
          {progress.map((section, index) => (
            <li key={section.key} className="progress-step">
              <span className="progress-track" aria-hidden="true">
                <span className="progress-fill" style={{ width: `${Math.round(section.share * 100)}%` }} />
              </span>
              <span className="progress-label">
                {index + 1} {section.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <section className="form-card" aria-labelledby={id('details-title')}>
        {sectionHead('details')}
        <div className="grid cols-2">
          <Field id={id('name')} label="Name" isRequired error={fields.errors.name}>
            <input
              {...control('name')}
              value={values.name}
              onChange={handleText('name')}
              required
              maxLength={100}
              autoComplete="name"
              placeholder="Nguyen Van A"
            />
          </Field>
          <Field id={id('phone')} label="Phone" isRequired error={fields.errors.phone}>
            <input
              {...control('phone')}
              type="tel"
              value={values.phone}
              onChange={handleText('phone')}
              required
              maxLength={20}
              autoComplete="tel"
              placeholder="0901 234 567"
            />
          </Field>
        </div>
      </section>

      <section className="form-card" aria-labelledby={id('vehicle-title')}>
        {sectionHead('vehicle')}
        <div className="grid cols-3">
          <Field id={id('licensePlate')} label="License plate" isRequired error={fields.errors.licensePlate}>
            <input
              {...control('licensePlate')}
              value={values.licensePlate}
              onChange={handleText('licensePlate')}
              required
              maxLength={20}
              placeholder="51A-123.45"
            />
          </Field>
          <Field id={id('make')} label="Make" isOptional error={fields.errors.make}>
            <input
              {...control('make')}
              value={values.make}
              onChange={handleText('make')}
              maxLength={50}
              placeholder="Toyota"
            />
          </Field>
          <Field id={id('model')} label="Model" isOptional error={fields.errors.model}>
            <input
              {...control('model')}
              value={values.model}
              onChange={handleText('model')}
              maxLength={50}
              placeholder="Vios"
            />
          </Field>
        </div>
      </section>

      <section className="form-card" aria-labelledby={id('service-title')}>
        {sectionHead('service')}
        <div className="grid cols-2">
          <Field id={id('dealershipId')} label="Dealership" isRequired hint={hoursHint} error={fields.errors.dealershipId}>
            <select
              {...control('dealershipId', hoursHint)}
              value={values.dealershipId}
              onChange={handleDealershipChange}
              required
            >
              <option value="">Select a dealership</option>
              {dealerships.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id={id('serviceTypeId')}
            label="Service type"
            isRequired
            hint={durationHint}
            error={fields.errors.serviceTypeId}
          >
            <select
              {...control('serviceTypeId', durationHint)}
              value={values.serviceTypeId}
              onChange={(event) => {
                const serviceTypeId = event.target.value;
                setValues((current) => ({ ...current, serviceTypeId }));
                clearConsent();
                fields.recheck(event.target);
              }}
              required
              disabled={values.dealershipId === ''}
            >
              <option value="">Select a service</option>
              {serviceTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {loadError !== null && <Alert message={loadError} details={[]} />}
      </section>

      <section className="form-card" aria-labelledby={id('time-title')}>
        {sectionHead('time')}
        <ChipGroup
          id={id('date')}
          label="Date"
          name="date"
          options={strip.map((day) => ({ value: day.value, label: day.short, ariaLabel: day.full }))}
          value={values.date}
          isRequired
          isDisabled={dealership === undefined}
          isChoiceRequired={!isOtherDate}
          variant="strip"
          emptyText="Choose a dealership first"
          hint={dealership ? 'Next 14 days, dealership local time.' : undefined}
          error={fields.errors.date}
          onSelect={selectValue('date')}
          onBlur={fields.handleBlur}
        >
          <button
            type="button"
            className="link-button"
            aria-expanded={isOtherDate}
            aria-controls={id('otherDate')}
            onClick={() => {
              // Hiding the input: a date it set outside the strip would stay selected unseen, so clear it.
              if (isOtherDate && values.date !== '' && !strip.some((day) => day.value === values.date)) {
                setValues((current) => ({ ...current, date: '', time: '' }));
                setNotBefore(undefined);
                clearConsent();
              }
              setIsOtherDate((current) => !current);
            }}
          >
            {isOtherDate ? 'Hide other date' : 'Other date'}
          </button>
          {isOtherDate && (
            <input
              id={id('otherDate')}
              className="other-date"
              name="date"
              type="date"
              aria-label="Other date"
              aria-invalid={fields.errors.date ? true : undefined}
              value={values.date}
              onChange={(event) => {
                applyDate(event.target.value, dealership?.timezone);
                clearConsent();
                fields.recheck(event.target);
              }}
              onBlur={fields.handleBlur}
              min={minDate}
              required
            />
          )}
        </ChipGroup>
        <ChipGroup
          id={id('time')}
          label="Time"
          name="time"
          options={slots.map((slot) => ({ value: slot, label: slot }))}
          value={values.time}
          isRequired
          isDisabled={dealership === undefined}
          isChoiceRequired
          variant="grid"
          emptyText={
            dealership !== undefined && notBefore !== undefined
              ? 'No times left today. Choose another date.'
              : 'Choose a dealership first'
          }
          hint={dealership ? timeHint : undefined}
          error={fields.errors.time}
          onSelect={selectValue('time')}
          onBlur={fields.handleBlur}
        />
        {isConsentAsked && (
          <label className="consent" htmlFor={id('overnightConsent')}>
            <input
              id={id('overnightConsent')}
              type="checkbox"
              checked={values.overnightConsent}
              onChange={(event) => {
                const overnightConsent = event.target.checked;
                setValues((current) => ({ ...current, overnightConsent }));
              }}
            />
            <span>I agree to leave my vehicle overnight</span>
          </label>
        )}
      </section>

      {feedback !== null && <Alert {...feedback} />}

      <div className="submit-row">
        <button
          type="submit"
          className="button button-primary"
          disabled={isSubmitting}
          onPointerDown={fields.holdForSubmit}
        >
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Booking…' : 'Book appointment'}
        </button>
        <p className="muted">Instant confirmation. No account needed.</p>
      </div>
    </form>
  );
}
