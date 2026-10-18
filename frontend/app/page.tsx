'use client';

import { useEffect, useState } from 'react';
import { type Dealership, listDealerships } from '../lib/api';
import { toUserMessage } from '../lib/error-messages';
import { BookingForm } from './booking-form';
import { Alert } from './form-kit';
import { LogoMark } from './logo';
import { LookupForm } from './lookup-form';

const HERO_CREDIT_URL = 'https://www.pexels.com/video/a-man-checking-the-car-engine-8986890/';

/** Booking and lookup on one page (DESIGN.md Target Deliverables), sharing one dealership list. */
export default function Page() {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return (
    <>
      <section className="hero" aria-labelledby="page-title">
        {/* The poster is the hero background; the video plays on wide screens with motion allowed (CSS hides it otherwise). */}
        <video
          className="hero-media hero-video"
          src="/hero/hero-loop.mp4"
          poster="/hero/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="hero-warmth" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-top">
          <span className="brand">
            <span className="brand-mark">
              <LogoMark className="logo-mark" />
            </span>
            Unified Service Scheduler
          </span>
          <a className="hero-credit" href={HERO_CREDIT_URL} target="_blank" rel="noopener noreferrer">
            Artem Podrez / Pexels
          </a>
        </div>
        <div className="hero-content">
          <p className="eyebrow">Dealer service · Ho Chi Minh City</p>
          <h1 id="page-title">Book a service appointment</h1>
          <p className="lede">
            Choose a service center, service and time. No account needed — look up your booking anytime with your
            license plate and phone number.
          </p>
        </div>
      </section>

      <main className="layout">
        {loadError !== null && (
          <div className="layout-alert">
            <Alert message={loadError} details={[]} />
          </div>
        )}
        <section className="booking-column" aria-labelledby="booking-heading">
          <h2 id="booking-heading" className="visually-hidden">
            Book an appointment
          </h2>
          <BookingForm dealerships={dealerships} />
        </section>
        <aside className="lookup-card" aria-labelledby="lookup-heading">
          <div className="lookup-art" aria-hidden="true">
            <svg viewBox="0 0 240 90" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M10 76h220" strokeOpacity="0.35" />
              <path d="M38 62v-14c0-4 3-7 7-8l14-3 14-12c3-3 7-4 11-4h33c4 0 8 2 11 5l14 14 18 3c6 1 10 6 10 12v7h-12" />
              <path d="M76 62h48M38 62h8" />
              <circle cx="61" cy="64" r="8" />
              <circle cx="139" cy="64" r="8" />
              <path d="M78 34l-8 11h28V32H84c-2 0-4 1-6 2ZM106 32v13h33l-10-10c-2-2-4-3-7-3h-16Z" strokeOpacity="0.6" />
              <circle cx="190" cy="30" r="17" fill="#fff" />
              <path d="M181 26h18M181 33h12" />
              <path d="M202 42l14 14" strokeWidth="4" />
            </svg>
          </div>
          <div className="lookup-inner">
            <h2 id="lookup-heading" className="card-title">
              Find my appointment
            </h2>
            <p className="hint">Enter the license plate and phone number you booked with.</p>
            <LookupForm dealerships={dealerships} />
          </div>
        </aside>
      </main>
    </>
  );
}
