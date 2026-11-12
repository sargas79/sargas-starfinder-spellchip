import { FLAGS } from "./constants.js";
import {
    actorChips,
    escapeHTML,
    getDevice,
    getFlag,
    isChip,
    isChipBroken,
    isChipDestroyed,
    isHost,
    isOverclocked,
    t,
} from "./chip.js";
import { installChip, promptInstall } from "./install.js";

function tag(text, cssClass) {
    return `<span class="sf2e-spell-chip-tag ${cssClass}">${escapeHTML(text)}</span>`;
}

function chipTags(chip) {
    const tags = [];
    if (isChipDestroyed(chip)) tags.push(tag(t("Status.Destroyed"), "destroyed"));
    else if (isChipBroken(chip)) tags.push(tag(t("Status.Broken"), "broken"));

    const device = getDevice(chip);
    tags.push(
        device
            ? tag(t("Status.InstalledIn", { device: device.name }), "installed")
            : tag(t("Status.NotInstalled"), "not-installed"),
    );
    if (isOverclocked(chip) && !isChipDestroyed(chip)) tags.push(tag(t("Status.Overclocked"), "overclocked"));
    return tags.join("");
}

/** Put status tags on their own line under the item's name so they never squeeze the row's controls */
function addTags(row, tagsHTML) {
    const anchor = row.querySelector(":scope > .data > .item-name h4") ?? row.querySelector(":scope > .data > .item-name");
    anchor?.insertAdjacentHTML("beforeend", `<div class="sf2e-spell-chip-tags">${tagsHTML}</div>`);
}

/** Add chip status and the install control to the inventory of a system actor sheet */
export function onRenderActorSheet(sheet, html) {
    const root = html?.[0] ?? html;
    const actor = sheet.actor;
    const section = root?.querySelector?.("section[data-inventory]");
    if (!actor || !section) return;

    const chips = actorChips(actor);
    if (chips.length === 0) return;
    const chipByDevice = new Map(chips.map((c) => [getFlag(c, FLAGS.installedIn), c]));

    for (const row of section.querySelectorAll("li[data-item-id]")) {
        const item = actor.items.get(row.dataset.itemId);
        if (!item) continue;

        if (isChip(item)) {
            addTags(row, chipTags(item));
            const controls = row.querySelector(":scope > .data > .item-controls:not(.readonly)");
            if (controls && sheet.isEditable) {
                const control = document.createElement("a");
                control.dataset.tooltip = t("Install.Control");
                control.innerHTML = `<i class="fa-solid fa-microchip fa-fw"></i>`;
                control.classList.toggle("active", !!getDevice(item));
                control.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    promptInstall(item);
                });
                controls.prepend(control);
            }
        } else if (chipByDevice.has(item.id)) {
            const chip = chipByDevice.get(item.id);
            addTags(row, tag(t("Status.Holds", { chip: chip.name }), "holds"));
        }
    }

    if (sheet.isEditable) {
        section.addEventListener("drop", (event) => onInventoryDrop(event, actor), true);
    }
}

/** Dragging a chip onto a comm unit or computer in the same inventory installs it there */
function onInventoryDrop(event, actor) {
    let data;
    try {
        data = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "");
    } catch {
        return;
    }
    if (data?.type !== "Item" || !data.fromInventory || typeof data.uuid !== "string") return;

    const chip = fromUuidSync(data.uuid);
    if (!isChip(chip) || chip.actor !== actor) return;

    const row = event.target?.closest?.("li[data-item-id]");
    const device = actor.items.get(row?.dataset.itemId ?? "");
    if (!device || device === chip || !isHost(device)) return;

    installChip(chip, device);
}
