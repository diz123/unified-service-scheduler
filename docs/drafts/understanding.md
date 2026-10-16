**Main Goal**: Build an MVP for "The Unified Service Scheduler" to replace manual booking systems.

**Domain & Scope**: Ownership domain. Focus strictly on core appointment scheduling workflows and dual-resource allocation. The MVP only completes a booking: a successful request creates an `Appointment` in `Confirmed` status; no other status transitions are in scope.

**Core Requirements**:
  1. **Resource-Constrained Booking**: Allow a user to request a service appointment for a specific vehicle, service type, and dealership at a desired time.
  2. **Real-Time Availability Check**: Before confirming, verify the availability of both a `ServiceBay` and a qualified `Technician` for the entire service duration.
  3. **Confirmed Appointment Record**: Upon success, create a persistent `Appointment` record associating the customer, vehicle, technician, and service bay.

**Target Deliverables**: Complete MVP system design and workflow, architectural decisions, implementation planning documentation, and a backend MVP codebase strictly focused on the 3 core requirements above.

**Decision + Reason**: Limit the initial release strictly to a backend-focused MVP covering the 3 core requirements with no unrequested feature expansion, keeping the implementation footprint minimal, testable, and predictable.

**Business Rules**:
  - **Auto-Allocation**: Customers only select the vehicle, dealership, `ServiceType`, and desired time—they cannot manually pick a `ServiceBay` or `Technician` (the system auto-assigns them).
  - **Allocation Order**: When several technicians are qualified and available, prefer the one with less work: first the fewest vehicles assigned in the 3 days ending on the appointment date, then the one whose previous job before the desired start time ended longest ago. If still equal, use a fixed order. Service bays are always chosen in a fixed order.
  - **Confirm or Reject**: The booking is confirmed only if, for the entire service duration, at least one `ServiceBay` is free and at least one qualified `Technician` is free. Otherwise it is rejected with the reason: no free bay, no free qualified technician, or no technician with the required skill.
  - **Confirmation Response**: On success, the response returns the created `Appointment` with the assigned `ServiceBay` and `Technician`.
  - **One Service per Booking**: One booking covers exactly one service.
  - **No Overlapping Bookings per Vehicle**: A vehicle cannot have two bookings whose time intervals overlap, even at different dealerships. Example: if service A at dealership X runs 09:00–11:00, a booking for the same vehicle at dealership Y starting at 10:00 is rejected. Bookings at non-overlapping times are allowed.
  - **Overnight Consent**: If a booking ends on a later day than it starts, the request must state that the customer agrees to leave the vehicle overnight. Without that consent, the booking is rejected with this reason.

**MVP Boundary**:
  - **Next phase**: On vehicle arrival, the technician confirms the actual issue and adjusts the service time/duration; multi-service bookings (several services in one booking, back-to-back); suggesting the nearest available slot when a booking is rejected; customer cancels or reschedules; limiting the number of bookings per vehicle (anti-spam); per-technician shifts, lunch breaks, holidays; master data management (CRUD); notifications.
  - **Non-goals**: Authentication and authorization (caller identity is known); customer and vehicle registration (assumed to exist); payment and pricing; frontend and mobile; reporting and external integrations (DMS).

**Open Questions**:
  - Must the `ServiceBay` and `Technician` belong to the same `Dealership` as the appointment?
  - Is `endTime` derived server-side from the `ServiceType` duration, or supplied by the client?
  - Working hours are stated in ICT, but timestamps are stored in UTC — how are dealership hours and timezone handled?
  - Are bookings in the past rejected?
