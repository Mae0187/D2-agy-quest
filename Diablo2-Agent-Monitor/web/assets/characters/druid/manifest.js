window.DRUID_MANIFEST = {
  "character": "druid",
  "armor_tier": "light",
  "description": "Diablo II Druid (Light Armor) 16-direction action sprite set",
  "directions_order": [
    "South",
    "South-Southeast",
    "Southeast",
    "East-Southeast",
    "East",
    "East-Northeast",
    "Northeast",
    "North-Northeast",
    "North",
    "North-Northwest",
    "Northwest",
    "West-Northwest",
    "West",
    "West-Southwest",
    "Southwest",
    "South-Southwest"
  ],
  "actions": {
    "idle": {
      "name": "idle",
      "file": "druid_idle.png",
      "directions": 16,
      "frames": 6,
      "cell_width": 74,
      "cell_height": 85,
      "anchor_x": 37,
      "anchor_y": 73,
      "fps": 12,
      "loop": true
    },
    "walk": {
      "name": "walk",
      "file": "druid_walk.png",
      "directions": 16,
      "frames": 8,
      "cell_width": 84,
      "cell_height": 88,
      "anchor_x": 42,
      "anchor_y": 74,
      "fps": 14,
      "loop": true
    },
    "run": {
      "name": "run",
      "file": "druid_run.png",
      "directions": 16,
      "frames": 8,
      "cell_width": 100,
      "cell_height": 91,
      "anchor_x": 50,
      "anchor_y": 77,
      "fps": 18,
      "loop": true
    },
    "attack": {
      "name": "attack",
      "file": "druid_attack.png",
      "directions": 16,
      "frames": 19,
      "cell_width": 162,
      "cell_height": 92,
      "anchor_x": 81,
      "anchor_y": 74,
      "fps": 20,
      "loop": false
    },
    "cast": {
      "name": "cast",
      "file": "druid_cast.png",
      "directions": 16,
      "frames": 15,
      "cell_width": 89,
      "cell_height": 113,
      "anchor_x": 45,
      "anchor_y": 101,
      "fps": 16,
      "loop": false
    }
  }
};
