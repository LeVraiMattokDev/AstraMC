# AstraMC

Hello everyone!

This entire repo was made by GPT-6 Astra. It used around 18% of my quota on a Pro 5x account and consumed roughly 40 million tokens.
What was the point of that?
First of all, I needed to use up some of my quota before the free reset anyway xD.
But more importantly, ever since the model came out, I've seen people complaining on X, Reddit, and various forums that the limits melt like snowflakes in summer.
And I'm sorry, but I just can't agree with that.
Those 40 million tokens would cost roughly $70 through the API, while my plan costs me $100/month. And that was only about 18% of my quota.
Sure, the limits might be lower than they were before, and I understand why some people are disappointed. But complaining that the limits are ridiculously small when you're potentially getting more usage value than what you're actually paying for feels a bit crazy to me.
Anyway, this repo was basically my very scientific way of testing that theory xD.


**Explore, build, and survive in a living voxel wilderness — directly in your browser.**

GPTAstra is a single-player 3D sandbox built with JavaScript and Three.js. Start with a few provisions, gather resources, build a shelter, and follow the rivers into a procedurally generated world. Or switch to Creative mode and build freely from the sky.

The game appears in the browser as **AstraMC — Terres sauvages** ("Wild Lands"), version 3. Its interface is currently in **French**; this README explains how to get started in English.

[Guide en français](README.fr.md)

## The world

- **Procedural terrain:** seeded worlds with plains, forests, deserts, snowy taiga, caves, and ores. Terrain generates as you explore, with a vertical height of 64 blocks.
- **A more natural landscape:** rounded tree trunks, wind-animated foliage, grass, flowers, rocks, reeds, and collectible berries and mushrooms.
- **Changing atmosphere:** day and night, soft shadows, clouds, stars, fog, rain, snow, and thunderstorms with lightning.
- **Water and sound:** animated water with simulated sky reflections, plus procedural wind, rain, water, fire, footsteps, and interaction sounds.
- **Wildlife and encounters:** pigs, sheep, deer that flee when approached, birds, fireflies, and hostile nighttime creatures in Survival mode.
- **Places to discover:** ruins, abandoned camps, supplies, an exploration map, a compass, waypoints, and a travel journal.

## Build a life outdoors

Mine and place blocks, craft tools, and build your own camp. The game includes **31 recipes**, crafting tables, furnaces, beds, torches, lanterns, campfires, and persistent storage chests.

Survival combines health, hunger, oxygen, stamina, hydration, warmth, and wetness. Weather and shelter matter: rain and immersion make you wet, while a nearby fire helps you dry off and warm up. Drink from a river, refill a flask, apply bandages, gather food, or fish and cook your catch. Tools wear out, ore harvesting depends on your equipment, and death drops your inventory for you to recover.

Creative mode provides freely available items, flight, and waypoint travel. Graphics quality, render distance, field of view, mouse sensitivity, sound, weather, and time of day can be adjusted from the pause menu. Photo mode hides the interface and held item for screenshots.

## Quick start

You need **Node.js 18 or later** and a modern browser with **WebGL 2** and hardware acceleration enabled.

```bash
git clone https://github.com/LeVraiMattokDev/GPTAstra.git
cd GPTAstra
npm start
```

Open **[http://localhost:4173](http://localhost:4173)**, choose **Survie** (Survival) or **Créatif** (Creative), then click **Jouer** (Play) to enter the world.

**No build step or `npm install` is required to run the game.** The playable source files and Three.js modules are included in `dist/`. Use the HTTP address above instead of opening `index.html` directly. Keep the terminal running; press `Ctrl+C` to stop the local server.

To choose another port on Linux or macOS:

```bash
PORT=4174 npm start
```

Keep using the same browser and address to return to your saved world. If performance is limited, open the pause menu, select **Économe** (Low) graphics quality, and reduce the render distance.

## Controls

| Action | Control |
| --- | --- |
| Move | **WASD**, **ZQSD** on AZERTY, or arrow keys |
| Look around | Mouse; drag if pointer capture is unavailable |
| Jump / swim upward | **Space** |
| Sprint | **Shift** while moving |
| Mine / attack | Hold **left mouse button**, or **X** |
| Place / interact / harvest / eat | **Right mouse button**, or **C** |
| Drink from water | **R** while aiming at water |
| Inventory and crafting | **E** |
| Map and journal | **M** |
| Select hotbar slot | **1–9** or mouse wheel |
| Pick targeted block | Middle mouse button; requires ownership in Survival |
| Drop an item | **Q** in Survival |
| Toggle photo mode | **P** |
| Pause and settings | **Escape** |
| Toggle Creative flight | **F** or double-tap **Space** |
| Ascend / descend while flying | **Space** / **Shift** |

Hold **Shift** while right-clicking a crafting station to place a block beside it. In a chest, click to transfer one item or **Shift-click** to transfer the whole stack. Touch controls are also available on compatible devices.

### Your first expedition

1. Gather wood, open the inventory with **E**, and craft planks, sticks, and a crafting table. Progress from wooden tools to stone, iron, and diamond.
2. Keep food and water nearby. Aim at water and press **R** to drink, or use an equipped flask to fill it and drink later.
3. Build a campfire for warmth and cooking. Right-click it, choose a recipe, and collect the cooked food when it appears nearby.
4. To fish, equip a fishing rod and right-click water. Wait for **Ça mord !** ("A bite!") and right-click again to reel in the catch.
5. Open **M** to view explored terrain and place a waypoint. Build a bed to set your return point and sleep through the night when it is safe.

## Saves

The game automatically saves to the browser's **local storage**, including modified blocks, player position, inventory, tool durability, chest contents, survival state, weather, and exploration progress.

There is **one active world per browser origin**. Creating a new world replaces that active save. Clearing site data removes it; changing browsers, hostnames, or ports uses a different storage location. Saves are local, with no account or cloud synchronization.

Version 1 and 2 saves remain compatible. Existing worlds retain their original terrain generator and constructions, while new worlds use the newer biome and cave generation.

## Code and tests

The JavaScript modules in `dist/` are the source code, not generated build output. The project uses native ES modules, Three.js for rendering, Web Audio for procedural sound, and Node's built-in HTTP server for local development.

| File | Responsibility |
| --- | --- |
| `dist/game.js` | Main loop, input, interface, rendering integration, and save orchestration |
| `dist/world.js` | Seeded terrain, blocks, collisions, and raycasting |
| `dist/survival.js` | Inventory, crafting, tools, combat, and basic survival rules |
| `dist/expedition.js` | Stamina, hydration, exposure, fishing, and chest storage |
| `dist/atmosphere.js` | Sky, lighting, weather, and environmental conditions |
| `dist/landscape.js` / `dist/natural-trees.js` | Vegetation, natural trees, scenery, and discoveries |
| `dist/render-materials.js` | Terrain materials, animated water, and camp furniture |
| `dist/mobs.js` / `dist/item-physics.js` | Creatures and dropped-item physics |
| `dist/navigation.js` / `dist/ambience.js` | Maps, waypoints, and procedural audio |
| `server.mjs` | Local static server, bound to `127.0.0.1` |
| `tests/` | Automated tests using Node's built-in test runner |

Run the tests with:

```bash
npm test
```

Tests cover terrain generation, collision behavior, harvesting, crafting, survival, weather, fishing, storage, exploration, and save compatibility. Rendering and browser interactions also require visual checks in a WebGL-capable browser.

## Scope

GPTAstra is a **stylized procedural sandbox**, inspired by voxel building games and wilderness exploration. It is single-player and does not reproduce the complete Minecraft feature set. There is no multiplayer, redstone system, or alternate dimension. Water effects are visual approximations rather than a full fluid simulation, and wildlife and survival use simplified rules. Decorative scenery is generally non-solid; player-built blocks, chests, and designated collectibles provide the interactive world.

## Third-party software

The vendored **Three.js 0.180.0** modules are distributed under the MIT License. Their copyright and license notice is included in [`dist/vendor/THREE-LICENSE.txt`](dist/vendor/THREE-LICENSE.txt).
