import { ButtonInteraction, GuildMember, MessageButton, MessageEmbed } from "discord.js";
import Room, { Action, DelayAction, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { Rooms } from "./utils";

enum LaserStates {
	IDLE = "idle",
	ARMED = "armed",
	DAMAGED = "damaged",
}
enum ActionStates {
	READY = "ready",
	DAMAGED = "damaged",
}

export default async function roomMaindeck(spaceSquirrels: SpaceSquirrels) {
	const maindeck = new Room({
		name: "Main Deck",
		channelId: "915018583489273937",
		messageId: "915156870082203658",
		threadId: "915156966375043072",
		messageContent: spaceSquirrels.getMessage("maindeck-description"),
		actionRows: [
			await spaceSquirrels.getNavigation(Rooms.MAINDECK),
			await getMaindeckLasers.bind(spaceSquirrels)(0),
			await getMaindeckLasers.bind(spaceSquirrels)(5),
			await getMaindeckActions.bind(spaceSquirrels)(),
		],
	}, spaceSquirrels.client, spaceSquirrels.redis)

	return maindeck;
}

async function getMaindeckLasers(this: SpaceSquirrels, offset: number): Promise<Action[]> {
	const laserStates = await this.redis.lrange("mm-space:maindeck-laser-status", 0 + offset, 4 + offset) as LaserStates[];

	return laserStates.map((state, index) => {
		let id: string;
		switch (state) {
			case LaserStates.IDLE:
				id = `space-maindeck-laser-${index + offset}-arm`;
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🕹").setLabel("Arm Laser").setStyle("SECONDARY"),
					exclusiveId: `maindeck-laser-arm-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
					question: this.getMessage("maindeck-laser-arm-question"),
					choices: [{
						button: new MessageButton().setCustomId(id + "_heat").setLabel("Heat Mode").setStyle("SECONDARY"),
						delay: 25,
						delayWaitMessage: this.getMessage("maindeck-laser-arm-wait", "Heat"),
						delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
						exclusiveId: `maindeck-laser-arm-${index + offset}`,
						exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
						callback: callbackMaindeckLasers.bind(this),
					}, {
						button: new MessageButton().setCustomId(id + "_hook").setLabel("Hook Mode").setStyle("SECONDARY"),
						delay: 25,
						delayWaitMessage: this.getMessage("maindeck-laser-arm-wait", "Hook"),
						delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
						exclusiveId: `maindeck-laser-arm-${index + offset}`,
						exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
						callback: callbackMaindeckLasers.bind(this),
					}, {
						button: new MessageButton().setCustomId(id + "_thunder").setLabel("Thunder Mode").setStyle("SECONDARY"),
						delay: 25,
						delayWaitMessage: this.getMessage("maindeck-laser-arm-wait", "Thunder"),
						delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
						exclusiveId: `maindeck-laser-arm-${index + offset}`,
						exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
						callback: callbackMaindeckLasers.bind(this),
					}, {
						button: new MessageButton().setCustomId(id + "_suck").setLabel("Suck Mode").setStyle("SECONDARY"),
						delay: 25,
						delayWaitMessage: this.getMessage("maindeck-laser-arm-wait", "Suck"),
						delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
						exclusiveId: `maindeck-laser-arm-${index + offset}`,
						exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
						callback: callbackMaindeckLasers.bind(this),
					}, {
						button: new MessageButton().setCustomId(id + "_punch").setLabel("Punch Mode").setStyle("SECONDARY"),
						delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
						exclusiveId: `maindeck-laser-arm-${index + offset}`,
						exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
						question: this.getMessage("maindeck-laser-punch-question"),
						choices: [{
							button: new MessageButton().setCustomId(id + "_punch_yes").setLabel("Yes").setStyle("PRIMARY"),
							delay: 25,
							delayWaitMessage: this.getMessage("maindeck-laser-arm-wait", "Punch"),
							delayDenyMessage: this.getMessage("maindeck-laser-arm-delay"),
							exclusiveId: `maindeck-laser-arm-${index + offset}`,
							exclusiveDenyMessage: this.getMessage("maindeck-laser-arm-exclusive"),
							callback: callbackMaindeckLasers.bind(this),
						}, {
							button: new MessageButton().setCustomId(id + "_punch_no").setLabel("No").setStyle("PRIMARY"),
							callback: callbackMaindeckLasers.bind(this),
						}],
					}]
				}
			case LaserStates.ARMED:
				id = `space-maindeck-laser-${offset + index}-unload`;
				return {
					button: new MessageButton().setCustomId(id).setEmoji("⭕").setLabel("Unload Laser").setStyle("SUCCESS"),
					exclusiveId: `maindeck-laser-unload-${offset + index}`,
					exclusiveDenyMessage: this.getMessage("maindeck-laser-unload-exclusive"),
					delay: 20,
					delayWaitMessage: this.getMessage("maindeck-laser-unload-wait"),
					delayDenyMessage: this.getMessage("maindeck-laser-unload-delay"),
					callback: callbackMaindeckLasers.bind(this),
				}
			case LaserStates.DAMAGED:
				id = `space-maindeck-laser-${offset + index}-repair`;
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🛠").setLabel("Repair Laser").setStyle("DANGER"),
					delay: 30,
					delayWaitMessage: this.getMessage("maindeck-laser-repair-wait"),
					delayDenyMessage: this.getMessage("maindeck-laser-repair-delay"),
					exclusiveId: "maindeck-laser-repair",
					exclusiveDenyMessage: this.getMessage("maindeck-laser-repair-exclusive"),
					callback: callbackMaindeckLasers.bind(this),
				}
		}
	});
}

async function getMaindeckActions(this: SpaceSquirrels): Promise<Action[]> {
	const [
		poopdeck, sails, traps,
	] = await Promise.all([
		this.redis.get("mm-space:maindeck-poopdeck-status"),
		this.redis.get("mm-space:maindeck-sails-status"),
		this.redis.get("mm-space:maindeck-traps-status"),
	]) as [ActionStates, ActionStates, ActionStates];

	return [{
		button: new MessageButton().setCustomId(`space-maindeck-poopdeck-${poopdeck !== ActionStates.DAMAGED ? "scrub" : "repair"}`).setEmoji(poopdeck !== ActionStates.DAMAGED ? "🧹" : "🛠").setLabel(`${poopdeck !== ActionStates.DAMAGED ? "Scrub" : "Repair"} Poopdeck`).setStyle(poopdeck !== ActionStates.DAMAGED ? "PRIMARY" : "DANGER"),
		delay: 20,
		delayWaitMessage: this.getMessage("maindeck-poopdeck-wait", poopdeck),
		delayDenyMessage: this.getMessage("maindeck-poopdeck-delay", poopdeck),
		exclusiveId: "maindeck-poopdeck-scrub",
		exclusiveDenyMessage: this.getMessage("maindeck-poopdeck-scrub-exclusive", poopdeck),
		callback: callbackMaindeckPoopdeck.bind(this),
	}, {
		button: new MessageButton().setCustomId(`space-maindeck-sails-${sails !== ActionStates.DAMAGED ? "brace" : "repair"}`).setEmoji("⛵").setLabel(`${sails !== ActionStates.DAMAGED ? "Brace" : "Repair"} Sails`).setStyle(sails !== ActionStates.DAMAGED ? "PRIMARY" : "DANGER"),
		delayDenyMessage: this.getMessage("maindeck-sails-delay", sails),
		callback: callbackMaindeckSails.bind(this),
	}, traps !== ActionStates.DAMAGED ? {
		button: new MessageButton().setCustomId(`space-maindeck-traps-search`).setEmoji("🔎").setLabel("Search for Traps").setStyle("PRIMARY"),
		delay: 20,
		delayWaitMessage: this.getMessage("maindeck-traps-search-wait"),
		delayDenyMessage: this.getMessage("maindeck-traps-search-delay"),
		callback: callbackMaindeckTraps.bind(this),
	} : {
		button: new MessageButton().setCustomId(`space-maindeck-traps-repair`).setEmoji("🛠").setLabel("Search for \"Search for Traps\"-Button").setStyle("DANGER"),
		delay: 30,
		delayWaitMessage: this.getMessage("maindeck-traps-repair-wait"),
		delayDenyMessage: this.getMessage("maindeck-traps-repair-delay"),
		exclusiveId: "maindeck-traps-repair",
		exclusiveDenyMessage: this.getMessage("maindeck-traps-repair-exclusive"),
		callback: callbackMaindeckTraps.bind(this),
	}]
}

async function callbackMaindeckLasers(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
	const [, , , indexStr, type] = action.button.customId!.split("-") as string[];
	const index = parseInt(indexStr);
	if (type.startsWith("arm")) {
		let message: string | MessageEmbed;
		if (!type.endsWith("no")) {
			await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.ARMED);
			const actionRow = await getMaindeckLasers.bind(this)((index < 5) ? 0 : 5);
			this.rooms.maindeck.actions[(index < 5) ? 1 : 2] = actionRow;;
			this.rooms.maindeck.addActionsRecursive(actionRow);
			this.rooms.maindeck.updateMessage();

			const [, mode] = type.split("_");
			this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has loaded a <span class="system">laser grappler</span> in <span class="special">${mode} mode</span>`);
			message = this.getMessage("maindeck-laser-arm", mode[0].toUpperCase() + mode.slice(1));
		} else {
			message = this.getMessage("maindeck-laser-cancel");
		}

		const editMessage = interactionEdit(message);
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "unload") {
		await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.IDLE);
		const actionRow = await getMaindeckLasers.bind(this)((index < 5) ? 0 : 5);
		this.rooms.maindeck.actions[(index < 5) ? 1 : 2] = actionRow;;
		this.rooms.maindeck.addActionsRecursive(actionRow);
		this.rooms.maindeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has unloaded a <span class="system">laser grappler</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-laser-unload"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.IDLE);
		const actionRow = await getMaindeckLasers.bind(this)((index < 5) ? 0 : 5);
		this.rooms.maindeck.actions[(index < 5) ? 1 : 2] = actionRow;
		this.rooms.maindeck.addActionsRecursive(actionRow);
		this.rooms.maindeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired a <span class="system">laser grappler</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-laser-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}

}

async function callbackMaindeckPoopdeck(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
	const [, , , type] = action.button.customId!.split("-") as string[];
	if (type === "scrub") {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has scrubbed the <span class="system">poopdeck</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-poopdeck-scrub"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.set("mm-space:maindeck-poopdeck-status", ActionStates.READY);
		const actionRow = await getMaindeckActions.bind(this)();
		this.rooms.maindeck.actions[3][0] = actionRow[0];
		this.rooms.maindeck.addActionsRecursive(actionRow[0]);
		this.rooms.maindeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired the <span class="system">poopdeck</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-poopdeck-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

async function callbackMaindeckSails(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
	const [, , , type] = action.button.customId!.split("-") as string[];
	if (type === "brace") {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> is bracing the <span class="system">sails</span>`);

		let editMessage = interactionEdit(this.getMessage("maindeck-sails-brace"));
		if (interaction.replied) interaction.editReply(editMessage)
		else interaction.reply({ ...editMessage, ephemeral: true });
		this.redis.set(`mm-space:delay-${interaction.user.id}`, action.button.customId!, "EX", 20);
		currentRoom.activeInteractions.set(interaction.user.id, [action, interaction]);
		await new Promise(resolve => setTimeout(resolve, 20000));

		if (!currentRoom.activeInteractions.delete(interaction.user.id)) return; // if the interaction is not in the set anymore, it has been cancelled

		editMessage = interactionEdit(this.getMessage("maindeck-sails-done"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	} else if (type === "repair") {
		const delayError = !!(await this.redis.get(`mm-space:delay-${interaction.user.id}`));
		if (delayError) {
			const val = this.rooms.maindeck.activeInteractions.get(interaction.user.id)
			if (val) return interaction.reply({...interactionEdit((val[0] as DelayAction).delayDenyMessage), ephemeral: true});
			return interaction.reply({...interactionEdit("You are currently waiting for another action to finish."), ephemeral: true});
		}

		const userId = await this.redis.get(`mm-space:exclusive-${"maindeck-sails-repair-exclusive"}`);
		if (userId) {
			let message: string | MessageEmbed;
			const exclusiveDenyMessage = this.getMessage("maindeck-sails-repair-exclusive");
			if (typeof exclusiveDenyMessage === "string") {
				message = exclusiveDenyMessage.replace(/\$\{user\}/g, `<@${userId}>`);
			} else {
				message = exclusiveDenyMessage;
				if (message.description) message.description = message.description.replace(/\$\{user\}/g, `<@${userId}>`);
			}
			return interaction.reply({...interactionEdit(message), ephemeral: true});
		}


		let editMessage = interactionEdit(this.getMessage("maindeck-sails-repair-wait"));
		if (interaction.replied) interaction.editReply(editMessage)
		else interaction.reply({ ...editMessage, ephemeral: true });

		this.redis.set(`mm-space:delay-${interaction.user.id}`, action.button.customId!, "EX", 30);
		currentRoom.activeInteractions.set(interaction.user.id, [action, interaction]);
		await new Promise(resolve => setTimeout(resolve, 30000));

		if (!currentRoom.activeInteractions.delete(interaction.user.id)) return; // if the interaction is not in the set anymore, it has been cancelled

		await this.redis.set("mm-space:maindeck-sails-status", ActionStates.READY);
		const actionRow = await getMaindeckActions.bind(this)();
		this.rooms.maindeck.actions[3][1] = actionRow[1];
		this.rooms.maindeck.addActionsRecursive(actionRow[1]);
		this.rooms.maindeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired the <span class="system">sails</span>`);

		editMessage = interactionEdit(this.getMessage("maindeck-sails-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

async function callbackMaindeckTraps(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
	const [, , , type] = action.button.customId!.split("-") as string[];
	if (type === "search") {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> didn't find any <span class="system">traps</span>`);

		const invisbleTrapsAction = {
			button: new MessageButton().setCustomId("space-maindeck-traps-invisible").setEmoji("🔍").setLabel("Search for Invisible Traps").setStyle("PRIMARY"),
			delay: 30,
			delayWaitMessage: this.getMessage("maindeck-traps-invisible-wait"),
			delayDenyMessage: this.getMessage("maindeck-traps-search-delay"),
			callback: callbackMaindeckTraps.bind(this),
		};
		const editMessage = interactionEdit(this.getMessage("maindeck-traps-search"), invisbleTrapsAction);
		currentRoom.addActionsRecursive(invisbleTrapsAction);
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type.endsWith("invisible")) {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> didn't find any <span class="system">invisible traps</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-traps-invisible"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.set("mm-space:maindeck-traps-status", ActionStates.READY);
		const actionRow = await getMaindeckActions.bind(this)();
		this.rooms.maindeck.actions[3][2] = actionRow[2];
		this.rooms.maindeck.addActionsRecursive(actionRow[2]);
		this.rooms.maindeck.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired the <span class="system">traps</span>`);

		const editMessage = interactionEdit(this.getMessage("maindeck-traps-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

export async function maindeckRepairLaser(this: SpaceSquirrels, index: number) {
	console.log(`Repairing laser ${index}`);
	await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.IDLE);
	const newAction = (await getMaindeckLasers.bind(this)(Math.floor(index / 5)*5))[index%5];
	this.rooms.maindeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.maindeck.addActionsRecursive(newAction);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`A <span class="system">Laser Grappler</span> has been repaired`);
}

export async function maindeckDamageLaser(this: SpaceSquirrels, index: number) {
	console.log(`Damaging laser ${index}`);
	await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.DAMAGED);
	const newAction = (await getMaindeckLasers.bind(this)(Math.floor(index / 5)*5))[index%5];
	this.rooms.maindeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.maindeck.addActionsRecursive(newAction);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`A <span class="system">Laser Grappler</span> has been <span class="bad">damaged</span>`);
}

export async function maindeckFireLaser(this: SpaceSquirrels, index: number) {
	console.log(`Firing laser ${index}`);
	await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.IDLE);
	const newAction = (await getMaindeckLasers.bind(this)(index))[0];
	this.rooms.maindeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.maindeck.addActionsRecursive(newAction);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`Captain <span class="${this.shipMode}">${this.shipMode}</span> has <span class="good">fired</span> a <span class="system">Laser Grappler</span>`);
}

export async function maindeckUnloadLaser(this: SpaceSquirrels, index: number) {
	console.log(`Unloading laser ${index}`);
	await this.redis.lset("mm-space:maindeck-laser-status", index, LaserStates.IDLE);
	const newAction = (await getMaindeckLasers.bind(this)(index))[0];
	this.rooms.maindeck.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.maindeck.addActionsRecursive(newAction);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`A <span class="system">Laser Grappler</span> has unloaded itself`);
}

export async function maindeckDamagePoopdeck(this: SpaceSquirrels) {
	console.log(`Damaging poopdeck`);
	await this.redis.set("mm-space:maindeck-poopdeck-status", ActionStates.DAMAGED);
	const action = (await getMaindeckActions.bind(this)())[0];
	this.rooms.maindeck.actions[3][0] = action;
	this.rooms.maindeck.addActionsRecursive(action);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`The <span class="system">Poop Deck</span> has been <span class="bad">damaged</span>`);
}

export async function maindeckRepairPoopdeck(this: SpaceSquirrels) {
	console.log(`Repairing poopdeck`);
	await this.redis.set("mm-space:maindeck-poopdeck-status", ActionStates.READY);
	const action = (await getMaindeckActions.bind(this)())[0];
	this.rooms.maindeck.actions[3][0] = action;
	this.rooms.maindeck.addActionsRecursive(action);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`The <span class="system">Poop Deck</span> has been repaired`);
}

export async function maindeckDamageSails(this: SpaceSquirrels) {
	console.log(`Damaging sails`);
	await this.redis.set("mm-space:maindeck-sails-status", ActionStates.DAMAGED);
	const action = (await getMaindeckActions.bind(this)())[1];
	this.rooms.maindeck.actions[3][1] = action;
	this.rooms.maindeck.addActionsRecursive(action);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`The ship's <span class="system">Main Sails</span> have been <span class="bad">damaged</span>`);
}

export async function maindeckRepairSails(this: SpaceSquirrels) {
	console.log(`Repairing sails`);
	await this.redis.set("mm-space:maindeck-sails-status", ActionStates.READY);
	const action = (await getMaindeckActions.bind(this)())[1];
	this.rooms.maindeck.actions[3][1] = action;
	this.rooms.maindeck.addActionsRecursive(action);
	this.rooms.maindeck.updateMessage();

	this.logger.log(`The ship's <span class="system">Sails</span> have been repaired`);
}

export async function maindeckGetDamagableSystems(this: SpaceSquirrels) {
	const actions = (await this.redis.lrange("mm-space:maindeck-laser-status", 0, 9))
		.filter(status => status !== LaserStates.DAMAGED)
		.map((status, index) => maindeckDamageLaser.bind(this, index));

	
	if (await this.redis.get("mm-space:maindeck-poopdeck-status") !== ActionStates.DAMAGED)
		actions.push(maindeckDamagePoopdeck.bind(this));

	if (await this.redis.get("mm-space:maindeck-sails-status") !== ActionStates.DAMAGED)
		actions.push(maindeckDamageSails.bind(this));

	return actions;
}