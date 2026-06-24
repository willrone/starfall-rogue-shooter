# Character / Weapon Layering Plan

The player character is authored as a **body-only 8-direction sprite set**. Weapons are separate replaceable sprites/icons so equipment can swap without regenerating the character.

## Character body strips

All body strips are 6 frames, 160×160 per frame:

- `player_survivor_idle.png` — front idle preview/default
- `player_survivor_run_south.png`
- `player_survivor_run_south_east.png`
- `player_survivor_run_east.png`
- `player_survivor_run_north_east.png`
- `player_survivor_run_north.png`
- `player_survivor_run_north_west.png`
- `player_survivor_run_west.png`
- `player_survivor_run_south_west.png`

`player_survivor_run.png` is currently an alias copy of `player_survivor_run_south.png` for compatibility with older code.

## Direction order for code

```ts
const PLAYER_DIRECTIONS = [
  'south', 'south_east', 'east', 'north_east',
  'north', 'north_west', 'west', 'south_west',
];
```

Pick the direction by quantizing the movement vector angle into 8 sectors.

## Weapon replacement model

- Character body sprites should not include weapons.
- Weapon equipment uses separate art under `assets/resources/art/weapons/`.
- Runtime can overlay a weapon child node above or below the character depending on direction:
  - south/south-east/south-west/east/west: weapon usually above body.
  - north/north-east/north-west: weapon can render behind/partly behind body.
- For the first playable integration, weapon icons can be used in UI only while bullets/projectiles show weapon type in combat.
- Later, generate `weapon_<id>_held_<direction>.png` if visible held-weapon overlays are needed.
