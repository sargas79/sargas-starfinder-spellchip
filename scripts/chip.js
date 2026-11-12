import { FLAGS, MODULE_ID, SETTINGS } from "./constants.js";
import { isHostCandidate, parseSlugList } from "./logic.js";

/** Hit points given to a chip that has none, so the system can show it as broken and repair it */
const FALLBACK_HP = 4;

/** Localize a module string, formatting it when data is given */
export function t(key, data) {
    const path = `SF2E_SPELL_CHIPS.${key}`;
    return data ? game.i18n.format(path, data) : game.i18n.localize(path);
}

export function escapeHTML(text) {
    return String(text ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
}

export function getFlag(item, key) {
    return item?.flags?.[MODULE_ID]?.[key];
}

export function flagPath(key) {
    return `flags.${MODULE_ID}.${key}`;
}

/** Whether an item is a spell chip managed by this module */
export function isChip(item) {
    return item?.type === "consumable" && getFlag(item, FLAGS.chip) === true;
}

function isPhysical(item) {
    return typeof item?.isOfType === "function" && item.isOfType("physical");
}

/** All spell chips an actor owns */
export function actorChips(actor) {
    return actor?.items?.filter((i) => isChip(i)) ?? [];
}

/** The device a chip is installed in, or null if it is not installed in anything its owner has */
export function getDevice(chip) {
    const id = getFlag(chip, FLAGS.installedIn);
    const device = id ? chip.actor?.items.get(id) : null;
    return isPhysical(device) ? device : null;
}

/** The chip installed in a device, if any */
export function getInstalledChip(device) {
    if (!device?.actor) return null;
    return actorChips(device.actor).find((c) => getFlag(c, FLAGS.installedIn) === device.id) ?? null;
}

/** Whether an item can hold a spell chip */
export function isHost(item) {
    if (!isPhysical(item) || isChip(item)) return false;
    const hostSlugs = parseSlugList(game.settings.get(MODULE_ID, SETTINGS.hostSlugs));
    return isHostCandidate(
        { slug: item.slug, name: item.name, flagged: getFlag(item, FLAGS.host) === true },
        hostSlugs,
    );
}

export function isChipDestroyed(chip) {
    return getFlag(chip, FLAGS.destroyed) === true || chip.isDestroyed === true;
}

export function isChipBroken(chip) {
    return !isChipDestroyed(chip) && chip.isBroken === true;
}

export function isOverclocked(chip) {
    return getFlag(chip, FLAGS.overclocked) === true;
}

/** The chip's current condition, in the shape the rules logic expects */
export function chipSnapshot(chip) {
    const device = getDevice(chip);
    return {
        destroyed: isChipDestroyed(chip),
        broken: isChipBroken(chip),
        installed: !!device,
        deviceHeld: !!device?.isHeld,
        uses: Number(chip.system.uses?.value) || 0,
        overclocked: isOverclocked(chip),
    };
}

function maxHP(chip) {
    const max = Number(chip.system.hp?.max) || 0;
    return max > 0 ? max : FALLBACK_HP;
}

/**
 * Update data that leaves the chip broken: hit points at the broken threshold (half its maximum),
 * which the system shows as broken and lets the Repair action fix.
 */
export function brokenUpdate(chip) {
    const max = maxHP(chip);
    return { "system.hp.max": max, "system.hp.value": Math.floor(max / 2) };
}

/** Update data that leaves the chip destroyed for good. The item itself is kept. */
export function destroyedUpdate(chip) {
    return {
        "system.hp.max": maxHP(chip),
        "system.hp.value": 0,
        "system.uses.value": 0,
        [flagPath(FLAGS.destroyed)]: true,
    };
}
