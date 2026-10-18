window.COMPANIONS_MANIFEST = {
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
        "cell_width": 180,
        "cell_height": 140,
        "anchor_x": 90,
        "anchor_y": 110,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/bear/bear_walk.png",
        "directions": 8,
        "frames": 12,
        "cell_width": 180,
        "cell_height": 140,
        "anchor_x": 90,
        "anchor_y": 110,
        "fps": 14
      },
      "attack": {
        "file": "assets/companions/bear/bear_attack.png",
        "directions": 8,
        "frames": 19,
        "cell_width": 180,
        "cell_height": 140,
        "anchor_x": 90,
        "anchor_y": 110,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/bear/bear_death.png",
        "directions": 8,
        "frames": 18,
        "cell_width": 180,
        "cell_height": 140,
        "anchor_x": 90,
        "anchor_y": 110,
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
        "cell_width": 140,
        "cell_height": 100,
        "anchor_x": 70,
        "anchor_y": 75,
        "fps": 14
      },
      "walk": {
        "file": "assets/companions/wolf/wolf_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 100,
        "anchor_x": 70,
        "anchor_y": 75,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/wolf/wolf_run.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 100,
        "anchor_x": 70,
        "anchor_y": 75,
        "fps": 18
      },
      "attack": {
        "file": "assets/companions/wolf/wolf_attack.png",
        "directions": 8,
        "frames": 13,
        "cell_width": 140,
        "cell_height": 100,
        "anchor_x": 70,
        "anchor_y": 75,
        "fps": 16
      },
      "death": {
        "file": "assets/companions/wolf/wolf_death.png",
        "directions": 8,
        "frames": 12,
        "cell_width": 140,
        "cell_height": 100,
        "anchor_x": 70,
        "anchor_y": 75,
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
        "frames": 15,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/golem/golem_walk.png",
        "directions": 8,
        "frames": 15,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/golem_walk.png",
        "directions": 8,
        "frames": 15,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/golem_attack.png",
        "directions": 8,
        "frames": 15,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 18
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
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 10
      },
      "walk": {
        "file": "assets/companions/golem/iron_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/iron_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/iron_golem_attack.png",
        "directions": 8,
        "frames": 16,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 18
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
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 12
      },
      "walk": {
        "file": "assets/companions/golem/fire_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 14
      },
      "run": {
        "file": "assets/companions/golem/fire_golem_walk.png",
        "directions": 8,
        "frames": 8,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 16
      },
      "attack": {
        "file": "assets/companions/golem/fire_golem_attack.png",
        "directions": 8,
        "frames": 16,
        "cell_width": 140,
        "cell_height": 130,
        "anchor_x": 70,
        "anchor_y": 105,
        "fps": 18
      }
    }
  }
};
