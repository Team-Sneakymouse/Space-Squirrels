import { ButtonInteraction, GuildMember, MessageButton, MessageEmbed } from "discord.js";
import Room, { Action, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { Rooms } from "./utils";

enum ActionStates {
	READY = "ready",
	DAMAGED = "damaged",
}
const vibes = ["Happy", "Sad", "Anger", "Fear", "Chill"]

export default async function roomCrewquarters(spaceSquirrels: SpaceSquirrels) {
	const crewquarters = new Room({
		name: "Crew Quarters",
		channelId: "915138510330142730",
		messageId: "915157646296879144",
		threadId: "915157647228039188",
		messageContent: spaceSquirrels.getMessage("crewquarters-description"),
		actionRows: [
			await spaceSquirrels.getNavigation(Rooms.CREWQUARTERS),
			await getCrewquartersVibes.bind(spaceSquirrels)(),
			await getCrewquartersLifeboats.bind(spaceSquirrels)(),
		],
	}, spaceSquirrels.client, spaceSquirrels.redis)

	return crewquarters;
}


async function getCrewquartersVibes(this: SpaceSquirrels): Promise<Action[]> {
	const vibeStates = await this.redis.lrange("mm-space:crewquarters-vibe-status", 0, 4) as ActionStates[];

	return vibeStates.map((state, index): Action => {
		let id = `space-crewquarters-vibe-${index}`;
		return state === ActionStates.READY ? {
			button: new MessageButton().setCustomId(id + "-report").setLabel(`Report ${vibes[index]}`).setStyle("SUCCESS"),
			delay: 10,
			delayDenyMessage: this.getMessage("crewquarters-vibe-report-delay"),
			delayWaitMessage: this.getMessage("crewquarters-vibe-report-wait"),
			callback: callbackCewquartersVibe.bind(this),
		} : {
			button: new MessageButton().setCustomId(id + "-repair").setLabel(`Repair ${vibes[index]}`).setStyle("DANGER"),
			exclusiveId: `crewquarters-vibe-repair-${index}`,
			exclusiveDenyMessage: this.getMessage("crewquarters-vibe-repair-exclusive"),
			delay: 30,
			delayDenyMessage: this.getMessage("crewquarters-vibe-repair-delay"),
			delayWaitMessage: this.getMessage("crewquarters-vibe-repair-wait"),
			callback: callbackCewquartersVibe.bind(this),
		}
	});
}

async function callbackCewquartersVibe(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , indexStr, type] = interaction.customId.split("-");
	const index = parseInt(indexStr);

	if (type === "report") {
		this.redis.set(`mm-space:user-vibe-${interaction.user.id}`, vibes[index].toLowerCase(), "EX", 60);

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> reported feeling <span class="vibe-${vibes[index].toLowerCase()}">${vibes[index]}</span>`);

		const editMessage = interactionEdit(this.getMessage("crewquarters-vibe-reported", vibes[index]));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.lset("mm-space:crewquarters-vibe-status", index, ActionStates.READY);
		const newAction = (await getCrewquartersVibes.bind(this)())[index];
		this.rooms.crewquarters.actions[1][index] = newAction;
		this.rooms.crewquarters.addActionsRecursive(newAction);
		this.rooms.crewquarters.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has restored the ability to feel <span class="vibe-${vibes[index]}">${vibes[index]}</span>`);

		const editMessage = interactionEdit(this.getMessage("crewquarters-vibe-repair", vibes[index]));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

async function getCrewquartersLifeboats(this: SpaceSquirrels): Promise<Action[]> {
	const lifeboatStates = await this.redis.lrange("mm-space:crewquarters-lifeboat-status", 0, 4) as ActionStates[];

	return lifeboatStates.map((state, index): Action => {
		let id = `space-crewquarters-lifeboat-${index}`;
		return state === ActionStates.READY ? {
			button: new MessageButton().setCustomId(id + "-enter").setLabel(`Enter Lifeboat`).setStyle("PRIMARY"),
			delay: 15,
			delayDenyMessage: this.getMessage("crewquarters-lifeboat-enter-delay"),
			delayWaitMessage: this.getMessage("crewquarters-lifeboat-enter-wait"),
			callback: callbackCewquartersLifeboat.bind(this),
		} : {
			button: new MessageButton().setCustomId(id + "-repair").setLabel(`Repair Lifeboat`).setStyle("DANGER"),
			exclusiveId: `crewquarters-lifeboat-repair-${index}`,
			exclusiveDenyMessage: this.getMessage("crewquarters-lifeboat-repair-exclusive"),
			delay: 30,
			delayDenyMessage: this.getMessage("crewquarters-lifeboat-repair-delay"),
			delayWaitMessage: this.getMessage("crewquarters-lifeboat-repair-wait"),
			callback: callbackCewquartersLifeboat.bind(this),
		}
	});
}

async function callbackCewquartersLifeboat(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , indexStr, type] = interaction.customId.split("-");
	const index = parseInt(indexStr);

	if (type === "enter") {
		await this.redis.sadd(`mm-space:crewquarters-lifeboat-crew${index + 1}`, interaction.user.id);
		await this.redis.set(`mm-space:delay-${interaction.user.id}`, action.button.customId!, "EX", 300);
		this.rooms.crewquarters.activeInteractions.set(interaction.user.id, [{
			button: new MessageButton().setCustomId("space-crewquarters-lifeboat-wait").setLabel("Wait for Lifeboat launch").setStyle("DANGER"),
			delayDenyMessage: this.getMessage("crewquarters-lifeboat-wait-delay"),
			callback: (interaction: ButtonInteraction, currentRoom: Room, action: Action) => interaction.reply({content: "You shouldn't be able to see this.", ephemeral: true})
		}, interaction]);

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has entered a <span class="system">lifeboat</span>`);

		const crewquartersLifeboatLeaveAction = {
			button: new MessageButton().setCustomId(`space-crewquarters-lifeboat-${index}-leave`).setLabel(`Leave Lifeboat`).setStyle("DANGER"),
			callback: callbackCewquartersLifeboat.bind(this),
		}
		this.rooms.crewquarters.addActionsRecursive(crewquartersLifeboatLeaveAction);
		const editMessage = interactionEdit(this.getMessage("crewquarters-lifeboat-enter"), crewquartersLifeboatLeaveAction);
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "leave") {
		await this.redis.srem(`mm-space:crewquarters-lifeboat-crew${index + 1}`, interaction.user.id);
		await this.redis.del(`mm-space:delay-${interaction.user.id}`);
		this.rooms.crewquarters.activeInteractions.delete(interaction.user.id);

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has left their <span class="system">lifeboat</span>`);

		const editMessage = interactionEdit(this.getMessage("crewquarters-lifeboat-leave"));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.lset("mm-space:crewquarters-lifeboat-status", index, ActionStates.READY);
		const newAction = (await getCrewquartersLifeboats.bind(this)())[index];
		this.rooms.crewquarters.actions[2][index] = newAction;
		this.rooms.crewquarters.addActionsRecursive(newAction);
		this.rooms.crewquarters.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired a <span class="system">lifeboat</span>`);

		const editMessage = interactionEdit(this.getMessage("crewquarters-lifeboat-repair"));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

export async function crewquartersLaunchLifeboats(this: SpaceSquirrels) {
	const lifeboatStates = await this.redis.lrange("mm-space:crewquarters-lifeboat-status", 0, 4) as ActionStates[];

	let launched = 0;
	for (let i = 0; i < lifeboatStates.length; i++) {
		if (lifeboatStates[i] === ActionStates.READY) {
			const crew = await this.redis.smembers(`mm-space:crewquarters-lifeboat-crew${i + 1}`) as string[];
			crew.forEach(async (userId) => {
				this.redis.set(`mm-space:user-status-${userId}`, "escaped")
				this.redis.del(`mm-space:delay-${userId}`);
				const [, interaction] = this.rooms.crewquarters.activeInteractions.get(userId) || [];
				if (interaction) {
					const editMessage = interactionEdit(this.getMessage("crewquarters-lifeboat-escape", ...crew.filter((userId) => userId !== interaction.user.id)));
					if (interaction.replied) await interaction.editReply(editMessage);
					else await interaction.reply({ ...editMessage, ephemeral: true });
				}
				this.logger.log(`<span class="user">${(interaction?.member as GuildMember).displayName}</span> has escaped the ship in a <span class="system">lifeboat</span>`);

				this.rooms.crewquarters.activeInteractions.delete(userId);
				this.redis.srem(`mm-space:crewquarters-lifeboat-crew${i + 1}`, userId);
				this.rooms.crewquarters.channel.permissionOverwrites.create(userId, { VIEW_CHANNEL: false });
				this.rooms.onboarding.channel.permissionOverwrites.create(userId, { VIEW_CHANNEL: true });
			})
		}
	}
}

export async function crewquartersDamageVibe(this: SpaceSquirrels, index: number) {
	console.log(`Damaging vibe ${index}`);
	await this.redis.lset(`mm-space:crewquarters-vibe-status`, index, ActionStates.DAMAGED);
	const newAction = (await getCrewquartersVibes.bind(this)())[index];
	this.rooms.crewquarters.actions[1][index] = newAction;
	this.rooms.crewquarters.addActionsRecursive(newAction);
	this.rooms.crewquarters.updateMessage();

	this.logger.log(`The <span class="system">Vibe Station</span> lost the ability to register <span class="vibe-${vibes[index].toLowerCase()}">${vibes[index]}</span>`);
}

export async function crewquartersRepairVibe(this: SpaceSquirrels, index: number) {
	console.log(`Repairing vibe ${index}`);
	await this.redis.lset(`mm-space:crewquarters-vibe-status`, index, ActionStates.READY);
	const newAction = (await getCrewquartersVibes.bind(this)())[index];
	this.rooms.crewquarters.actions[1][index] = newAction;
	this.rooms.crewquarters.addActionsRecursive(newAction);
	this.rooms.crewquarters.updateMessage();

	this.logger.log(`The <span class="system">Vibe Station</span>'s ability to register <span class="vibe-${vibes[index].toLowerCase()}">${vibes[index]}</span> is operational again`);
}

export async function crewquartersDamageLifeboat(this: SpaceSquirrels, index: number) {
	console.log(`Damaging lifeboat ${index}`);
	await this.redis.lset(`mm-space:crewquarters-lifeboat-status`, index, ActionStates.DAMAGED);
	const newAction = (await getCrewquartersLifeboats.bind(this)())[index];
	this.rooms.crewquarters.actions[2][index] = newAction;
	this.rooms.crewquarters.addActionsRecursive(newAction);
	this.rooms.crewquarters.updateMessage();

	this.logger.log(`A <span class="system">Life Boat</span> has been damaged`);
}

export async function crewquartersRepairLifeboat(this: SpaceSquirrels, index: number) {
	console.log(`Repairing lifeboat ${index}`);
	await this.redis.lset(`mm-space:crewquarters-lifeboat-status`, index, ActionStates.READY);
	const newAction = (await getCrewquartersLifeboats.bind(this)())[index];
	this.rooms.crewquarters.actions[2][index] = newAction;
	this.rooms.crewquarters.addActionsRecursive(newAction);
	this.rooms.crewquarters.updateMessage();

	this.logger.log(`A <span class="system">Life Boat</span> has been repaired`);
}

export async function crewquartersGetDamagableSystems(this: SpaceSquirrels) {
	const actions = (await this.redis.lrange("mm-space:crewquarters-vibe-status", 0, 4))
		.filter(status => status !== ActionStates.DAMAGED)
		.map((status, index) => crewquartersDamageVibe.bind(this, index));

	
	const actions2 = (await this.redis.lrange("mm-space:crewquarters-lifeboat-status", 0, 4))
		.filter((status, index) => status !== ActionStates.DAMAGED && index !== 1)
		.map((status, index) => crewquartersDamageLifeboat.bind(this, index));

	return [...actions, ...actions2];
}