'use client';

import { useEffect, useState } from 'react';
import { type Dealership, listDealerships } from '../lib/api';
import { toUserMessage } from '../lib/error-messages';
import { BookingForm } from './booking-form';
import { LookupForm } from './lookup-form';

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
    <main>
      <header>
        <p className="eyebrow">Unified Service Scheduler</p>
        <h1>Book a service appointment</h1>
      </header>
      {loadError !== null && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      <BookingForm dealerships={dealerships} />
      <section className="lookup" aria-labelledby="lookup-heading">
        <h2 id="lookup-heading">Find your appointments</h2>
        <LookupForm dealerships={dealerships} />
      </section>
    </main>
  );
}
