/**
 * Exercises the cast hook against stand-ins for the Foundry and system globals it touches.
 * This checks the module's own wiring; it does not prove the real system behaves the same way.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { FLAGS, MODULE_ID } from "../scripts/constants.js";

const log = { warnings: [], messages: [], rolls: [] };
let confirmAnswer = true;
let nextRoll = 10;

class Items extends Map {
    filter(fn) {
        return [...this.values()].filter(fn);
    }
}

function setPath(target, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    let node = target;
    for (const part of parts) node = node[part] ??= {};
    node[last] = value;
}

class FakeConsumable {
    constructor({ id, name = "Spell Chip of Test", chip = true, uses = 1, installedIn = null }) {
        this.id = id;
        this.uuid = `Actor.a.Item.${id}`;
        this.name = name;
        this.type = "consumable";
        this.flags = chip ? { [MODULE_ID]: { [FLAGS.chip]: true, [FLAGS.installedIn]: installedIn } } : {};
        this.system = { uses: { value: uses, max: 1 }, hp: { value: 4, max: 4 } };
        this.calls = [];
    }

    isOfType(...types) {
        return types.includes("physical") || types.includes(this.type);
    }

    get isDestroyed() {
        return this.system.hp.max > 0 && this.system.hp.value === 0;
    }

    get isBroken() {
        return !this.isDestroyed && this.system.hp.value <= Math.floor(this.system.hp.max / 2);
    }

    async consume() {
        this.calls.push("consume");
        this.system.uses.value = Math.max(this.system.uses.value - 1, 0);
    }

    async castEmbeddedSpell() {
        this.calls.push("castEmbeddedSpell");
    }

    async update(changes) {
        this.calls.push("update");
        for (const [path, value] of Object.entries(changes)) setPath(this, path, value);
    }

    async delete() {
        this.calls.push("delete");
    }
}

globalThis.CONFIG = { PF2E: { Item: { documentClasses: { consumable: FakeConsumable } } } };
globalThis.game = {
    i18n: { format: (key) => key, localize: (key) => key },
    settings: { get: () => "comm-unit" },
    user: { isGM: false, id: "u" },
};
globalThis.ui = { notifications: { warn: (m) => log.warnings.push(m), info: () => {} } };
globalThis.foundry = { applications: { api: { DialogV2: { confirm: async () => confirmAnswer } } } };
globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async (data) => log.messages.push(data),
};
globalThis.Roll = class {
    async evaluate() {
        this.total = nextRoll;
        return this;
    }

    async toMessage(data) {
        log.rolls.push({ total: this.total, ...data });
    }
};

const { registerCastWrapper } = await import("../scripts/casting.js");
assert.equal(registerCastWrapper(), true);

/** An actor with a comm unit and one chip installed in it */
function setup({ uses = 1, held = true, installed = true, canCast = true } = {}) {
    const actor = { name: "Tester", items: new Items(), spellcasting: { canCastConsumable: () => canCast } };
    const device = { id: "dev", name: "Comm Unit", slug: "comm-unit", actor, isHeld: held, isOfType: () => true };
    const chip = new FakeConsumable({ id: "chip", uses, installedIn: installed ? "dev" : null });
    chip.actor = actor;
    actor.items.set(device.id, device);
    actor.items.set(chip.id, chip);
    return { actor, device, chip };
}

beforeEach(() => {
    log.warnings.length = log.messages.length = log.rolls.length = 0;
    confirmAnswer = true;
    nextRoll = 10;
});

test("other consumables are left to the system", async () => {
    const potion = new FakeConsumable({ id: "potion", chip: false });
    potion.actor = { items: new Items() };
    await potion.consume();
    assert.deepEqual(potion.calls, ["consume"]);
});

test("a ready chip in a held device is cast by the system", async () => {
    const { chip } = setup();
    await chip.consume();
    assert.deepEqual(chip.calls, ["consume"]);
    assert.equal(chip.system.uses.value, 0);
    assert.equal(log.warnings.length, 0);
});

test("casting is refused when the device is not held", async () => {
    const { chip } = setup({ held: false });
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.deepEqual(log.warnings, ["SF2E_SPELL_CHIPS.Cast.DeviceNotHeld"]);
});

test("casting is refused when the chip is not installed", async () => {
    const { chip } = setup({ installed: false });
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.deepEqual(log.warnings, ["SF2E_SPELL_CHIPS.Cast.NotInstalled"]);
});

test("overclocking with a successful flat check casts and leaves the chip broken", async () => {
    const { chip } = setup({ uses: 0 });
    nextRoll = 10;
    await chip.consume();
    assert.deepEqual(chip.calls, ["castEmbeddedSpell", "update"]);
    assert.equal(log.rolls.length, 1);
    assert.equal(chip.isBroken, true);
    assert.equal(chip.flags[MODULE_ID][FLAGS.overclocked], true);
    assert.notEqual(chip.flags[MODULE_ID][FLAGS.destroyed], true);
});

test("overclocking with a failed flat check casts and marks the chip destroyed without deleting it", async () => {
    const { chip, actor } = setup({ uses: 0 });
    nextRoll = 9;
    await chip.consume();
    assert.deepEqual(chip.calls, ["castEmbeddedSpell", "update"]);
    assert.equal(chip.flags[MODULE_ID][FLAGS.destroyed], true);
    assert.equal(chip.isDestroyed, true);
    assert.equal(actor.items.get("chip"), chip);
});

test("declining the overclock prompt does nothing", async () => {
    const { chip } = setup({ uses: 0 });
    confirmAnswer = false;
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.equal(log.rolls.length, 0);
});

test("a spent chip is not overclocked by someone who cannot cast its spell", async () => {
    const { chip } = setup({ uses: 0, canCast: false });
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.deepEqual(log.warnings, ["PF2E.LackCastConsumableCapability"]);
});

test("a broken chip cannot be used until repaired, then burns out if overclocked again that day", async () => {
    const { chip } = setup({ uses: 0 });
    await chip.consume();
    assert.equal(chip.isBroken, true);

    chip.calls.length = 0;
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.deepEqual(log.warnings, ["SF2E_SPELL_CHIPS.Cast.Broken"]);

    chip.system.hp.value = chip.system.hp.max; // repaired the same day
    await chip.consume();
    assert.deepEqual(chip.calls, ["update"]);
    assert.equal(chip.flags[MODULE_ID][FLAGS.destroyed], true);
    assert.equal(log.messages.length, 1);
    assert.equal(log.rolls.length, 1, "no second flat check and no spell on a burnout");
});

test("a destroyed chip stays unusable even after a rest restores its charge", async () => {
    const { chip } = setup({ uses: 0 });
    nextRoll = 1;
    await chip.consume();
    chip.calls.length = 0;
    chip.system.uses.value = 1;
    chip.system.hp.value = chip.system.hp.max;
    await chip.consume();
    assert.deepEqual(chip.calls, []);
    assert.deepEqual(log.warnings, ["SF2E_SPELL_CHIPS.Cast.Destroyed"]);
});
