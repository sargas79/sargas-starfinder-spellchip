import assert from "node:assert/strict";
import { test } from "node:test";
import {
    findOccupant,
    isHostCandidate,
    parseSlugList,
    resolveCastAttempt,
    resolveOverclock,
    resolveRecharge,
    sluggify,
} from "../scripts/logic.js";

const ready = { destroyed: false, broken: false, installed: true, deviceHeld: true, uses: 1, overclocked: false };

test("a ready chip casts normally", () => {
    assert.deepEqual(resolveCastAttempt(ready), { action: "cast" });
});

test("a spent chip is overclocked", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, uses: 0 }), { action: "overclock" });
});

test("a chip already overclocked today burns out", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, uses: 0, overclocked: true }), { action: "burnout" });
});

test("a chip overclocked earlier but recharged casts normally", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, overclocked: true }), { action: "cast" });
});

test("an uninstalled chip is blocked", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, installed: false, deviceHeld: false }), {
        action: "blocked",
        reason: "notInstalled",
    });
});

test("a chip whose device is not held is blocked", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, deviceHeld: false }), {
        action: "blocked",
        reason: "deviceNotHeld",
    });
});

test("a broken chip is blocked even with a charge", () => {
    assert.deepEqual(resolveCastAttempt({ ...ready, broken: true }), { action: "blocked", reason: "broken" });
});

test("a broken chip cannot burn out until it is repaired", () => {
    const attempt = resolveCastAttempt({ ...ready, broken: true, uses: 0, overclocked: true });
    assert.deepEqual(attempt, { action: "blocked", reason: "broken" });
});

test("a destroyed chip is blocked before anything else", () => {
    const attempt = resolveCastAttempt({ ...ready, destroyed: true, broken: true, installed: false });
    assert.deepEqual(attempt, { action: "blocked", reason: "destroyed" });
});

test("the overclock flat check breaks the chip on a success and destroys it on a failure", () => {
    assert.equal(resolveOverclock(10, 10), "broken");
    assert.equal(resolveOverclock(20, 10), "broken");
    assert.equal(resolveOverclock(9, 10), "destroyed");
    assert.equal(resolveOverclock(1, 10), "destroyed");
});

test("sluggify matches simple system slugs", () => {
    assert.equal(sluggify("Comm Unit"), "comm-unit");
    assert.equal(sluggify("  Maker's App "), "makers-app");
    assert.equal(sluggify("Datapad (Commercial)"), "datapad-commercial");
});

test("parseSlugList accepts slugs or names and drops blanks", () => {
    assert.deepEqual([...parseSlugList("comm-unit, Datapad,, ")], ["comm-unit", "datapad"]);
    assert.equal(parseSlugList(undefined).size, 0);
});

test("host detection uses the slug, then the name, then the GM flag", () => {
    const slugs = parseSlugList("comm-unit, datapad");
    assert.equal(isHostCandidate({ slug: "comm-unit", name: "Renamed", flagged: false }, slugs), true);
    assert.equal(isHostCandidate({ slug: null, name: "Comm Unit", flagged: false }, slugs), true);
    assert.equal(isHostCandidate({ slug: "medkit", name: "Medkit", flagged: false }, slugs), false);
    assert.equal(isHostCandidate({ slug: "medkit", name: "Medkit", flagged: true }, slugs), true);
});

test("a device holds one chip", () => {
    const chips = [
        { id: "a", installedIn: "dev1" },
        { id: "b", installedIn: null },
    ];
    assert.deepEqual(findOccupant(chips, "dev1", "b"), chips[0]);
    assert.equal(findOccupant(chips, "dev1", "a"), null);
    assert.equal(findOccupant(chips, "dev2", "b"), null);
});

test("recharging a spent chip clears its overclock mark", () => {
    const chip = { destroyed: false, overclocked: true, uses: 0 };
    assert.deepEqual(resolveRecharge(chip, 1), { uses: 1, clearOverclock: true });
});

test("spending or keeping a charge leaves the overclock mark alone", () => {
    assert.deepEqual(resolveRecharge({ destroyed: false, overclocked: true, uses: 0 }, 0), {
        uses: 0,
        clearOverclock: false,
    });
    assert.deepEqual(resolveRecharge({ destroyed: false, overclocked: false, uses: 1 }, 0), {
        uses: 0,
        clearOverclock: false,
    });
});

test("a destroyed chip never regains a charge", () => {
    const chip = { destroyed: true, overclocked: true, uses: 0 };
    assert.deepEqual(resolveRecharge(chip, 1), { uses: 0, clearOverclock: false });
});
