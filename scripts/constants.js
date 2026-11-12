export const MODULE_ID = "sf2e-spell-chips";

/** Key of the module's entry in CONFIG.PF2E.spellcastingItems */
export const SPELL_ITEM_TYPE = "spell-chip";

export const PACK_ID = `${MODULE_ID}.spell-chips`;

/** Template chip ids in the module compendium, by spell rank. Spell chips stop at 9th rank. */
export const TEMPLATE_IDS = {
    1: "sf2eSpellChipR01",
    2: "sf2eSpellChipR02",
    3: "sf2eSpellChipR03",
    4: "sf2eSpellChipR04",
    5: "sf2eSpellChipR05",
    6: "sf2eSpellChipR06",
    7: "sf2eSpellChipR07",
    8: "sf2eSpellChipR08",
    9: "sf2eSpellChipR09",
};

/** Item slugs that can host a spell chip without a GM marking them */
export const DEFAULT_HOST_SLUGS = "comm-unit, datapad";

export const OVERCLOCK_DC = 10;

export const FLAGS = {
    /** Marks a consumable as a spell chip */
    chip: "chip",
    /** Id of the device item (same actor) the chip is installed in */
    installedIn: "installedIn",
    /** The chip has been overclocked since the last rest */
    overclocked: "overclocked",
    /** The chip is permanently destroyed */
    destroyed: "destroyed",
    /** Set on a device: a GM allowed this item to host spell chips */
    host: "host",
};

export const SETTINGS = {
    hostSlugs: "hostSlugs",
};
