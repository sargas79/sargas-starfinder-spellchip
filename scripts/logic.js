/**
 * Rules logic for spell chips, free of Foundry globals so it can be unit tested with plain Node.
 */

/**
 * Decide what happens when someone tries to cast from a chip.
 *
 * @param {object} chip
 * @param {boolean} chip.destroyed    The chip is destroyed
 * @param {boolean} chip.broken       The chip is broken
 * @param {boolean} chip.installed    The chip is installed in a device its owner carries
 * @param {boolean} chip.deviceHeld   That device is held in a hand
 * @param {number}  chip.uses         Remaining daily uses (0 or 1)
 * @param {boolean} chip.overclocked  The chip was already overclocked since the last rest
 * @returns {{action: "cast"|"overclock"|"burnout"}|{action: "blocked", reason: string}}
 *   cast      - normal daily use
 *   overclock - second use today: cast, then roll the flat check
 *   burnout   - already overclocked today: destroyed, no spell is cast
 */
export function resolveCastAttempt({ destroyed, broken, installed, deviceHeld, uses, overclocked }) {
    if (destroyed) return { action: "blocked", reason: "destroyed" };
    if (broken) return { action: "blocked", reason: "broken" };
    if (!installed) return { action: "blocked", reason: "notInstalled" };
    if (!deviceHeld) return { action: "blocked", reason: "deviceNotHeld" };
    if (uses > 0) return { action: "cast" };
    return { action: overclocked ? "burnout" : "overclock" };
}

/**
 * Outcome of the overclock flat check: the chip is broken on a success and destroyed on a failure.
 * A flat check has no modifiers, so a natural 1 or 20 never moves the result across the DC.
 *
 * @param {number} total The d20 result
 * @param {number} dc    The flat check DC
 * @returns {"broken"|"destroyed"}
 */
export function resolveOverclock(total, dc) {
    return total >= dc ? "broken" : "destroyed";
}

/** Turn an item name into a slug the same way the system does for simple names */
export function sluggify(text) {
    return String(text ?? "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Parse the comma-separated host slug setting into a set of slugs */
export function parseSlugList(value) {
    return new Set(
        String(value ?? "")
            .split(",")
            .map((s) => sluggify(s))
            .filter((s) => s.length > 0),
    );
}

/**
 * Whether an item can host a spell chip.
 *
 * @param {object} item
 * @param {string|null} item.slug  The item's slug, if it has one
 * @param {string} item.name       The item's name, used when it has no slug
 * @param {boolean} item.flagged   A GM marked this item as a chip host
 * @param {Set<string>} hostSlugs  Slugs that host chips by default
 */
export function isHostCandidate({ slug, name, flagged }, hostSlugs) {
    if (flagged) return true;
    return hostSlugs.has(slug || sluggify(name));
}

/**
 * Find the chip already occupying a device, ignoring the chip being installed.
 *
 * @param {{id: string, installedIn: string|null}[]} chips All chips on the actor
 * @param {string} deviceId
 * @param {string} chipId The chip being installed
 * @returns {{id: string, installedIn: string|null}|null}
 */
export function findOccupant(chips, deviceId, chipId) {
    return chips.find((c) => c.installedIn === deviceId && c.id !== chipId) ?? null;
}
