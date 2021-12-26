import { ButtonInteraction, GuildMember, MessageButton } from "discord.js";
import Room, { Action, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { Rooms } from "./utils";

enum ActionStates {
	READY = "ready",
	DAMAGED = "damaged",
}
const ShieldActions = [
	{name: "Boost", noun: "Boosting", verb: "boosted", choices: [ "Front Array", "Portside", "Starboard", "Rear Axis", "All Systems" ]},
	{name: "Energize", noun: "Energization", verb: "energized", choices: [ "Shield Battery", "Gem Core", "Backup Core", "Energy Banks", "Crew's Lifeforce" ]},
	{name: "Calibrate", noun: "Frequency Calibration", verb: "calibrated", choices: [ "5", "69", "420", "10-7-9-8-7-9-6-4-5-4-4-2-3-5-2-1-1-5", "Random" ]},
	{name: "Enhance", noun: "Enhancement", verb: "enhanced", choices: [ "Heat Absorbtion", "Matter Deflector", "Magnetic Intercode", "Brace Barrier", "Arcano Signal" ]},
	{name: "Brace", noun: "Impact Bracing", verb: "braced", choices: [ "Front Array", "Port Side", "Starboard", "Rear Axis", "All Systems" ]},
	{name: "Amplify", noun: "Amplification", verb: "amplified", choices: [ "are_you_new_then_run_this_script_to_boost_shields_rookie.bat", "math.webm", "Stress2.ogg", "/vpn m5", "horseWarsProtocolAlpha.exe" ]},
	{name: "Restore", noun: "Restoration", verb: "restored", choices: [ "Shield Battery", "Gem Core", "Backup Core", "Energy Banks", "Crew's Lifeforce" ]},
	{name: "Remix", noun: "Remixing", verb: "remixed", choices: [ "Invert", "Copy Cat", "Reverse", "Flicker", "Spin" ]},
	{name: "Vibrate", noun: "Vibration", verb: "vibrated", choices: [ "MLM Standard", "Slow Pulse Beat", "Jackhammer", "Quake & Ripple", "Random Patterns" ]},
	{name: "Focus", noun: "Focusing", verb: "focused", choices: [ "Physical Patterns", "Magical Patterns", "Divine Patterns", "Chaos Patterns", "Unknown Patterns" ]},
]

export default async function roomEnginebay(spaceSquirrels: SpaceSquirrels) {
	const enginebay = new Room({
		name: "Engine Bay",
		channelId: "915016547456651274",
		messageId: "915157109564375060",
		threadId: "915157110449373234",
		messageContent: spaceSquirrels.getMessage("enginebay-description"),
		actionRows: [
			await spaceSquirrels.getNavigation(Rooms.ENGINEBAY),
			await getEnginebayShields.bind(spaceSquirrels)(0),
			await getEnginebayShields.bind(spaceSquirrels)(5),
			await getEnginebayActions.bind(spaceSquirrels)(),
		],
	}, spaceSquirrels.client, spaceSquirrels.redis)

	return enginebay;
}

async function getEnginebayShields(this: SpaceSquirrels, offset: number): Promise<Action[]> {
	const laserStates = await this.redis.lrange("mm-space:enginebay-shields-status", 0 + offset, 4 + offset) as ActionStates[];
	
	return laserStates.map((state, index) => {
		let id: string;
		switch (state) {
			case ActionStates.READY:
				id = `space-enginebay-shields-${index + offset}-run`;
				return {
					button: new MessageButton().setCustomId(id).setLabel(`${ShieldActions[index + offset].name} Shields`).setStyle("SUCCESS"),
					exclusiveId: `enginebay-shields-run-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("enginebay-shields-run-exclusive", ShieldActions[index + offset].verb),
					question: this.getMessage("enginebay-shields-run-question", ShieldActions[index + offset].name, ShieldActions[index + offset].noun),
					choices: ShieldActions[index + offset].choices.map((choice, choiceIndex) => {
						return {
							button: new MessageButton().setCustomId(`${id}_${choiceIndex}`).setLabel(choice).setStyle("PRIMARY"),
							delay: 20,
							delayWaitMessage: this.getMessage("enginebay-shields-run-wait", ShieldActions[index + offset].name, ShieldActions[index + offset].noun, choice),
							delayDenyMessage: this.getMessage("enginebay-shields-run-delay", ShieldActions[index + offset].verb),
							exclusiveId: `enginebay-shields-run-${index + offset}`,
							exclusiveDenyMessage: this.getMessage("enginebay-shields-run-exclusive", ShieldActions[index + offset].verb),
							callback: callbackEnginebayShields.bind(this),
						}
					}),
				}
			case ActionStates.DAMAGED:
				id = `space-enginebay-shields-${index + offset}-repair`;
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🛠").setLabel(`Repair Shields`).setStyle("DANGER"),
					delay: 30,
					delayWaitMessage: this.getMessage("enginebay-shields-repair-wait", ShieldActions[index + offset].noun),
					delayDenyMessage: this.getMessage("enginebay-shields-repair-delay"),
					exclusiveId: `enginebay-shields-repair-${index + offset}`,
					exclusiveDenyMessage: this.getMessage("enginebay-shields-repair-exclusive"),
					callback: callbackEnginebayShields.bind(this),
				}
		}
	})
}
async function callbackEnginebayShields(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , indexStr, type] = action.button.customId!.split("-") as string[];
	const index = parseInt(indexStr);

	if (type.startsWith("run")) {
		const [, modeId] = type.split("_");
		const mode = ShieldActions[index].choices[parseInt(modeId)];
		if (["Vibrate", "Focus", "Enhance", "Calibrate"].includes(ShieldActions[index].name))
			this.redis.set(`mm-space:enginebay-shields-${ShieldActions[index].name.toLowerCase()}`, mode);
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> ${ShieldActions[index].verb} the <span class="system">shields</span>: <span class="special">${mode}</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-shields-run", ShieldActions[index].name, ShieldActions[index].noun, mode));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
	if (type.startsWith("repair")) {
		await this.redis.lset("mm-space:enginebay-shields-status", index, ActionStates.READY);
		if (["Vibrate", "Focus", "Enhance", "Calibrate"].includes(ShieldActions[index].name))
			this.redis.set(`mm-space:enginebay-shields-${ShieldActions[index].name.toLowerCase()}`, ShieldActions[index].choices[Math.floor(Math.random() * ShieldActions[index].choices.length)]);
		const actionRow = await getEnginebayShields.bind(this)(index < 5 ? 0 : 5);
		this.rooms.enginebay.actions[(index < 5) ? 1 : 2][index % 5] = actionRow[index % 5];
		this.rooms.enginebay.addActionsRecursive(actionRow[index % 5]);
		this.rooms.enginebay.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> repaired a <span class="system">shield system</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-shields-repair", ShieldActions[index].noun));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}

async function getEnginebayActions(this: SpaceSquirrels): Promise<Action[]> {
	const [
		scanhull, polishgem, overcharge, ignitemana, drainfluids,
	] = await Promise.all([
		this.redis.get("mm-space:enginebay-scanhull-status"),
		this.redis.get("mm-space:enginebay-polishgem-status"),
		this.redis.get("mm-space:enginebay-overcharge-status"),
		this.redis.get("mm-space:enginebay-ignitemana-status"),
		this.redis.get("mm-space:enginebay-drainfluids-status"),
	]) as [ActionStates, ActionStates, ActionStates, ActionStates, ActionStates];

	return [
		scanhull !== ActionStates.DAMAGED ? {
			button: new MessageButton().setCustomId("space-enginebay-scanhull-run").setEmoji("🔮").setLabel("Scan Hull").setStyle("PRIMARY"),
			exclusiveId: "enginebay-scanhull-run",
			exclusiveDenyMessage: this.getMessage("enginebay-scanhull-run-exclusive"),
			question: this.getMessage("enginebay-scanhull-run-question"),
			choices: ["Danger", "Paranormal", "Time Variance", "Trechery", "Meta"].map(mode => {
				return {
					button: new MessageButton().setCustomId(`space-enginebay-scanhull-run_${mode.toLowerCase().replace(" ", "")}`).setLabel(mode).setStyle("PRIMARY"),
					delay: 20,
					delayWaitMessage: this.getMessage("enginebay-scanhull-run-wait", mode),
					delayDenyMessage: this.getMessage("enginebay-scanhull-run-delay", mode),
					exclusiveId: "enginebay-scanhull-run",
					exclusiveDenyMessage: this.getMessage("enginebay-scanhull-run-exclusive"),
					callback: callbackEnginebayScanHull.bind(this),
				}
			})
		} : {
			button: new MessageButton().setCustomId("space-enginebay-scanhull-repair").setEmoji("🛠").setLabel("Repair Hull Scanner").setStyle("DANGER"),
			delay: 30,
			delayWaitMessage: this.getMessage("enginebay-scanhull-repair-wait"),
			delayDenyMessage: this.getMessage("enginebay-scanhull-repair-delay"),
			exclusiveId: "enginebay-scanhull-repair",
			exclusiveDenyMessage: this.getMessage("enginebay-scanhull-repair-exclusive"),
			callback: callbackEnginebayScanHull.bind(this),
		},
		polishgem !== ActionStates.DAMAGED ? {
			button: new MessageButton().setCustomId("space-enginebay-polishgem-run").setEmoji("924428764786610177").setLabel("Polish Gem").setStyle("PRIMARY"),
			exclusiveId: "enginebay-polishgem-run",
			exclusiveDenyMessage: this.getMessage("enginebay-polishgem-run-exclusive"),
			question: this.getMessage("enginebay-polishgem-run-question"),
			choices: [{
				button: new MessageButton().setCustomId("space-enginebay-polishgem-run_yes").setLabel("Yes").setStyle("PRIMARY"),
				delay: 30,
				delayWaitMessage: this.getMessage("enginebay-polishgem-run-wait"),
				delayDenyMessage: this.getMessage("enginebay-polishgem-run-delay"),
				// @ts-ignore ???
				exclusiveId: "enginebay-polishgem-run",
				exclusiveDenyMessage: this.getMessage("enginebay-polishgem-run-exclusive"),
				callback: callbackEnginebayPolishGem.bind(this),
			}, {
				button: new MessageButton().setCustomId("space-enginebay-polishgem-run_no").setLabel("No").setStyle("PRIMARY"),
				callback: callbackEnginebayPolishGem.bind(this),
			}]
		} : {
			button: new MessageButton().setCustomId("space-enginebay-polishgem-repair").setEmoji("🛠").setLabel("Repair Gem Core").setStyle("DANGER"),
			delay: 30,
			delayWaitMessage: this.getMessage("enginebay-polishgem-repair-wait"),
			delayDenyMessage: this.getMessage("enginebay-polishgem-repair-delay"),
			exclusiveId: "enginebay-polishgem-repair",
			exclusiveDenyMessage: this.getMessage("enginebay-polishgem-repair-exclusive"),
			callback: callbackEnginebayPolishGem.bind(this),
		},
		{
			button: new MessageButton().setCustomId("space-enginebay-overcharge-run").setEmoji("🎆").setLabel("Overcharge").setStyle("DANGER"),
			exclusiveId: "enginebay-overcharge-run",
			exclusiveDenyMessage: this.getMessage("enginebay-overcharge-run-exclusive"),
			question: this.getMessage("enginebay-overcharge-run-question"),
			choices: [{
				button: new MessageButton().setCustomId("space-enginebay-overcharge-run_yes").setLabel("Yes").setStyle("PRIMARY"),
				delay: 45,
				delayWaitMessage: this.getMessage("enginebay-overcharge-run-wait"),
				delayDenyMessage: this.getMessage("enginebay-overcharge-run-delay"),
				// @ts-ignore ???
				exclusiveId: "enginebay-overcharge-run",
				exclusiveDenyMessage: this.getMessage("enginebay-overcharge-run-exclusive"),
				callback: callbackEnginebayOvercharge.bind(this),
			}, {
				button: new MessageButton().setCustomId("space-enginebay-overcharge-run_no").setLabel("No").setStyle("PRIMARY"),
				callback: callbackEnginebayOvercharge.bind(this),
			}]
		},
		ignitemana !== ActionStates.DAMAGED ? {
			button: new MessageButton().setCustomId("space-enginebay-ignitemana-run").setEmoji("🥏").setLabel("Ignite Mana Folds").setStyle("PRIMARY"),
			exclusiveId: "enginebay-ignitemana-run",
			exclusiveDenyMessage: this.getMessage("enginebay-ignitemana-run-exclusive"),
			question: this.getMessage("enginebay-ignitemana-run-question"),
			choices: [{
				button: new MessageButton().setCustomId("space-enginebay-ignitemana-run_yes").setLabel("Yes").setStyle("PRIMARY"),
				delay: 35,
				delayWaitMessage: this.getMessage("enginebay-ignitemana-run-wait"),
				delayDenyMessage: this.getMessage("enginebay-ignitemana-run-delay"),
				// @ts-ignore ???
				exclusiveId: "enginebay-ignitemana-run",
				exclusiveDenyMessage: this.getMessage("enginebay-ignitemana-run-exclusive"),
				callback: callbackEnginebayIgniteMana.bind(this),
			}, {
				button: new MessageButton().setCustomId("space-enginebay-ignitemana-run_no").setLabel("No").setStyle("PRIMARY"),
				callback: callbackEnginebayIgniteMana.bind(this),
			}]
		} : {
			button: new MessageButton().setCustomId("space-enginebay-ignitemana-repair").setEmoji("🛠").setLabel("Repair Mana Folds").setStyle("DANGER"),
			delay: 30,
			delayWaitMessage: this.getMessage("enginebay-ignitemana-repair-wait"),
			delayDenyMessage: this.getMessage("enginebay-ignitemana-repair-delay"),
			exclusiveId: "enginebay-ignitemana-repair",
			exclusiveDenyMessage: this.getMessage("enginebay-ignitemana-repair-exclusive"),
			callback: callbackEnginebayIgniteMana.bind(this),
		},
		drainfluids !== ActionStates.DAMAGED ? {
			button: new MessageButton().setCustomId("space-enginebay-drainfluids-run").setEmoji("💦").setLabel("Drain Fluids").setStyle("PRIMARY"),
			exclusiveId: "enginebay-drainfluids-run",
			exclusiveDenyMessage: this.getMessage("enginebay-drainfluids-run-exclusive"),
			question: this.getMessage("enginebay-drainfluids-run-question"),
			choices: [{
				button: new MessageButton().setCustomId("space-enginebay-drainfluids-run_yes").setLabel("Yes").setStyle("PRIMARY"),
				delay: 20,
				delayWaitMessage: this.getMessage("enginebay-drainfluids-run-wait"),
				delayDenyMessage: this.getMessage("enginebay-drainfluids-run-delay"),
				// @ts-ignore ??? 
				exclusiveId: "enginebay-drainfluids-run",
				exclusiveDenyMessage: this.getMessage("enginebay-drainfluids-run-exclusive"),
				callback: callbackEnginebayDrainFluids.bind(this),
			}, {
				button: new MessageButton().setCustomId("space-enginebay-drainfluids-run_no").setLabel("No").setStyle("PRIMARY"),
				callback: callbackEnginebayDrainFluids.bind(this),
				}]
		} : {
			button: new MessageButton().setCustomId("space-enginebay-drainfluids-repair").setEmoji("🛠").setLabel("Repair Fluid Drain").setStyle("DANGER"),
			delay: 30,
			delayWaitMessage: this.getMessage("enginebay-drainfluids-repair-wait"),
			delayDenyMessage: this.getMessage("enginebay-drainfluids-repair-delay"),
			exclusiveId: "enginebay-drainfluids-repair",
			exclusiveDenyMessage: this.getMessage("enginebay-drainfluids-repair-exclusive"),
			callback: callbackEnginebayDrainFluids.bind(this),
		}
	]
}
async function callbackEnginebayScanHull(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , type] = action.button.customId!.split("-");
	
	if (type.startsWith("run")) {
		const mode = action.button.label!;
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> scanned the ship's <span class="system">hull</span> using the <span class="special">${mode}</span> algorithm`);

		const editMessage = interactionEdit(this.getMessage("enginebay-scanhull-run", mode));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === "repair") {
		await this.redis.set("mm-space:enginebay-scanhull-status", ActionStates.READY);
		const actionRow = await getEnginebayActions.bind(this)();
		this.rooms.enginebay.actions[3] = actionRow;
		this.rooms.enginebay.addActionsRecursive(actionRow);
		this.rooms.enginebay.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> repaired the <span class="system">hull scanner</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-scanhull-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}
async function callbackEnginebayPolishGem(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , type] = action.button.customId!.split("-");
	
	if (type.startsWith("run")) {
		if (!type.endsWith("no")) {
			this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> polished the <span class="system">gem core</span> to prevent further cracks from forming`);

			const editMessage = interactionEdit(this.getMessage("enginebay-polishgem-run"));
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({...editMessage, ephemeral: true});
		} else {
			const editMessage = interactionEdit(this.getMessage("enginebay-polishgem-cancel"));
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({...editMessage, ephemeral: true});
		}
	} else if (type === "repair") {
		await this.redis.set("mm-space:enginebay-polishgem-status", ActionStates.READY);
		const actionRow = await getEnginebayActions.bind(this)();
		this.rooms.enginebay.actions[3] = actionRow;
		this.rooms.enginebay.addActionsRecursive(actionRow);
		this.rooms.enginebay.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> sealed the cracks in the <span class="system">gem core</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-polishgem-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}
async function callbackEnginebayOvercharge(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , type] = action.button.customId!.split("-");
	
	if (type === ("run_yes")) {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has <span class="overcharge">overcharged</span> the <span class="system">ship</span> to improve overall efficiency`);

		const editMessage = interactionEdit(this.getMessage("enginebay-overcharge-run"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === ("run_no")) {
		const editMessage = interactionEdit(this.getMessage("enginebay-overcharge-cancel"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}
async function callbackEnginebayIgniteMana(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , type] = action.button.customId!.split("-");
	
	if (type === ("run_yes")) {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> ignited the <span class="system">mana folds</span> to increase the ship's speed for a few seconds`);

		const editMessage = interactionEdit(this.getMessage("enginebay-ignitemana-run"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === ("run_no")) {
		const editMessage = interactionEdit(this.getMessage("enginebay-ignitemana-cancel"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === ("repair")) {
		await this.redis.set("mm-space:enginebay-ignitemana-status", ActionStates.READY);
		const actionRow = await getEnginebayActions.bind(this)();
		this.rooms.enginebay.actions[3] = actionRow;
		this.rooms.enginebay.addActionsRecursive(actionRow);
		this.rooms.enginebay.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> repaired the <span class="system">mana folds</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-ignitemana-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}
async function callbackEnginebayDrainFluids(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , type] = action.button.customId!.split("-");
	
	if (type === ("run_yes")) {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> drained the <span class="system">fluids</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-drainfluids-run"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === ("run_no")) {
		const editMessage = interactionEdit(this.getMessage("enginebay-drainfluids-cancel"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (type === ("repair")) {
		await this.redis.set("mm-space:enginebay-drainfluids-status", ActionStates.READY);
		const actionRow = await getEnginebayActions.bind(this)();
		this.rooms.enginebay.actions[3] = actionRow;
		this.rooms.enginebay.addActionsRecursive(actionRow);
		this.rooms.enginebay.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> repaired the <span class="system">fluid drains</span>`);

		const editMessage = interactionEdit(this.getMessage("enginebay-drainfluids-repair"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}

export async function enginebayRepairShield(this: SpaceSquirrels, index: number) {
	console.log("Repairing shield", index);
	await this.redis.lset(`mm-space:enginebay-shields-status`, index, ActionStates.READY);
	if (["Vibrate", "Focus", "Enhance", "Calibrate"].includes(ShieldActions[index].name))
		this.redis.set(`mm-space:enginebay-shields-${ShieldActions[index].name.toLowerCase()}`, ShieldActions[index].choices[Math.floor(Math.random() * ShieldActions[index].choices.length)]);
	const newAction = (await getEnginebayShields.bind(this)(index))[0];
	this.rooms.enginebay.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`A <span class="system">Shield System</span> has been repaired`);
}
export async function enginebayDamageShield(this: SpaceSquirrels, index: number) {
	console.log("Damaging shield", index);
	await this.redis.lset(`mm-space:enginebay-shields-status`, index, ActionStates.DAMAGED);
	if (["Vibrate", "Focus", "Enhance", "Calibrate"].includes(ShieldActions[index].name))
		this.redis.set(`mm-space:enginebay-shields-${ShieldActions[index].name.toLowerCase()}`, "damaged");
	const newAction = (await getEnginebayShields.bind(this)(index))[0];
	this.rooms.enginebay.actions[Math.floor(index / 5) + 1][index % 5] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`A <span class="system">Shield System</span> has been damaged`);
}

export async function enginebayDamageScanhull(this: SpaceSquirrels) {
	console.log("Damaging scanhull");
	await this.redis.set("mm-space:enginebay-scanhull-status", ActionStates.DAMAGED);
	const newAction = (await getEnginebayActions.bind(this)())[0];
	this.rooms.enginebay.actions[3][0] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Hull Scanner</span> has been damaged`);
}

export async function enginebayRepairScanhull(this: SpaceSquirrels) {
	console.log("Repairing scanhull");
	await this.redis.set("mm-space:enginebay-scanhull-status", ActionStates.READY);
	const newAction = (await getEnginebayActions.bind(this)())[0];
	this.rooms.enginebay.actions[3][0] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Hull Scanner</span> has been repaired`);
}

export async function enginebayDamagePolishgem(this: SpaceSquirrels) {
	console.log("Damaging polishgem");
	await this.redis.set("mm-space:enginebay-polishgem-status", ActionStates.DAMAGED);
	const newAction = (await getEnginebayActions.bind(this)())[1];
	this.rooms.enginebay.actions[3][1] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Gem Core</span> has been damaged`);
}

export async function enginebayRepairPolishgem(this: SpaceSquirrels) {
	console.log("Repairing polishgem");
	await this.redis.set("mm-space:enginebay-polishgem-status", ActionStates.READY);
	const newAction = (await getEnginebayActions.bind(this)())[1];
	this.rooms.enginebay.actions[3][1] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();
	
	this.logger.log(`The <span class="system">Gem Core</span> has been repaired`);
}

export async function enginebayDamageIgnitemana(this: SpaceSquirrels) {
	console.log("Damaging ignitemana");
	await this.redis.set("mm-space:enginebay-ignitemana-status", ActionStates.DAMAGED);
	const newAction = (await getEnginebayActions.bind(this)())[3];
	this.rooms.enginebay.actions[3][3] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Mana Core</span> has been damaged`);
}

export async function enginebayRepairIgnitemana(this: SpaceSquirrels) {
	console.log("Repairing ignitemana");
	await this.redis.set("mm-space:enginebay-ignitemana-status", ActionStates.READY);
	const newAction = (await getEnginebayActions.bind(this)())[3];
	this.rooms.enginebay.actions[3][3] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Mana Core</span> has been repaired`);
}

export async function enginebayDamageDrainfluids(this: SpaceSquirrels) {
	console.log("Damaging drainfluids");
	await this.redis.set("mm-space:enginebay-drainfluids-status", ActionStates.DAMAGED);
	const newAction = (await getEnginebayActions.bind(this)())[4];
	this.rooms.enginebay.actions[3][4] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Fluid Drains</span> have been damaged`);
}

export async function enginebayRepairDrainfluids(this: SpaceSquirrels) {
	console.log("Repairing drainfluids");
	await this.redis.set("mm-space:enginebay-drainfluids-status", ActionStates.READY);
	const newAction = (await getEnginebayActions.bind(this)())[4];
	this.rooms.enginebay.actions[3][4] = newAction;
	this.rooms.enginebay.addActionsRecursive(newAction);
	this.rooms.enginebay.updateMessage();

	this.logger.log(`The <span class="system">Fluid Drains</span> have been repaired`);
}

export async function enginebayGetDamagableSystems(this: SpaceSquirrels) {
	const actions = (await this.redis.lrange("mm-space:enginebay-shields-status", 0, 9))
		.filter(status => status !== ActionStates.DAMAGED)
		.map((status, index) => enginebayDamageShield.bind(this, index));

	if (await this.redis.get("mm-space:enginebay-scanhull-status") !== ActionStates.DAMAGED)
		actions.push(enginebayDamageScanhull.bind(this));

	if (await this.redis.get("mm-space:enginebay-polishgem-status") !== ActionStates.DAMAGED)
		actions.push(enginebayDamagePolishgem.bind(this));

	if (await this.redis.get("mm-space:enginebay-ignitemana-status") !== ActionStates.DAMAGED)
		actions.push(enginebayDamageIgnitemana.bind(this));

	if (await this.redis.get("mm-space:enginebay-drainfluids-status") !== ActionStates.DAMAGED)
		actions.push(enginebayDamageDrainfluids.bind(this));

	return actions;
}