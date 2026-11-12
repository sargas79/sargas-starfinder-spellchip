# SF2e Spell Chips

A Foundry VTT module that makes spell chips work in the Starfinder Second Edition (`sf2e`) system.
The system ships spell chips as inert equipment; this module adds chips you can install, cast from and overclock.

Requires Foundry VTT 14 (14.361 or later) and the `sf2e` system 1.7.0 or later.

## What it does

- **Create chips from spells.** Drag a spell onto a character's inventory and pick *Spell Chip* in the dialog
  (ranks 1 to 9; cantrips are not offered). The *Spell Chips* compendium holds the blank templates.
- **Install in a device.** A chip must be installed in a comm unit or computer the character carries, one chip
  per device. Use the chip button on the chip's inventory row, or drag the chip onto the device.
- **Hold the device to cast.** Casting is refused unless the chip is installed and its device is held in a hand.
  The spell is cast with the character's own spell DC and attack, and must be on their spell list.
- **Once per day, plus overclock.** After the daily use, casting again asks to overclock: the spell is cast and a
  DC 10 flat check is rolled to chat. On a success the chip is broken; on a failure it is destroyed.
  Overclocking a chip a second time in the same day destroys it and casts nothing.
- **Broken and destroyed chips stay in the inventory.** A broken chip can be fixed with the system's Repair
  control. A destroyed chip is kept as an item but can never be used again.
- **Rest.** Rest for the Night restores the daily use and clears the overclock mark.

## Which items can hold a chip

Comm units and datapads by default. The *Chip host items* world setting takes a comma-separated list of item
slugs or names. A GM can also pick any other piece of equipment in the install dialog, which marks that one
item as a chip host.

## Development

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` generates the nine template chips and compiles them into `packs/spell-chips` (LevelDB).
To try the module locally, link or copy this folder into Foundry's `Data/modules/sf2e-spell-chips` after building.

Publishing a GitHub release runs the workflow in `.github/workflows/release.yml`, which builds the pack and
attaches `module.json` and `module.zip` to the release. The manifest URL for installing is:

```
https://github.com/sargas79/sargas-starfinder-spellchip/releases/latest/download/module.json
```

## Notes and limits

- Chips are `wand`-category consumables under the hood, so the system's casting, spellcasting tab and daily
  recharge apply to them. The system's own equipment-type Spell Chip entries are not converted.
- Technomancer feats that change chip rules (for example Universal Spell Bus) are not automated.

## Licence

Code is released under the MIT licence (see `LICENSE`). This module is not published, endorsed or approved by
Paizo. Spell chip rules are summarised from *Starfinder Player Core*, which is licensed under the ORC License.
