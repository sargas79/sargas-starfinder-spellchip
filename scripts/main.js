import { DEFAULT_HOST_SLUGS, MODULE_ID, PACK_ID, SETTINGS, SPELL_ITEM_TYPE, TEMPLATE_IDS } from "./constants.js";
import { registerCastWrapper } from "./casting.js";
import { t } from "./chip.js";
import { onDeleteItem, onPreCreateItem, onRest } from "./install.js";
import { onRenderActorSheet } from "./ui.js";

function rerenderActorSheets() {
    for (const actor of game.actors ?? []) {
        if (actor.sheet?.rendered) actor.sheet.render();
    }
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, SETTINGS.hostSlugs, {
        name: "SF2E_SPELL_CHIPS.Settings.HostSlugs.Name",
        hint: "SF2E_SPELL_CHIPS.Settings.HostSlugs.Hint",
        scope: "world",
        config: true,
        type: String,
        default: DEFAULT_HOST_SLUGS,
        onChange: rerenderActorSheets,
    });

    // Offer "Spell Chip" when a spell is dropped on an inventory. Chips cannot hold 10th-rank spells.
    const compendiumUuids = { 10: null };
    for (const [rank, id] of Object.entries(TEMPLATE_IDS)) {
        compendiumUuids[rank] = `Compendium.${PACK_ID}.Item.${id}`;
    }
    if (CONFIG.PF2E?.spellcastingItems) {
        CONFIG.PF2E.spellcastingItems[SPELL_ITEM_TYPE] = {
            name: "SF2E_SPELL_CHIPS.Category",
            nameTemplate: "SF2E_SPELL_CHIPS.NameTemplate",
            compendiumUuids,
        };
    }

    if (!registerCastWrapper()) {
        console.error(`${MODULE_ID} | Could not find the system's consumable item class`);
        Hooks.once("ready", () => ui.notifications.error(t("Error.NoConsumableClass"), { permanent: true }));
    }
});

Hooks.on("preCreateItem", onPreCreateItem);
Hooks.on("deleteItem", onDeleteItem);
Hooks.on("pf2e.restForTheNight", onRest);
Hooks.on("renderActorSheet", onRenderActorSheet);
