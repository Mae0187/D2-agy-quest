window.D2_COMPANIONS_MANIFEST = {
  "bear": {
    "name": "灰熊 (Grizzly Bear)",
    "type": "beast",
    "isCombat": true,
    "hp": 480,
    "damage": 45,
    "speed": 3.2,
    "range": 38,
    "collisionRadius": 28,
    "actions": {
      "idle": {
        "file": "assets/companions/bear/bear_idle.png",
        "directions": 8,
        "frames": 12,
        "cell_width": 138,
        "cell_height": 94,
        "anchor_x": 69,
        "anchor_y": 70,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/bear/bear_walk.png",
        "directions": 8,
        "frames": 12,
        "cell_width": 148,
        "cell_height": 111,
        "anchor_x": 74,
        "anchor_y": 80,
        "fps": 14
      },
      "attack": {
        "file": "assets/companions/bear/bear_attack.png",
        "directions": 8,
        "frames": 13,
        "cell_width": 189,
        "cell_height": 132,
        "anchor_x": 93,
        "anchor_y": 90,
        "fps": 11
      },
      "death": {
        "file": "assets/companions/bear/bear_death.png",
        "directions": 8,
        "frames": 18,
        "cell_width": 128,
        "cell_height": 90,
        "anchor_x": 64,
        "anchor_y": 66,
        "fps": 14
      }
    }
  },
  "wolf": {
    "name": "狂狼 (Dire Wolf)",
    "type": "beast",
    "isCombat": true,
    "hp": 240,
    "damage": 30,
    "speed": 4.5,
    "range": 32,
    "collisionRadius": 18,
    "actions": {
      "idle": {
        "file": "assets/companions/wolf/wolf_idle.png",
        "directions": 8,
        "frames": 20,
        "cell_width": 86,
        "cell_height": 71,
        "anchor_x": 43,
        "anchor_y": 55,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/wolf/wolf_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 88,
        "cell_height": 72,
        "anchor_x": 44,
        "anchor_y": 54,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/wolf/wolf_run.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 89,
        "cell_height": 74,
        "anchor_x": 44,
        "anchor_y": 56,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/wolf/wolf_attack.png",
        "directions": 8,
        "frames": 13,
        "cell_width": 112,
        "cell_height": 84,
        "anchor_x": 55,
        "anchor_y": 54,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/wolf/wolf_death.png",
        "directions": 8,
        "frames": 12,
        "cell_width": 94,
        "cell_height": 59,
        "anchor_x": 47,
        "anchor_y": 41,
        "fps": 14
      }
    }
  },
  "raven": {
    "name": "寵物烏鴉 (Raven)",
    "type": "flying",
    "isCombat": true,
    "hp": 180,
    "damage": 18,
    "speed": 5.2,
    "range": 30,
    "collisionRadius": 14,
    "actions": {
      "idle": {
        "file": "assets/companions/raven/raven_fly.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 48,
        "cell_height": 48,
        "anchor_x": 24,
        "anchor_y": 24,
        "fps": 14
      },
      "walk": {
        "file": "assets/companions/raven/raven_fly.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 48,
        "cell_height": 48,
        "anchor_x": 24,
        "anchor_y": 24,
        "fps": 16
      },
      "run": {
        "file": "assets/companions/raven/raven_fly.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 48,
        "cell_height": 48,
        "anchor_x": 24,
        "anchor_y": 24,
        "fps": 20
      },
      "attack": {
        "file": "assets/companions/raven/raven_fly.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 48,
        "cell_height": 48,
        "anchor_x": 24,
        "anchor_y": 24,
        "fps": 22
      }
    }
  },
  "oak_sage": {
    "name": "自然之靈 (Oak Sage)",
    "type": "spirit",
    "isCombat": false,
    "hp": 200,
    "damage": 0,
    "speed": 2.0,
    "orbitRadius": 50,
    "collisionRadius": 15,
    "actions": {
      "idle": {
        "file": "assets/companions/oak_sage/oak_sage.png",
        "directions": 1,
        "frames": 11,
        "cell_width": 128,
        "cell_height": 128,
        "anchor_x": 64,
        "anchor_y": 64,
        "fps": 12
      }
    }
  },
  "skeleton_minion": {
    "name": "骷髏僕從 (Skeleton Minion)",
    "type": "undead",
    "isCombat": true,
    "hp": 220,
    "damage": 26,
    "speed": 3.2,
    "range": 32,
    "collisionRadius": 18,
    "actions": {
      "idle": {
        "file": "assets/monsters/skeleton_idle.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 120,
        "anchor_x": 70,
        "anchor_y": 95,
        "fps": 12
      },
      "walk": {
        "file": "assets/monsters/skeleton_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 120,
        "anchor_x": 70,
        "anchor_y": 95,
        "fps": 14
      },
      "run": {
        "file": "assets/monsters/skeleton_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 120,
        "anchor_x": 70,
        "anchor_y": 95,
        "fps": 16
      },
      "attack": {
        "file": "assets/monsters/skeleton_attack.png",
        "directions": 8,
        "frames": 16,
        "cell_width": 140,
        "cell_height": 120,
        "anchor_x": 70,
        "anchor_y": 95,
        "fps": 18
      },
      "death": {
        "file": "assets/monsters/skeleton_death.png",
        "directions": 8,
        "frames": 19,
        "cell_width": 140,
        "cell_height": 120,
        "anchor_x": 70,
        "anchor_y": 95,
        "fps": 15
      }
    }
  },
  "golem": {
    "name": "黏土石魔 (Clay Golem)",
    "type": "construct",
    "isCombat": true,
    "hp": 520,
    "damage": 38,
    "speed": 2.6,
    "range": 36,
    "collisionRadius": 24,
    "actions": {
      "idle": {
        "file": "assets/companions/golem/golem_idle.png",
        "directions": 8,
        "frames": 4,
        "cell_width": 60,
        "cell_height": 77,
        "anchor_x": 30,
        "anchor_y": 62,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/golem/golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 71,
        "cell_height": 82,
        "anchor_x": 36,
        "anchor_y": 61,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/golem_run.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 71,
        "cell_height": 82,
        "anchor_x": 36,
        "anchor_y": 61,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/golem_attack.png",
        "directions": 8,
        "frames": 16,
        "cell_width": 105,
        "cell_height": 101,
        "anchor_x": 53,
        "anchor_y": 80,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/golem/golem_death.png",
        "directions": 1,
        "frames": 16,
        "cell_width": 113,
        "cell_height": 91,
        "anchor_x": 54,
        "anchor_y": 56,
        "fps": 14
      }
    }
  },
  "iron_golem": {
    "name": "鋼鐵魔像 (Iron Golem)",
    "type": "construct",
    "isCombat": true,
    "hp": 580,
    "damage": 46,
    "speed": 2.8,
    "range": 36,
    "collisionRadius": 24,
    "actions": {
      "idle": {
        "file": "assets/companions/golem/iron_golem_idle.png",
        "directions": 8,
        "frames": 4,
        "cell_width": 83,
        "cell_height": 86,
        "anchor_x": 42,
        "anchor_y": 72,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/golem/iron_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 82,
        "cell_height": 94,
        "anchor_x": 41,
        "anchor_y": 74,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/iron_golem_run.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 82,
        "cell_height": 94,
        "anchor_x": 41,
        "anchor_y": 74,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/iron_golem_attack.png",
        "directions": 8,
        "frames": 16,
        "cell_width": 128,
        "cell_height": 121,
        "anchor_x": 63,
        "anchor_y": 96,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/golem/iron_golem_death.png",
        "directions": 1,
        "frames": 20,
        "cell_width": 77,
        "cell_height": 101,
        "anchor_x": 52,
        "anchor_y": 72,
        "fps": 14
      }
    }
  },
  "fire_golem": {
    "name": "火焰魔像 (Fire Golem)",
    "type": "construct",
    "isCombat": true,
    "hp": 550,
    "damage": 44,
    "speed": 2.7,
    "range": 36,
    "collisionRadius": 24,
    "actions": {
      "idle": {
        "file": "assets/companions/golem/fire_golem_idle.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 64,
        "cell_height": 99,
        "anchor_x": 32,
        "anchor_y": 82,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/golem/fire_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 81,
        "cell_height": 105,
        "anchor_x": 40,
        "anchor_y": 82,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/fire_golem_run.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 81,
        "cell_height": 105,
        "anchor_x": 40,
        "anchor_y": 82,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/fire_golem_attack.png",
        "directions": 8,
        "frames": 17,
        "cell_width": 142,
        "cell_height": 113,
        "anchor_x": 71,
        "anchor_y": 81,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/golem/fire_golem_death.png",
        "directions": 1,
        "frames": 19,
        "cell_width": 229,
        "cell_height": 233,
        "anchor_x": 122,
        "anchor_y": 191,
        "fps": 14
      }
    }
  }
};
