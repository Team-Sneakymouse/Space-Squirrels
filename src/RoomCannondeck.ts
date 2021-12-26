import { ButtonInteraction, GuildMember, MessageButton, MessageEmbed } from "discord.js";
import Room, { Action, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { Rooms } from "./utils";

enum CannonStates {
	IDLE = "idle",
	ARMED = "armed",
	DAMAGED = "damaged",
}

export default async function roomCannondeck(spaceSquirrels: SpaceSquirrels) {
	const cannondeck = new Room({
		name: "Cannon Deck",
		channelId: "915022975697289276",
		messageId: "915024737653100545",
		threadId: "915157203571318842",
		messageContent: spaceSquirrels.getMessage("cannondeck-description"),
		actionRows: [
			await spaceSquirrels.getNavigation(Rooms.CANNONDECK),
			await getCannondeckCannons.bind(spaceSquirrels)(0),
			await getCannondeckCannons.bind(spaceSquirrels)(5),
			await getCannondeckCannons.bind(spaceSquirrels)(10),
			await getCannondeckCannons.bind(spaceSquirrels)(15),
		],
	}, spaceSquirrels.client, spaceSquirrels.redis)

	return cannondeck;
}

async function getCannondeckCannons(this: SpaceSquirrels, offset: number): Promise<Action[]> {
	const cannonStates = await this.redis.lrange("mm-space:cannondeck-cannon-status", 0 + offset, 4 + offset) as CannonStates[];

	return cannonStates.map((state, index) => {
		let id = `space-cannondeck-cannon-${index + offset}`;
		switch (state) {
			case CannonStates.IDLE:
				id += "-arm"
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🧨").setLabel("Arm Cannon").setStyle("SECONDARY"),
					exclusiveId: `cannondeck-cannon-arm-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("cannondeck-cannon-arm-exclusive"),
					question: this.getMessage("cannondeck-cannon-arm-question"),
					choices: ["Explosive", "Energy", "Termites", "Ammo Slot 4", "Ammo Slot 5"].map(ammo => {
						return {
							button: new MessageButton().setCustomId(`${id}_${ammo.toLowerCase()}`).setLabel(ammo).setStyle("PRIMARY").setDisabled(ammo.startsWith("Ammo Slot")),
							exclusiveId: `cannondeck-cannon-arm-${index + offset}`,
							exclusiveDenyMessage: this.getMessage("cannondeck-cannon-arm-exclusive"),
							delay: 30,
							delayWaitMessage: this.getMessage("cannondeck-cannon-arm-wait", ammo),
							delayDenyMessage: this.getMessage("cannondeck-cannon-arm-delay"),
							callback: callbackCannondeckCannons.bind(this),
						}
					})
				}
			case CannonStates.ARMED:
				id += "-unload"
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🧤").setLabel("Unload Cannon").setStyle("SUCCESS"),
					exclusiveId: `cannondeck-cannon-unload-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("cannondeck-cannon-unload-exclusive"),
					delay: 30,
					delayWaitMessage: this.getMessage("cannondeck-cannon-unload-wait"),
					delayDenyMessage: this.getMessage("cannondeck-cannon-unload-delay"),
					callback: callbackCannondeckCannons.bind(this),
				}
			case CannonStates.DAMAGED:
				id += "-repair"
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🛠").setLabel("Repair Cannon").setStyle("DANGER"),
					exclusiveId: `cannondeck-cannon-repair-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("cannondeck-cannon-repair-exclusive"),
					delay: 30,
					delayWaitMessage: this.getMessage("cannondeck-cannon-repair-wait"),
					delayDenyMessage: this.getMessage("cannondeck-cannon-repair-delay"),
					callback: callbackCannondeckCannons.bind(this)
				}
		}
	})
}

async function callbackCannondeckCannons(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , indexStr, type] = action.button.customId!.split("-") as string[];
	const index = parseInt(indexStr);

	if (type.startsWith("arm")) {
		await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.ARMED);
		const newAction = (await getCannondeckCannons.bind(this)(index))[0];
		this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
		this.rooms.cannondeck.addActionsRecursive(newAction);
		this.rooms.cannondeck.updateMessage();

		const ammo = action.button.label!;
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has armed a <span class="system">Meteor Cannon</span> with <span class="special">${ammo}</span> Ammo`);

		const editMessage = interactionEdit(this.getMessage("cannondeck-cannon-arm", ammo));
		if (interaction.replied) return interaction.editReply(editMessage);
		return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "unload") {
		await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.IDLE);
		const newAction = (await getCannondeckCannons.bind(this)(index))[0];
		this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
		this.rooms.cannondeck.addActionsRecursive(newAction);
		this.rooms.cannondeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has unloaded a <span class="system">Meteor Cannon</span>`);

		const editMessage = interactionEdit(this.getMessage("cannondeck-cannon-unload"));
		if (interaction.replied) return interaction.editReply(editMessage);
		return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.IDLE);
		const newAction = (await getCannondeckCannons.bind(this)(index))[0];
		this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
		this.rooms.cannondeck.addActionsRecursive(newAction);
		this.rooms.cannondeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired a <span class="system">Meteor Cannon</span>`);

		const editMessage = interactionEdit(this.getMessage("cannondeck-cannon-repair"));
		if (interaction.replied) return interaction.editReply(editMessage);
		return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

export async function cannondeckRepairCannon(this: SpaceSquirrels, index: number) {
	console.log(`Repairing cannon ${index}`);
	await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.IDLE);
	const newAction = (await getCannondeckCannons.bind(this)(index))[0];
	this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.cannondeck.addActionsRecursive(newAction);
	this.rooms.cannondeck.updateMessage();

	this.logger.log(`A <span class="system">Meteor Cannon</span> has been repaired`);
}

export async function cannondeckDamageCannon(this: SpaceSquirrels, index: number) {
	console.log(`Damaging cannon ${index}`);
	await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.DAMAGED);
	const newAction = (await getCannondeckCannons.bind(this)(index))[0];
	this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.cannondeck.addActionsRecursive(newAction);
	this.rooms.cannondeck.updateMessage();

	this.logger.log(`A <span class="system">Meteor Cannon</span> has been damaged`);
}

export async function cannondeckFireCannon(this: SpaceSquirrels, index: number) {
	console.log(`Firing cannon ${index}`);
	await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.IDLE);
	const newAction = (await getCannondeckCannons.bind(this)(index))[0];
	this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.cannondeck.addActionsRecursive(newAction);
	this.rooms.cannondeck.updateMessage();

	this.logger.log(`Captain <span class="${this.shipMode}">${this.shipMode}</span> has <span class="good">fired</span> a <span class="system">Meteor Cannon</span>`);
}

export async function cannondeckUnloadCannon(this: SpaceSquirrels, index: number) {
	console.log(`Unloading cannon ${index}`);
	await this.redis.lset(`mm-space:cannondeck-cannon-status`, index, CannonStates.IDLE);
	const newAction = (await getCannondeckCannons.bind(this)(index))[0];
	this.rooms.cannondeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.cannondeck.addActionsRecursive(newAction);
	this.rooms.cannondeck.updateMessage();

	this.logger.log(`A <span class="system">Meteor Cannon</span> has unloaded itself`);
}

export async function cannondeckGetDamagableSystems(this: SpaceSquirrels) {
	const actions = (await this.redis.lrange("mm-space:cannondeck-cannon-status", 0, 19))
		.filter(status => status !== CannonStates.DAMAGED)
		.map((status, index) => cannondeckDamageCannon.bind(this, index));

	return actions;
}