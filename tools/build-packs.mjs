/**
 * Build the Spell Chips compendium: one template chip per spell rank, compiled to LevelDB.
 * The templates are generated from the table below so the nine entries cannot drift apart.
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULE_ID, OVERCLOCK_DC, TEMPLATE_IDS } from "../scripts/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "dist", "pack-src", "spell-chips");
const packDir = path.join(root, "packs", "spell-chips");

/** Item level and price in credits by spell rank, with the id of the system's own Spell Chip entry */
export const CHIPS = [
    { rank: 1, ordinal: "1st", level: 3, credits: 600, systemId: "U48mM3lcrBTh25d9" },
    { rank: 2, ordinal: "2nd", level: 5, credits: 1600, systemId: "88WZweNBd4j2X2hd" },
    { rank: 3, ordinal: "3rd", level: 7, credits: 3600, systemId: "Wn8GEmCG24QIM1wt" },
    { rank: 4, ordinal: "4th", level: 9, credits: 7000, systemId: "5O3DUTQoUA3rcF6v" },
    { rank: 5, ordinal: "5th", level: 11, credits: 15000, systemId: "nyTMtaCsBvXeK4JP" },
    { rank: 6, ordinal: "6th", level: 13, credits: 30000, systemId: "PinBkpx2xRvmUiiM" },
    { rank: 7, ordinal: "7th", level: 15, credits: 65000, systemId: "TBtiV7FLBpI2HtCC" },
    { rank: 8, ordinal: "8th", level: 17, credits: 150000, systemId: "cUks0bsnFkfxeojU" },
    { rank: 9, ordinal: "9th", level: 19, credits: 400000, systemId: "sB9xK4xLUCyXUDzm" },
];

function description(chip) {
    return [
        "<p><strong>Usage</strong> installed in a computer or comm unit</p><hr />",
        "<p>Install this chip in a comm unit or other computer (one chip per device), then hold the device in one ",
        "hand to Cast the Spell stored on it. You are the caster: the spell must be on your spell list and uses ",
        "your spell attack modifier and spell DC.</p>",
        "<p>The chip works once per day. Using it again the same day overclocks it: the spell is cast, then a ",
        `@Check[flat|dc:${OVERCLOCK_DC}] decides whether the chip is left broken (success) or destroyed (failure). `,
        "Overclocking a chip a second time in one day destroys it without casting the spell.</p>",
        `<p>Full rules: @UUID[Compendium.sf2e.equipment.Item.${chip.systemId}]{Spell Chip}</p>`,
    ].join("");
}

/** The source data of one template chip. It is a wand-category consumable so the system casts from it. */
export function buildTemplate(chip) {
    const _id = TEMPLATE_IDS[chip.rank];
    return {
        _id,
        _key: `!items!${_id}`,
        name: `Spell Chip (${chip.ordinal}-Rank Spell)`,
        type: "consumable",
        img: "systems/sf2e/icons/equipment/other/flexible-circuit.webp",
        flags: {
            [MODULE_ID]: { chip: true, installedIn: null, overclocked: false, destroyed: false },
        },
        system: {
            baseItem: null,
            bulk: { value: 0.1 },
            category: "wand",
            containerId: null,
            damage: null,
            description: { value: description(chip) },
            hardness: 0,
            hp: { max: 4, value: 4 },
            level: { value: chip.level },
            material: { grade: null, type: null },
            price: { value: { sp: chip.credits } },
            publication: { license: "ORC", remaster: true, title: "Starfinder Player Core" },
            quantity: 1,
            rules: [],
            size: "med",
            traits: { rarity: "common", value: ["magical", "tech"] },
            usage: { value: "other" },
            uses: { autoDestroy: false, max: 1, value: 1 },
        },
    };
}

async function main() {
    await fs.rm(sourceDir, { recursive: true, force: true });
    await fs.rm(packDir, { recursive: true, force: true });
    await fs.mkdir(sourceDir, { recursive: true });

    for (const chip of CHIPS) {
        const template = buildTemplate(chip);
        const file = path.join(sourceDir, `spell-chip-rank-${chip.rank}.json`);
        await fs.writeFile(file, `${JSON.stringify(template, null, 4)}\n`);
    }

    await compilePack(sourceDir, packDir, { log: true });
    console.log(`Built ${CHIPS.length} spell chip templates into ${path.relative(root, packDir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
