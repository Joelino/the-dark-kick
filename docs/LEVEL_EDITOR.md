# Single-Slot Level Editor

## Purpose

The editor answers one immediate workflow question: can room geometry be
changed and playtested without editing TypeScript?

Open **Level Editor** from the home screen. Select a tile type and tap any cell
on the fixed 8×6 grid.

## Tile tools

- **Floor** clears the cell.
- **Wall** blocks movement.
- **Spikes** damage entrants and influence pathfinding.
- **Exit** moves the one required exit marker.
- **Player** moves the one required player spawn.
- **Orc** adds an enemy spawn. One to four are supported.

Player and Exit are unique: placing either automatically clears its previous
cell. Painting another type over a marker removes it, and Save then explains
what is missing.

## Save behavior

**Save Level**:

1. rejects the draft unless it has exactly one Player, exactly one Exit, one to
   four Orcs, and a spike-free Player-to-Exit path;
2. overwrites one versioned browser-local active-level slot;
3. starts a `level.json` download for sharing or committing separately.

The active slot is restored automatically on reload and used by the next
**Start Run**. Every Orc painted into an edited room spawns; the combat tuner's
Orc Count value applies only to the bundled fallback room and is hidden while
an edited room is active. There is no list, naming UI, import UI, or multiple
save slots in this iteration.

The browser cannot directly overwrite a source file in the deployed game. The
download is therefore the portable file; browser storage is the immediately
playable copy.

## File shape

The JSON file is versioned and contains the runtime geometry:

```json
{
  "version": 1,
  "level": {
    "id": "edited-cellar",
    "playerStart": { "col": 1, "row": 2 },
    "exit": { "col": 7, "row": 1 },
    "walls": [],
    "spikes": [],
    "enemySpawns": [
      { "id": "orc-1", "position": { "col": 4, "row": 2 } }
    ],
    "chokes": [],
    "openAreas": []
  }
}
```

Coordinates are zero-based. Choke and open-area metadata are left empty by the
basic editor; runtime combat depends on the painted geometry and spawns.
