export interface LoyaltySettings {
  enabled: boolean;
  pointsPerUnit: number; // points per currency unit spent (e.g., 1 point per $1)
  redemptionRate: number; // currency value per point (e.g., 0.10 = 10 points = $1)
  minimumRedemption: number; // min points to redeem (e.g., 100)
  tiers: {
    silver: number; // lifetime points threshold
    gold: number;
    platinum: number;
  };
  tierMultipliers: {
    bronze: number; // 1.0
    silver: number; // 1.25
    gold: number; // 1.5
    platinum: number; // 2.0
  };
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  pointsPerUnit: 1,
  redemptionRate: 0.1,
  minimumRedemption: 100,
  tiers: {
    silver: 500,
    gold: 2000,
    platinum: 5000,
  },
  tierMultipliers: {
    bronze: 1.0,
    silver: 1.25,
    gold: 1.5,
    platinum: 2.0,
  },
};
