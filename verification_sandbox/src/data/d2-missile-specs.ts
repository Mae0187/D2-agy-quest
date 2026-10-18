// d2-missile-specs.ts — 由 extract_missile_data.py 從官方 Missiles.txt 自動生成的強型別規格
import type { MissileSpec } from '../missile-types.js';

export const OFFICIAL_D2_SPECS: Record<string, MissileSpec> = {
  'fireball': {
  "id": "fireball",
  "calibrationId": "fireball",
  "blend": "additive",
  "motion": {
    "speed": 20,
    "accel": 0,
    "maxSpeed": 20
  },
  "lifetime": {
    "maxLifeTicks": 50,
    "rangePx": 1000
  },
  "collision": {
    "radiusPx": 22,
    "pierce": 0
  },
  "explosion": {
    "durationTicks": 6,
    "onHit": true,
    "onExpire": true,
    "spawnMissileId": null
  },
  "behavior": {
    "family": "F01"
  }
} as MissileSpec,
  'bonespirit': {
  "id": "bonespirit",
  "calibrationId": "bonespirit",
  "blend": "additive",
  "motion": {
    "speed": 12,
    "accel": 0,
    "maxSpeed": 12
  },
  "lifetime": {
    "maxLifeTicks": 128,
    "rangePx": 1536
  },
  "collision": {
    "radiusPx": 22,
    "pierce": 0
  },
  "explosion": {
    "durationTicks": 6,
    "onHit": true,
    "onExpire": true,
    "spawnMissileId": null
  },
  "behavior": {
    "family": "F02",
    "turnRateDegPerTick": 12,
    "acquireRadiusPx": 360,
    "reacquire": true,
    "fallback": "straight",
    "retargetEveryTicks": 5
  }
} as MissileSpec,
  'chargedbolt': {
  "id": "chargedbolt",
  "calibrationId": "chargedbolt",
  "blend": "additive",
  "motion": {
    "speed": 12,
    "accel": 0,
    "maxSpeed": 12
  },
  "lifetime": {
    "maxLifeTicks": 98,
    "rangePx": 1176
  },
  "collision": {
    "radiusPx": 22,
    "pierce": 1
  },
  "explosion": null,
  "behavior": {
    "family": "F04",
    "stepJitterDeg": 50,
    "retargetEveryTicks": 2
  }
} as MissileSpec,
  'guidedarrow': {
  "id": "guidedarrow",
  "calibrationId": "guidedarrow",
  "blend": "additive",
  "motion": {
    "speed": 24,
    "accel": 0,
    "maxSpeed": 24
  },
  "lifetime": {
    "maxLifeTicks": 128,
    "rangePx": 3072
  },
  "collision": {
    "radiusPx": 22,
    "pierce": 0
  },
  "explosion": null,
  "behavior": {
    "family": "F02",
    "turnRateDegPerTick": 12,
    "acquireRadiusPx": 360,
    "reacquire": true,
    "fallback": "straight",
    "retargetEveryTicks": 5
  }
} as MissileSpec,
  'frozenorb': {
  "id": "frozenorb",
  "calibrationId": "frozenorb",
  "blend": "additive",
  "motion": {
    "speed": 10,
    "accel": 0,
    "maxSpeed": 10
  },
  "lifetime": {
    "maxLifeTicks": 30,
    "rangePx": 300
  },
  "collision": {
    "radiusPx": 22,
    "pierce": 0
  },
  "explosion": null,
  "behavior": {
    "family": "F01"
  }
} as MissileSpec,
};
