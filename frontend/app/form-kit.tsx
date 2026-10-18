'use client';

import { type FocusEvent, type KeyboardEvent, type ReactNode, useRef, useState } from 'react';

// Shared form pieces for the booking and lookup forms: icons, fields with messages, alerts, badges, chip groups.

export interface Feedback {
  message: string;
  details: string[];
  /** The overnight-consent rejection is shown as a warning next to the consent checkbox, not as an error. */
  isWarning?: boolean;
}

type Control = HTMLInputElement | HTMLSelectElement;

export type IconName = 'person' | 'car' | 'wrench' | 'clock' | 'search' | 'hourglass' | 'check' | 'alert' | 'moon' | 'arrow';

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
export function ChipGroup(props: ChipGroupProps) {
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
