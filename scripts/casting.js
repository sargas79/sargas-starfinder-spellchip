import { FLAGS, OVERCLOCK_DC } from "./constants.js";
import {
    brokenUpdate,
    chipSnapshot,
    destroyedUpdate,
    escapeHTML,
    flagPath,
    getDevice,
    isChip,
    t,
} from "./chip.js";
import { resolveCastAttempt, resolveOverclock } from "./logic.js";

/** Chips with a cast in progress, so a double click cannot overclock twice */
const busy = new Set();

const BLOCKED_MESSAGES = {
    destroyed: "Cast.Destroyed",
    broken: "Cast.Broken",
    notInstalled: "Cast.NotInstalled",
    deviceNotHeld: "Cast.DeviceNotHeld",
};

/**
 * Route every use of a spell chip through the chip rules. The system sends all consumable use
 * (inventory, spellcasting tab, chat card buttons) through ConsumablePF2e#consume.
 *
 * @returns {boolean} Whether the hook was installed
 */
export function registerCastWrapper() {
    const cls = CONFIG.PF2E?.Item?.documentClasses?.consumable;
    const original = cls?.prototype?.consume;
    if (typeof original !== "function") return false;

    cls.prototype.consume = function (...args) {
        if (!isChip(this) || !this.actor) return original.apply(this, args);
        return useChip(this, () => original.apply(this, args));
    };
    return true;
}

async function useChip(chip, castNormally) {
    if (busy.has(chip.uuid)) return;
    busy.add(chip.uuid);
    try {
        const result = resolveCastAttempt(chipSnapshot(chip));
        switch (result.action) {
            case "blocked": {
                const names = { chip: chip.name, device: getDevice(chip)?.name ?? "" };
                ui.notifications.warn(t(BLOCKED_MESSAGES[result.reason], names));
                return;
            }
            case "cast":
                return await castNormally();
            case "overclock":
                return await overclock(chip);
            case "burnout":
                return await burnout(chip);
        }
    } finally {
        busy.delete(chip.uuid);
    }
}

function confirm({ title, content, label }) {
    return foundry.applications.api.DialogV2.confirm({
        window: { title },
        content,
        yes: { label, icon: "fa-solid fa-bolt" },
        rejectClose: false,
        modal: true,
    });
}

/** Second use in a day: cast the spell, then roll the flat check that breaks or destroys the chip */
async function overclock(chip) {
    const actor = chip.actor;
    if (!actor.spellcasting?.canCastConsumable?.(chip)) {
        const names = { actor: actor.name, spell: chip.name };
        ui.notifications.warn(game.i18n.format("PF2E.LackCastConsumableCapability", names));
        return;
    }

    const names = { chip: escapeHTML(chip.name), dc: OVERCLOCK_DC };
    const confirmed = await confirm({
        title: t("Overclock.Title", { chip: chip.name }),
        content: t("Overclock.Content", names),
        label: t("Overclock.Confirm"),
    });
    if (!confirmed) return;

    await chip.castEmbeddedSpell();

    const roll = await new Roll("1d20").evaluate();
    const outcome = resolveOverclock(roll.total, OVERCLOCK_DC);
    const resultKey = outcome === "broken" ? "Overclock.ResultBroken" : "Overclock.ResultDestroyed";
    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${t("Overclock.Flavor", names)}<br>${t(resultKey)}`,
    });

    await chip.update({
        ...(outcome === "broken" ? brokenUpdate(chip) : destroyedUpdate(chip)),
        [flagPath(FLAGS.overclocked)]: true,
    });
}

/** Overclocking a chip that was already overclocked today: it is destroyed and no spell is cast */
async function burnout(chip) {
    const actor = chip.actor;
    const names = { chip: escapeHTML(chip.name), actor: escapeHTML(actor.name) };
    const confirmed = await confirm({
        title: t("Burnout.Title", { chip: chip.name }),
        content: t("Burnout.Content", names),
        label: t("Burnout.Confirm"),
    });
    if (!confirmed) return;

    await chip.update(destroyedUpdate(chip));
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: t("Burnout.Message", names),
    });
}
