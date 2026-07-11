# Modular Character + Weapon Art Notes

This folder contains corrected YUZ-generated candidate art for the current starter weapon concept:
`storm-rifle` is a legacy code id, but the in-game weapon is the overheat SMG (`冲锋枪`, mechanic `overheat`).

## Why this replaces the previous rifle direction

The earlier YUZ candidate treated `storm-rifle` as a long rifle. That is not the current design.
The starter weapon should read as a compact short-range SMG with heat vents, orange overheat coils,
and a fast-fire silhouette.

## Runtime composition direction

Use separate layers instead of baking the weapon into the player sprite:

- `PlayerBody`: body-only idle/run strips, no visible weapon.
- `WeaponNode`: right-facing weapon sprite rotated toward aim.
- `MuzzleNode`: derived from weapon metadata for bullets, muzzle flash, and overheat glow.
- Optional `Torso/Arms` layer later if we want more precise aim poses.

The processed candidate assets are under `processed/`.

## Current candidate files

- `processed/player_body_no_weapon_idle_yuz_v1_480x80.png`
  Body-only player idle strip, 6 frames, runtime-sized.
- `processed/overheat_smg_icon_yuz_v1_128x128.png`
  Inventory/shop icon candidate for the overheat SMG.
- `processed/overheat_smg_handheld_yuz_v1_84x56.png`
  Runtime hand-held weapon overlay candidate.
- `processed/weapon_mount_spec_yuz_v1.json`
  Candidate grip, muzzle, body anchor, and overheat glow metadata.
- `processed/modular_character_weapon_preview_yuz_v1.png`
  Rough visual preview of body + weapon composition.

## Direction and switching rules

- Aim direction should drive `WeaponNode` rotation.
- Movement direction should drive legs/body run cycle.
- If there is no target, aim follows movement or the last aim angle.
- When switching weapons, only swap the weapon visual definition:
  sprite, icon, grip pivot, muzzle point, size, layer rule, and mechanic VFX.
- Upward/backward aim should draw the weapon behind the body.
- Downward/front aim should draw the weapon in front of the body.

## Overheat SMG VFX notes

- Increase orange glow intensity with `overheatStacks`.
- Attach rapid muzzle flash to the `muzzle` point from `weapon_mount_spec_yuz_v1.json`.
- Keep the weapon short on screen; long rifle silhouettes make the starter weapon read incorrectly.

## Follow-up implementation notes

The current TypeScript already has an independent `playerWeaponSprite`, but the body animation is
effectively fixed to the south-facing body. A stronger implementation should make body/weapon
composition explicit and data-driven rather than relying on `weapon_*_icon` inventory art as the
in-world weapon sprite.
