import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FLAGS, MODULE_ID, PACK_ID, TEMPLATE_IDS } from "../scripts/constants.js";
import { buildTemplate, CHIPS } from "../tools/build-packs.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const lang = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

test("there is one template per spell rank from 1 to 9", () => {
    assert.deepEqual(
        CHIPS.map((c) => c.rank),
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    assert.equal(new Set(Object.values(TEMPLATE_IDS)).size, 9);
});

test("templates are flagged wand-category consumables with a valid document id", () => {
    for (const chip of CHIPS) {
        const template = buildTemplate(chip);
        assert.match(template._id, /^[A-Za-z0-9]{16}$/);
        assert.equal(template._key, `!items!${template._id}`);
        assert.equal(template.type, "consumable");
        assert.equal(template.system.category, "wand");
        assert.equal(template.flags[MODULE_ID][FLAGS.chip], true);
        assert.deepEqual(template.system.uses, { autoDestroy: false, max: 1, value: 1 });
        assert.equal(template.system.level.value, chip.rank * 2 + 1);
    }
});

test("the manifest matches the module constants", () => {
    assert.equal(manifest.id, MODULE_ID);
    assert.equal(`${manifest.id}.${manifest.packs[0].name}`, PACK_ID);
    for (const file of [...manifest.esmodules, ...manifest.styles, manifest.languages[0].path]) {
        assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `${file} is missing`);
    }
});

test("every localization key used by the scripts exists", () => {
    const lookup = (key) => key.split(".").reduce((node, part) => node?.[part], lang.SF2E_SPELL_CHIPS);
    const scripts = fs.readdirSync(new URL("../scripts/", import.meta.url));
    const keys = new Set();
    for (const file of scripts) {
        const source = fs.readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8");
        const sections = "Settings|Status|Install|Cast|Overclock|Burnout|Error";
        for (const match of source.matchAll(new RegExp(`"((?:${sections})\\.[A-Za-z.]+)"`, "g"))) keys.add(match[1]);
        for (const match of source.matchAll(/"SF2E_SPELL_CHIPS\.([A-Za-z.]+)"/g)) keys.add(match[1]);
    }
    assert.ok(keys.size > 20, "expected to find the module's localization keys");
    for (const key of keys) {
        assert.equal(typeof lookup(key), "string", `missing localization key ${key}`);
    }
});
