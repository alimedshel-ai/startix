// Saudi penalty database. Maximum exposure used by the compliance engine to
// estimate financial risk when an axis falls into a danger zone. Values are
// the upper-bound aggregate from plan §5.3 ("Saudi Penalties Database").

import type { EntitySize } from '@prisma/client';

export const MAX_PENALTY_BY_SIZE: Record<EntitySize, number> = {
  MICRO: 53_000,
  SMALL: 260_000,
  MEDIUM: 700_000,
  LARGE: 1_740_000,
};

export const PENALTY_CURRENCY = 'SAR';

// Per-axis share of total exposure (sums to 1.0). Lets the engine attribute
// the estimated penalty across the lowest-scoring axes.
export const PENALTY_AXIS_WEIGHT: Record<string, number> = {
  commercial:          0.10,
  tax_zakat:           0.20,
  labor_saudization:   0.20,
  data_privacy:        0.10,
  cybersecurity:       0.10,
  corporate_gov:       0.10,
  aml_kyc:             0.10,
  consumer_protection: 0.10,
};

export function maxPenaltyFor(size: EntitySize): number {
  return MAX_PENALTY_BY_SIZE[size];
}
