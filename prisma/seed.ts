import 'dotenv/config';
import { PrismaClient } from '../src/shared/infrastructure/database/generated/client';
import { createPrismaClient } from '../src/shared/infrastructure/database/prisma-client.factory';

/**
 * Sample master data (DESIGN.md Target Deliverables): dealerships, service bays, technicians with skills and
 * service types only. Customers, vehicles and appointments are created through booking.
 * Ids are fixed so the README and demos can refer to them.
 */
export const SEED_IDS = {
  dealerships: {
    benThanh: '00000000-0000-4000-8000-000000000001',
    thuDuc: '00000000-0000-4000-8000-000000000002',
  },
  serviceTypes: {
    benThanhOilChange: '00000000-0000-4000-8000-000000000101',
    benThanhBrakeInspection: '00000000-0000-4000-8000-000000000102',
    /** Requires EV Charging, which no Ben Thanh technician holds: books → 422 NO_QUALIFIED_TECHNICIAN. */
    benThanhEvBatteryCheck: '00000000-0000-4000-8000-000000000103',
    thuDucOilChange: '00000000-0000-4000-8000-000000000201',
    thuDucEvBatteryCheck: '00000000-0000-4000-8000-000000000202',
    /** Requires Brakes & Suspension, which no Thu Duc technician holds: books → 422 NO_QUALIFIED_TECHNICIAN. */
    thuDucBrakeInspection: '00000000-0000-4000-8000-000000000203',
  },
} as const;

interface DealershipSeed {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  idPrefix: string;
  serviceTypes: { id: string; name: string; requiredSkill: string; durationMinutes: number }[];
  technicianSkills: string[][];
}

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const BAYS_PER_DEALERSHIP = 3;

const DEALERSHIPS: DealershipSeed[] = [
  {
    id: SEED_IDS.dealerships.benThanh,
    name: 'Ben Thanh Service Center',
    openTime: '08:00',
    closeTime: '17:00',
    idPrefix: '00000000-0000-4000-8000-0000000010',
    serviceTypes: [
      { id: SEED_IDS.serviceTypes.benThanhOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      {
        id: SEED_IDS.serviceTypes.benThanhBrakeInspection,
        name: 'Brake inspection',
        requiredSkill: 'Brakes & Suspension',
        durationMinutes: 90,
      },
      {
        id: SEED_IDS.serviceTypes.benThanhEvBatteryCheck,
        name: 'EV battery check',
        requiredSkill: 'EV Charging',
        durationMinutes: 120,
      },
    ],
    technicianSkills: [['Maintenance', 'Brakes & Suspension'], ['Maintenance'], ['Electrical'], ['Maintenance', 'Electrical']],
  },
  {
    id: SEED_IDS.dealerships.thuDuc,
    name: 'Thu Duc Service Center',
    openTime: '07:30',
    closeTime: '19:00',
    idPrefix: '00000000-0000-4000-8000-0000000020',
    serviceTypes: [
      { id: SEED_IDS.serviceTypes.thuDucOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      {
        id: SEED_IDS.serviceTypes.thuDucEvBatteryCheck,
        name: 'EV battery check',
        requiredSkill: 'EV Charging',
        durationMinutes: 120,
      },
      {
        id: SEED_IDS.serviceTypes.thuDucBrakeInspection,
        name: 'Brake inspection',
        requiredSkill: 'Brakes & Suspension',
        durationMinutes: 90,
      },
    ],
    technicianSkills: [['Maintenance'], ['Maintenance', 'Overhaul'], ['Electrical', 'EV Charging'], ['Maintenance', 'Electrical']],
  },
];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Upserts the master data by fixed id, so re-running changes nothing and never touches bookings. */
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const d of DEALERSHIPS) {
      const dealership = { name: d.name, openTime: d.openTime, closeTime: d.closeTime, timezone: TIMEZONE };
      await tx.dealership.upsert({ where: { id: d.id }, create: { id: d.id, ...dealership }, update: dealership });

      for (const s of d.serviceTypes) {
        const serviceType = {
          dealershipId: d.id,
          name: s.name,
          requiredSkill: s.requiredSkill,
          durationMinutes: s.durationMinutes,
        };
        await tx.serviceType.upsert({ where: { id: s.id }, create: { id: s.id, ...serviceType }, update: serviceType });
      }

      for (let i = 1; i <= BAYS_PER_DEALERSHIP; i += 1) {
        const id = `${d.idPrefix}${pad(i)}`;
        const bay = { dealershipId: d.id, name: `Bay ${pad(i)}` };
        await tx.serviceBay.upsert({ where: { id }, create: { id, ...bay }, update: bay });
      }

      for (const [index, skills] of d.technicianSkills.entries()) {
        const id = `${d.idPrefix}${pad(50 + index + 1)}`;
        const technician = { dealershipId: d.id, name: `Tech ${pad(index + 1)}`, skills };
        await tx.technician.upsert({ where: { id }, create: { id, ...technician }, update: technician });
      }
    }
  });
}

if (require.main === module) {
  const prisma = createPrismaClient();
  seed(prisma)
    .then(() => console.log('Seed complete'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
