// =======================================================================
// Diablo II 通用動畫實體抽象介面 (Common Entity Interfaces)
// =======================================================================

export interface ManifestLayer {
  layerId: string;
  role: string;
  atlasFile: string;
  cellW: number;
  cellH: number;
  pivotX: number;
  pivotY: number;
  frames: number;
  dirs: number;
  blendMode?: 'normal' | 'lighter';
  alpha?: number;
  preDraw?: number;
  anchor?: 'center' | 'bottom';
}

export interface SkillManifestData {
  skillId: string;
  name: string;
  category: 'fire' | 'cold' | 'lightning' | 'magic' | 'poison' | 'physical' | string;
  template: 'linear_missile' | 'continuous_stream' | 'ground_hazard' | 'timed_multistage' | 'composite_minion' | 'radial_wave' | 'area_barrage' | 'carrier_orb' | 'erratic_wave' | 'chain_lightning' | 'periodic_strike' | string;
  timing: {
    stepHz: number;
    tickMs: number;
    durationTicks?: number;
    releaseFrame?: number;
    stages?: Record<string, any>;
  };
  parameters: Record<string, any>;
  direction?: {
    count: number;
    preset?: string;
  };
  layers: ManifestLayer[];
}

export interface TargetDummy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitTime: number;
  chillUntil?: number;
  chilledTimer?: number;
  isDead?: boolean;
  remove?: boolean;
  vx?: number;
  vy?: number;
  takeDamage?(amount: number): void;
}
