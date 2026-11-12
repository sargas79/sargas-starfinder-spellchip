import { FLAGS } from "./constants.js";
import { actorChips, escapeHTML, flagPath, getDevice, getFlag, getInstalledChip, isChip, isHost, t } from "./chip.js";
import { findOccupant } from "./logic.js";

/**
 * Install a chip in a device on the same actor. Each device holds one chip.
 * @returns {Promise<boolean>} Whether the chip ended up installed in the device
 */
export async function installChip(chip, device) {
    const actor = chip.actor;
    if (!actor || device?.actor !== actor) return false;
    if (!isHost(device)) {
        ui.notifications.warn(t("Install.NotAHost", { device: device.name }));
        return false;
    }
    if (getFlag(chip, FLAGS.installedIn) === device.id) return true;

    const chips = actorChips(actor).map((c) => ({ id: c.id, installedIn: getFlag(c, FLAGS.installedIn) ?? null }));
    const occupant = findOccupant(chips, device.id, chip.id);
    if (occupant) {
        const names = { device: device.name, chip: actor.items.get(occupant.id)?.name ?? "" };
        ui.notifications.warn(t("Install.DeviceOccupied", names));
        return false;
    }

    await chip.update({ [flagPath(FLAGS.installedIn)]: device.id });
    ui.notifications.info(t("Install.Installed", { chip: chip.name, device: device.name }));
    return true;
}

export async function uninstallChip(chip) {
    if (!getFlag(chip, FLAGS.installedIn)) return;
    await chip.update({ [flagPath(FLAGS.installedIn)]: null });
    ui.notifications.info(t("Install.Uninstalled", { chip: chip.name }));
}

/** Ask which device to install a chip in. A GM can also pick other gear, marking it as a chip host. */
export async function promptInstall(chip) {
    const actor = chip.actor;
    if (!actor) return;

    const current = getDevice(chip);
    const physical = actor.items.filter((i) => i.isOfType("physical") && !isChip(i));
    const hosts = physical.filter((i) => isHost(i));
    const others = game.user.isGM ? physical.filter((i) => i.isOfType("equipment") && !isHost(i)) : [];
    if (hosts.length === 0 && others.length === 0) {
        ui.notifications.warn(t("Install.NoHosts", { actor: actor.name }));
        return;
    }

    const option = (item) => {
        const occupant = getInstalledChip(item);
        const taken = !!occupant && occupant !== chip;
        const label = taken ? t("Install.Occupied", { device: item.name, chip: occupant.name }) : item.name;
        const attrs = [taken ? "disabled" : "", item === current ? "selected" : ""].join(" ");
        return `<option value="${item.id}" ${attrs}>${escapeHTML(label)}</option>`;
    };
    const otherGroup = others.length
        ? `<optgroup label="${escapeHTML(t("Install.OtherGear"))}">${others.map(option).join("")}</optgroup>`
        : "";
    const content = `
        <div class="form-group">
            <label for="sf2e-spell-chip-device">${escapeHTML(t("Install.Label"))}</label>
            <div class="form-fields">
                <select id="sf2e-spell-chip-device" name="device">
                    <option value="">${escapeHTML(t("Install.None"))}</option>
                    ${hosts.map(option).join("")}
                    ${otherGroup}
                </select>
            </div>
        </div>`;

    const choice = await foundry.applications.api.DialogV2.prompt({
        window: { title: t("Install.Title", { chip: chip.name }) },
        content,
        ok: {
            label: t("Install.Confirm"),
            icon: "fa-solid fa-microchip",
            callback: (_event, button) => button.form.elements.device.value,
        },
        rejectClose: false,
    });
    if (choice === null || choice === undefined) return;

    if (choice === "") return uninstallChip(chip);
    const device = actor.items.get(choice);
    if (!device) return;
    if (!isHost(device)) {
        if (!game.user.isGM) return;
        await device.update({ [flagPath(FLAGS.host)]: true });
    }
    return installChip(chip, device);
}

/** A chip arriving on an actor cannot still be installed in a device its previous owner had */
export function onPreCreateItem(item) {
    if (!isChip(item)) return;
    const deviceId = getFlag(item, FLAGS.installedIn);
    if (deviceId && !item.parent?.items?.get(deviceId)) {
        item.updateSource({ [flagPath(FLAGS.installedIn)]: null });
    }
}

/** Removing a device uninstalls the chip that was in it */
export function onDeleteItem(item, _options, userId) {
    if (userId !== game.user.id) return;
    const actor = item.parent;
    if (!actor?.items || isChip(item)) return;
    const updates = actorChips(actor)
        .filter((c) => getFlag(c, FLAGS.installedIn) === item.id)
        .map((c) => ({ _id: c.id, [flagPath(FLAGS.installedIn)]: null }));
    if (updates.length) actor.updateEmbeddedDocuments("Item", updates);
}

/** A night's rest clears the "overclocked today" mark. The system restores the daily charge itself. */
export function onRest(actor) {
    if (!actor?.isOwner) return;
    const updates = actorChips(actor)
        .filter((c) => getFlag(c, FLAGS.overclocked) === true)
        .map((c) => ({ _id: c.id, [flagPath(FLAGS.overclocked)]: false }));
    if (updates.length) actor.updateEmbeddedDocuments("Item", updates);
}
