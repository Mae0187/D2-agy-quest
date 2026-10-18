import { UniversalRuntimePlayer } from './runtime_player';
import fireManifestData from '../schemas/fire_skills_manifest.json';
import coldManifestData from '../schemas/cold_skills_manifest.json';
import lightningManifestData from '../schemas/lightning_skills_manifest.json';

export function startV2Demo() {
  const canvas = document.getElementById('demo-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const player = new UniversalRuntimePlayer(canvas);

  // 註冊所有火系標準 Manifest
  for (const skillKey of Object.keys(fireManifestData.skills)) {
    player.registerManifest((fireManifestData.skills as any)[skillKey]);
  }

  // 註冊所有冰系標準 Manifest
  for (const skillKey of Object.keys(coldManifestData.skills)) {
    player.registerManifest((coldManifestData.skills as any)[skillKey]);
  }

  // 註冊所有閃電系標準 Manifest
  for (const skillKey of Object.keys(lightningManifestData.skills)) {
    player.registerManifest((lightningManifestData.skills as any)[skillKey]);
  }


  let currentSkill = '47'; // 預設火球
  let debug = false;
  let isMouseDown = false;
  let mousePos = { x: 500, y: 340 };
  const playerPos = { x: 500, y: 340 };

  // 初始化真實 CharacterController (魔法使 Sorceress)
  let character: any = null;
  if (typeof (window as any).CharacterController !== 'undefined') {
    const isRuntimeSubdir = typeof window !== 'undefined' && window.location.pathname.includes('/runtime/');
    const assetPrefix = isRuntimeSubdir ? '../../' : '';
    character = new (window as any).CharacterController(
      `${assetPrefix}assets/characters/sorceress/manifest.json`,
      () => {
        console.log('[V2 Sandbox] CharacterController loaded: Sorceress');
        if ((window as any).onSandboxCharacterReady) {
          (window as any).onSandboxCharacterReady(character);
        }
      },
      'sorceress'
    );
    character.x = playerPos.x;
    character.y = playerPos.y;
    character.prevX = playerPos.x;
    character.prevY = playerPos.y;
    (window as any).__sandboxCharacter = character;

    // 施法觸發回調 (到達 Release Frame 時發射技能)
    character.onCastSkill = (skillType: string, sx: number, sy: number, tx: number, ty: number, dir: number) => {
      // 貼地環狀波 (Nova 48, Frost Nova 44) 與 雷暴 (57) 嚴格自腳底地面 playerPos.y 展開
      let ox = sx;
      let oy = sy;
      if (currentSkill === '48' || currentSkill === '44' || currentSkill === '57') {
        ox = playerPos.x;
        oy = playerPos.y;
      }
      player.castSkill(currentSkill, ox, oy, tx, ty);
    };
  }

  // 25Hz 物理循環
  let lastTime = performance.now();
  let accum = 0;
  const TICK_MS = 40;
  let inspectTickCounter = 0;

  function loop(now: number) {
    accum += (now - lastTime);
    lastTime = now;

    while (accum >= TICK_MS) {
      if (character && character.isLoaded) {
        character.fixedTick(TICK_MS);

        // 16 向自動巡檢循環 (每 ~440ms 自轉並施法一次)
        if ((window as any).__inspect16DirsActive) {
          inspectTickCounter++;
          if (inspectTickCounter >= 11) {
            inspectTickCounter = 0;
            const nextDir = (character.currentDir + 1) % 16;
            character.currentDir = nextDir;
            const rad = ((90 + nextDir * 22.5) % 360) * Math.PI / 180;
            const targetX = character.x + Math.cos(rad) * 160;
            const targetY = character.y + Math.sin(rad) * 80;
            character.triggerCast(targetX, targetY, currentSkill);
            if ((window as any).updateDirDisplay) {
              (window as any).updateDirDisplay(nextDir);
            }
          }
        }
      }

      player.tick(playerPos);

      // 無 CharacterController 時之兜底發射
      if (!character && isMouseDown && currentSkill === '41') {
        player.castSkill('41', playerPos.x, playerPos.y - 32, mousePos.x, mousePos.y);
      }
      accum -= TICK_MS;
    }

    player.render(debug, playerPos);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
  });

  // 操作綁定
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (character && character.isLoaded) {
      if (character.isChanneling) {
        character.updateChannelTarget(mousePos.x, mousePos.y);
      } else if (character.state === 'idle' && !(window as any).__inspect16DirsActive) {
        character.currentDir = character.directionController.getDirectionTowards(character.x, character.y, mousePos.x, mousePos.y, false);
        if ((window as any).updateDirDisplay) {
          (window as any).updateDirDisplay(character.currentDir);
        }
      }
    }
  });

  const getCastOriginY = (skillId: string) => {
    if (skillId === '48' || skillId === '44' || skillId === '57') {
      return playerPos.y;
    }
    return playerPos.y - 32;
  };

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const tx = e.clientX - rect.left;
    const ty = e.clientY - rect.top;
    mousePos = { x: tx, y: ty };

    if (character && character.isLoaded) {
      character.triggerCast(tx, ty, currentSkill);
    } else {
      player.castSkill(currentSkill, playerPos.x, getCastOriginY(currentSkill), tx, ty);
    }
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
    if (character && character.isLoaded) {
      character.stopChanneling();
    }
  });

  (window as any).castV2Skill = (id: string, tx: number, ty: number) => {
    currentSkill = id;
    if (character && character.isLoaded) {
      character.triggerCast(tx, ty, id);
    } else {
      player.castSkill(id, playerPos.x, getCastOriginY(id), tx, ty);
    }
  };
  (window as any).setV2Skill = (id: string) => { currentSkill = id; };
  (window as any).toggleV2Debug = () => { debug = !debug; };
  (window as any).setV2Debug = (val: boolean) => { debug = val; };
  (window as any).__v2Player = player;

  // 16 方向巡檢控制
  (window as any).toggle16DirInspection = () => {
    (window as any).__inspect16DirsActive = !(window as any).__inspect16DirsActive;
    return (window as any).__inspect16DirsActive;
  };
  (window as any).setInspectDirection = (dir: number) => {
    if (character) {
      character.currentDir = ((dir % 16) + 16) % 16;
      if ((window as any).updateDirDisplay) {
        (window as any).updateDirDisplay(character.currentDir);
      }
    }
  };
}

export function createDungeonV2Adapter(canvas: HTMLCanvasElement, director?: any) {
  const player = new UniversalRuntimePlayer(canvas);
  player.isDungeonMode = true;
  for (const skillKey of Object.keys(fireManifestData.skills)) {
    player.registerManifest((fireManifestData.skills as any)[skillKey]);
  }
  for (const skillKey of Object.keys(coldManifestData.skills)) {
    player.registerManifest((coldManifestData.skills as any)[skillKey]);
  }
  for (const skillKey of Object.keys(lightningManifestData.skills)) {
    player.registerManifest((lightningManifestData.skills as any)[skillKey]);
  }
  if (director && typeof director.addDamageNumber === 'function') {
    player.addDamageText = (x: number, y: number, text: string) => {
      const amount = parseInt(text.replace('-', '')) || 0;
      if (amount > 0) director.addDamageNumber(x, y, amount);
    };
  }
  return player;
}

if (typeof window !== 'undefined') {
  (window as any).UniversalRuntimePlayer = UniversalRuntimePlayer;
  (window as any).fireManifestData = fireManifestData;
  (window as any).coldManifestData = coldManifestData;
  (window as any).lightningManifestData = lightningManifestData;
  (window as any).createDungeonV2Adapter = createDungeonV2Adapter;

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('demo-canvas')) startV2Demo();
    });
  } else {
    if (document.getElementById('demo-canvas')) startV2Demo();
  }
}
