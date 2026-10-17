import { BookingForm } from './booking-form';

/** Booking and lookup on one page (DESIGN.md Target Deliverables); lookup is added in the next round. */
export default function Page() {
  return (
    <main>
      <header>
        <p className="eyebrow">Unified Service Scheduler</p>
        <h1>Book a service appointment</h1>
      </header>
      <BookingForm />
    </main>
  );
}
