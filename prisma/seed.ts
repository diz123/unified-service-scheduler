import 'dotenv/config';
import { PrismaClient } from '../src/shared/infrastructure/database/generated/client';
import { createPrismaClient } from '../src/shared/infrastructure/database/prisma-client.factory';

/**
 * Sample master data (DESIGN.md Target Deliverables): dealerships, service bays, technicians with skills and
 * service types only. Customers, vehicles and appointments are created through booking.
 * Ids are fixed so the README and demos can refer to them. Each dealership has one service type whose skill no
 * technician there holds, so booking it returns 422 NO_QUALIFIED_TECHNICIAN.
 */
export const SEED_IDS = {
  dealerships: {
    benThanh: '00000000-0000-4000-8000-000000000001',
    thuDuc: '00000000-0000-4000-8000-000000000002',
    phuMyHung: '00000000-0000-4000-8000-000000000003',
    tanBinh: '00000000-0000-4000-8000-000000000004',
    goVap: '00000000-0000-4000-8000-000000000005',
  },
  serviceTypes: {
    benThanhOilChange: '00000000-0000-4000-8000-000000000101',
    benThanhBrakeInspection: '00000000-0000-4000-8000-000000000102',
    /** Uncovered: no Ben Thanh technician holds EV Charging. */
    benThanhEvBatteryCheck: '00000000-0000-4000-8000-000000000103',
    thuDucOilChange: '00000000-0000-4000-8000-000000000201',
    thuDucEvBatteryCheck: '00000000-0000-4000-8000-000000000202',
    /** Uncovered: no Thu Duc technician holds Brakes & Suspension. */
    thuDucBrakeInspection: '00000000-0000-4000-8000-000000000203',
    phuMyHungOilChange: '00000000-0000-4000-8000-000000000301',
    phuMyHungTireRotation: '00000000-0000-4000-8000-000000000302',
    phuMyHungAcService: '00000000-0000-4000-8000-000000000303',
    phuMyHungFullInspection: '00000000-0000-4000-8000-000000000304',
    /** Uncovered: no Phu My Hung technician holds Transmission. */
    phuMyHungTransmissionRepair: '00000000-0000-4000-8000-000000000305',
    tanBinhOilChange: '00000000-0000-4000-8000-000000000401',
    tanBinhFullInspection: '00000000-0000-4000-8000-000000000402',
    /** Uncovered: no Tan Binh technician holds Paint. */
    tanBinhBodyPaint: '00000000-0000-4000-8000-000000000403',
    goVapEvBatteryCheck: '00000000-0000-4000-8000-000000000501',
    goVapEvSoftwareUpdate: '00000000-0000-4000-8000-000000000502',
    /** Uncovered: no Go Vap technician holds Brakes & Suspension. */
    goVapBrakeInspection: '00000000-0000-4000-8000-000000000503',
  },
} as const;

interface DealershipSeed {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  idPrefix: string;
  bays: number;
  serviceTypes: { id: string; name: string; requiredSkill: string; durationMinutes: number }[];
  /** One entry per technician, in name order (`Tech 01`, `Tech 02`, …). */
  technicianSkills: string[][];
}

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const ids = SEED_IDS.serviceTypes;

/** Round 6b data (docs/drafts/book-appointment-test-cases.md); the first four entries of Ben Thanh and Thu Duc are the Round 6 rows. */
const DEALERSHIPS: DealershipSeed[] = [
  {
    id: SEED_IDS.dealerships.benThanh,
    name: 'Ben Thanh Service Center',
    openTime: '08:00',
    closeTime: '17:00',
    idPrefix: '00000000-0000-4000-8000-0000000010',
    bays: 4,
    serviceTypes: [
      { id: ids.benThanhOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      { id: ids.benThanhBrakeInspection, name: 'Brake inspection', requiredSkill: 'Brakes & Suspension', durationMinutes: 90 },
      { id: ids.benThanhEvBatteryCheck, name: 'EV battery check', requiredSkill: 'EV Charging', durationMinutes: 120 },
    ],
    technicianSkills: [
      ['Maintenance', 'Brakes & Suspension'],
      ['Maintenance'],
      ['Electrical'],
      ['Maintenance', 'Electrical'],
      ['Maintenance'],
      ['Maintenance', 'Electrical'],
    ],
  },
  {
    id: SEED_IDS.dealerships.thuDuc,
    name: 'Thu Duc Service Center',
    openTime: '07:30',
    closeTime: '19:00',
    idPrefix: '00000000-0000-4000-8000-0000000020',
    bays: 5,
    serviceTypes: [
      { id: ids.thuDucOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      { id: ids.thuDucEvBatteryCheck, name: 'EV battery check', requiredSkill: 'EV Charging', durationMinutes: 120 },
      { id: ids.thuDucBrakeInspection, name: 'Brake inspection', requiredSkill: 'Brakes & Suspension', durationMinutes: 90 },
    ],
    technicianSkills: [
      ['Maintenance'],
      ['Maintenance', 'Overhaul'],
      ['Electrical', 'EV Charging'],
      ['Maintenance', 'Electrical'],
      ['Maintenance'],
      ['Maintenance', 'Electrical'],
      ['Maintenance'],
      ['Maintenance', 'Overhaul'],
    ],
  },
  {
    id: SEED_IDS.dealerships.phuMyHung,
    name: 'Phu My Hung Service Center',
    openTime: '08:00',
    closeTime: '17:30',
    idPrefix: '00000000-0000-4000-8000-0000000030',
    bays: 8,
    serviceTypes: [
      { id: ids.phuMyHungOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      { id: ids.phuMyHungTireRotation, name: 'Tire rotation', requiredSkill: 'Tires', durationMinutes: 45 },
      { id: ids.phuMyHungAcService, name: 'AC service', requiredSkill: 'Air Conditioning', durationMinutes: 120 },
      { id: ids.phuMyHungFullInspection, name: 'Full inspection', requiredSkill: 'Inspection', durationMinutes: 240 },
      { id: ids.phuMyHungTransmissionRepair, name: 'Transmission repair', requiredSkill: 'Transmission', durationMinutes: 180 },
    ],
    technicianSkills: [
      ['Maintenance', 'Tires'],
      ['Maintenance'],
      ['Tires'],
      ['Air Conditioning'],
      ['Air Conditioning', 'Electrical'],
      ['Inspection'],
      ['Inspection', 'Maintenance'],
      ['Maintenance', 'Tires'],
      ['Air Conditioning'],
      ['Inspection'],
      ['Maintenance'],
      ['Tires', 'Air Conditioning'],
      ['Electrical'],
      ['Maintenance', 'Inspection'],
    ],
  },
  {
    id: SEED_IDS.dealerships.tanBinh,
    name: 'Tan Binh Service Center',
    openTime: '07:00',
    closeTime: '12:00',
    idPrefix: '00000000-0000-4000-8000-0000000040',
    bays: 4,
    serviceTypes: [
      { id: ids.tanBinhOilChange, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
      { id: ids.tanBinhFullInspection, name: 'Full inspection', requiredSkill: 'Inspection', durationMinutes: 240 },
      { id: ids.tanBinhBodyPaint, name: 'Body paint', requiredSkill: 'Paint', durationMinutes: 300 },
    ],
    technicianSkills: [
      ['Maintenance'],
      ['Maintenance', 'Inspection'],
      ['Inspection'],
      ['Maintenance'],
      ['Electrical'],
      ['Maintenance', 'Inspection'],
    ],
  },
  {
    id: SEED_IDS.dealerships.goVap,
    name: 'Go Vap EV Center',
    openTime: '09:00',
    closeTime: '18:00',
    idPrefix: '00000000-0000-4000-8000-0000000050',
    bays: 6,
    serviceTypes: [
      { id: ids.goVapEvBatteryCheck, name: 'EV battery check', requiredSkill: 'EV Charging', durationMinutes: 120 },
      { id: ids.goVapEvSoftwareUpdate, name: 'EV software update', requiredSkill: 'Electrical', durationMinutes: 60 },
      { id: ids.goVapBrakeInspection, name: 'Brake inspection', requiredSkill: 'Brakes & Suspension', durationMinutes: 90 },
    ],
    technicianSkills: [['EV Charging', 'Electrical'], ['Electrical'], ['Electrical', 'Maintenance'], ['Maintenance']],
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

      for (let i = 1; i <= d.bays; i += 1) {
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
