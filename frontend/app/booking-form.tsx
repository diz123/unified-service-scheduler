'use client';

import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react';
import { type BookedAppointment, bookAppointment, type Dealership, listServiceTypes, type ServiceType } from '../lib/api';
import { dateStrip, type StripDate } from '../lib/date-strip';
import { toUserMessage } from '../lib/error-messages';
import { formatLocal, todayIn } from '../lib/local-time';
import { type BookingForm as BookingFormValues, buildBookingPayload } from '../lib/payloads';
import { timeSlots } from '../lib/time-slots';

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

type TextField = 'name' | 'phone' | 'licensePlate' | 'make' | 'model' | 'date';

/** Approved copy for a date or time the browser did not supply as `YYYY-MM-DD` / `HH:mm` (FD-4). */
const INVALID_DATE_TIME = 'Please enter a valid date and time.';

interface Feedback {
  message: string;
  details: string[];
  /** The overnight-consent rejection is shown as a warning next to the consent checkbox, not as an error. */
  isWarning?: boolean;
}

interface Confirmation {
  appointment: BookedAppointment;
  timezone: string;
}

type Control = HTMLInputElement | HTMLSelectElement;

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

type IconName = 'person' | 'car' | 'wrench' | 'clock' | 'search' | 'hourglass' | 'check' | 'alert' | 'moon' | 'arrow';

const ICON_PATHS: Record<IconName, ReactNode> = {
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  car: (
    <>
      <path d="M4 15v-3l2-5c.3-.7 1-1 1.7-1h8.6c.7 0 1.4.3 1.7 1l2 5v3" />
      <path d="M3 12h18v4H3zM7 16v2M17 16v2" />
      <path d="M7 14h.01M17 14h.01" />
    </>
  ),
  wrench: <path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L20 11l-9 9a2.1 2.1 0 0 1-3-3l9-9 .6-.6a4 4 0 0 0-4.9-4.9l2.4 2.4-1.5 1.5-2.4-2.4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  hourglass: <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />,
  check: <path className="check-stroke" d="M5 12.5 10 17.5 19 7" />,
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

/** Line icons drawn for this page (no icon package; ADR-0002). Decorative: hidden from assistive technology. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/**
 * Field-level messages from the browser's own constraint validation (required, maxLength, min), shown after a field
 * is left or the form is submitted. Adds no rules of its own.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Set while the pointer is pressed on a submit button; see holdForSubmit.
  const isSubmitPress = useRef(false);

  const handleBlur = (event: FocusEvent<Control>) => {
    if (isSubmitPress.current) return;
    const { name, validationMessage } = event.target;
    setErrors((current) => ({ ...current, [name]: validationMessage }));
  };

  /**
   * On a submit button's pointerdown. The field blur that follows would add a message above the button and push it
   * away before the pointer is released, losing the click; submit shows every message instead. The flag clears after
   * the current event task, so a later blur behaves normally.
   */
  const holdForSubmit = () => {
    isSubmitPress.current = true;
    window.setTimeout(() => {
      isSubmitPress.current = false;
    }, 0);
  };

  /** Keeps a message that is already shown in step with the value. */
  const recheck = (control: Control) => {
    const { name, validationMessage } = control;
    setErrors((current) => (name in current ? { ...current, [name]: validationMessage } : current));
  };

  /** Shows every field's message and focuses the first invalid field; true when the form is valid. */
  const validateForm = (form: HTMLFormElement): boolean => {
    const next: Record<string, string> = {};
    let firstInvalid: Control | undefined;
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.name === '') continue;
      next[element.name] = element.validationMessage;
      if (firstInvalid === undefined && element.validationMessage !== '') firstInvalid = element;
    }
    setErrors(next);
    firstInvalid?.focus();
    return firstInvalid === undefined;
  };

  return { errors, handleBlur, holdForSubmit, recheck, validateForm, reset: () => setErrors({}) };
}

interface FieldProps {
  id: string;
  label: string;
  isRequired?: boolean;
  isOptional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

/** Label, control, helper text and field message; the control gets `id` and `aria-describedby` from `describedBy`. */
export function Field({ id, label, isRequired, isOptional, hint, error, children }: FieldProps) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id}>
        {label}
        {isRequired && (
          <span className="required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {isOptional && <span className="optional"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, hint?: ReactNode, error?: string): string | undefined =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

export function Alert({ message, details, isWarning }: Feedback) {
  return (
    <div className={isWarning ? 'alert alert-warning' : 'alert'} role="alert">
      <Icon name={isWarning ? 'moon' : 'alert'} />
      <div>
        <p>{message}</p>
        {details.length > 0 && (
          <ul>
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span className="badge-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

interface ChipOption {
  value: string;
  label: string;
  /** Screen-reader name when the visible label is abbreviated. */
  ariaLabel?: string;
}

interface ChipGroupProps {
  id: string;
  label: string;
  name: string;
  options: ChipOption[];
  value: string;
  isRequired: boolean;
  isDisabled: boolean;
  /** `required` on the radios; false when another control (the "Other date" input) carries the value. */
  isChoiceRequired: boolean;
  variant: 'strip' | 'grid';
  emptyText: string;
  hint?: ReactNode;
  error?: string;
  onSelect: (value: string, control: HTMLInputElement) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  children?: ReactNode;
}

/** Radio chips in a fieldset: arrow keys move between chips (native radio group), Space or Enter selects. */
function ChipGroup(props: ChipGroupProps) {
  const { id, label, name, options, value, isRequired, isDisabled, isChoiceRequired, variant, emptyText } = props;
  const { hint, error, onSelect, onBlur, children } = props;
  // Enter would submit the form; on a chip it selects it instead (the click runs the normal change path).
  const selectOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.click();
  };
  return (
    <fieldset
      className={error ? 'chip-group has-error' : 'chip-group'}
      disabled={isDisabled}
      aria-describedby={describedBy(id, hint, error)}
    >
      <legend className="visually-hidden">{label}</legend>
      <p className="group-label" aria-hidden="true">
        {label}
        {isRequired && <span className="required"> *</span>}
      </p>
      <div className={`chips chips-${variant}`}>
        {options.length === 0 && <p className="chips-empty">{emptyText}</p>}
        {options.map((option) => (
          <label key={option.value} className="chip">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              required={isChoiceRequired}
              aria-label={option.ariaLabel}
              onChange={(event) => onSelect(event.target.value, event.target)}
              onKeyDown={selectOnEnter}
              onBlur={onBlur}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

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
  // Only the latest dealership selection may fill the service-type list.
  const selectedDealership = useRef('');
  const fields = useFieldErrors();
  const uid = useId();
  const id = (field: string): string => `${uid}-${field}`;

  const dealership = dealerships.find((d) => d.id === values.dealershipId);
  const serviceType = serviceTypes.find((s) => s.id === values.serviceTypeId);
  const slots = dealership === undefined ? [] : timeSlots(dealership.openTime, dealership.closeTime);

  /** A chip was chosen: store its value (same `YYYY-MM-DD` / `HH:mm` format as before) and refresh its message. */
  const selectValue = (field: 'date' | 'time') => (value: string, control: HTMLInputElement) => {
    setValues((current) => ({ ...current, [field]: value }));
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
            onClick={() => setIsOtherDate((current) => !current)}
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
              onChange={handleText('date')}
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
          emptyText="Choose a dealership first"
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
