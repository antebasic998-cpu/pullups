import type { DbData } from './db';
import { DEFAULT_CATEGORY } from './db';

export function buildSeedData(): DbData {
  return {
    categories: [
      DEFAULT_CATEGORY,
      {
        id: '98ec7d39-d9cc-4ebf-9d6c-eac15dfc4f54',
        slug: 'chin-ups',
        name: 'Chin-ups',
        shortName: null,
        description: '',
        iconKey: 'chin-up',
        unit: 'reps',
        scoreType: 'bodyweight_normalized',
        normalizationType: 'bodyweight_power',
        normalizationExponent: 0.67,
        isActive: true,
        displayOrder: 2,
        createdAt: '2026-09-22T11:24:55.207Z',
        updatedAt: '2026-09-22T11:24:55.207Z',
      },
    ],
    users: [
      {
        id: 'b103d3fa-dadd-4b2b-b14e-53b3ccd10a48',
        name: 'Ante Bašić',
        age: 27,
        weightKg: 77.5,
        note: '',
        createdAt: '2026-09-15T07:58:11.065Z',
        updatedAt: '2026-09-15T07:58:11.065Z',
      },
      {
        id: '0fcc003b-b1e2-4ce1-b22c-7538e54c71f9',
        name: 'Domagoj Fabek',
        age: 29,
        weightKg: 67,
        note: '',
        createdAt: '2026-09-15T07:58:51.992Z',
        updatedAt: '2026-09-15T07:58:51.992Z',
      },
      {
        id: '4e520255-b5f5-4002-a6a2-2df71c20a2a9',
        name: 'Tin Ogrizek',
        age: 23,
        weightKg: 98,
        note: '',
        createdAt: '2026-09-15T07:59:27.722Z',
        updatedAt: '2026-09-15T07:59:27.722Z',
      },
      {
        id: 'e10faa26-f4d4-4a7a-901c-18b0f3100968',
        name: 'Leon Knežević',
        age: 23,
        weightKg: 75,
        note: '',
        createdAt: '2026-09-15T07:59:41.434Z',
        updatedAt: '2026-09-15T07:59:41.434Z',
      },
      {
        id: '21dd12c9-1de7-497b-9898-0ce2c013c756',
        name: 'Vedran Kapetanić',
        age: 29,
        weightKg: 93,
        note: '',
        createdAt: '2026-09-15T08:02:00.363Z',
        updatedAt: '2026-09-15T08:02:00.363Z',
      },
    ],
    sessions: [],
  };
}
