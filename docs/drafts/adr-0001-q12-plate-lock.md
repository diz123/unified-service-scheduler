# ADR-0001 Amendment Draft — Plate Lock for New Vehicles (Q12)

Status: draft for engineer review. Not applied to `docs/adr/0001-tech-stack.md`.

Problem: Layer 1 locks the Vehicle row with `SELECT … FOR UPDATE`. For a new plate that row does not exist yet, so two concurrent first bookings with the same plate lock nothing and race on the vehicle insert. DESIGN.md (Customer and vehicle resolution) requires them to behave as if run one after the other and never return 500.

Chosen option: transaction-scoped advisory lock keyed on the normalized plate, replacing the Vehicle row lock as the first lock.

Rejected options: `INSERT … ON CONFLICT DO NOTHING` then `SELECT … FOR UPDATE` (insert sequencing for customer + vehicle is error-prone under Q14); catch 23505 and retry (adds the retry complexity ADR-0001 avoided).

Amendment approach: edit ADR-0001 in place with an "Amended" note, since ADR-0002 is reserved for the frontend stack. Alternative: a new ADR that supersedes only the Layer 1 section.

## Proposed replacements

### Line 31 — Layer 1

```
- **Layer 1 — Application-level serialisation under contention**: An interactive transaction at READ COMMITTED acquires two locks in a fixed order before running resolution, availability, and allocation queries: first a transaction-scoped advisory lock on the normalized license plate (`pg_advisory_xact_lock(<bigint key>)`, where the key is a stable 64-bit hash of the normalized plate computed in the infrastructure adapter), then the Dealership row via `SELECT … FOR UPDATE`. The plate lock works whether or not the vehicle row exists yet, so concurrent first bookings for the same new plate run one after the other: the second sees the committed customer and vehicle, or nothing if the first rolled back. READ COMMITTED re-snapshots on each statement, so the queries see all bookings committed by any concurrent transaction that holds or just released the same locks. Fixed lock order prevents deadlocks (see lock-order reasoning below). The unique constraint on the normalized `licensePlate` stays as a backstop; a 23505 on it indicates a Layer 1 bug.
```

### Lines 35–39 — Lock-order deadlock proof

```
**Lock-order deadlock proof (Challenge A)**: Each booking transaction acquires exactly one plate advisory lock, then exactly one Dealership row lock — always in that order. Both are released at commit or rollback.

- Same plate (new or existing), different dealerships: both transactions compete for the same plate lock. One proceeds; the other blocks. No second lock is acquired until the first is released. No cycle possible.
- Different plates, same dealership: both transactions acquire their respective plate locks immediately (no contention), then compete for the same Dealership lock. One proceeds; the other blocks. No cycle possible.
- Hash collision between two different plates: those transactions are serialised as if they shared a plate. This costs throughput only, never correctness, and cannot create a cycle because the order is unchanged.
- Deadlock requires two transactions holding a lock the other needs, acquired in opposite order. The fixed plate → Dealership order rules this out in all cases.
```

### Line 107 — Consequences

```
- Fixed lock order (plate advisory lock → Dealership row) eliminates the deadlock class described in Challenge A without optimistic-retry complexity, and covers vehicles that do not exist yet.
```

### Amended note (top of ADR, under Status)

```
**Amended**: 2026-10-17 — Layer 1 first lock changed from the Vehicle row to a plate advisory lock, so concurrent first bookings for the same new plate are serialised (DESIGN.md, Customer and vehicle resolution).
```

## Tests that cover this

`docs/drafts/book-appointment-test-cases.md`: T3.10 (same existing vehicle, two dealerships, no deadlock), T3.11–T3.13 (same new plate in parallel), T3.14 (rejected booking creates nothing).
