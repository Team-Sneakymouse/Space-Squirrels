import { ButtonInteraction, GuildMember, MessageButton, MessageEmbed } from "discord.js";
import Room, { Action, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { Rooms } from "./utils";

enum ActionStates {
	READY = "ready",
	DAMAGED = "damaged",
}

const scoutOptions = [{
	object: "A strangely carved asteroid",
	followup: "A strange asteroid about 3 Naughts away appears to have deep holes as if it was drilled into. You begin scanning for lifeforms.",
	finish: `You have discovered an asteroid about 3 Naughts away that has deep wide caverns created by Space Worms. Your scan also has revealed a Level 3 Space Worm still residing within the asteroid`,
	finishLog: `<span class="asset">Telescope Report #457</span>: <span class="user">{user}</span> has discovered an <span class="bad">asteroid</span> about 3 Naughts away that has deep wide caverns created by Space Worms. Their scan also has revealed a <span class="bad">Level 3 Space Worm</span> still residing within the asteroid. It is recommended we avoid this asteroid, captain`,
	asset: 457
}, {
	object: "A dangerous body of heat",
	followup: "There is a strange body of heat the size of a small ship locaded 5 Naughts away. You begin your attempt to resolve an image of the heat mass.",
	finish: `You have awakened a Level 5 Space Worm 5 Naughts away that has noticed our presence and has begun phasing towards us on an intercept course`,
	finishLog: `<span class="asset">Telescope Report #654</span>: <span class="user">{user}</span> has awakened a <span class="bad">Level 5 Space Worm</span> 5 Naughts away that has noticed our presence and has begun phasing towards us on an intercept course`,
	asset: 654,
}, {
	object: "A strange frozen sattelite",
	followup: "There is a strange sattelite 2 Naughts away that appears to be completely frozen. You begin a digital scan to see what could be causing the frozen state.",
	finish: `You have located a frohen sattelite that appears to have a Level 1 Frostborn Space Worm living inside of it`,
	finishLog: `<span class="asset">Telescope Report #454</span>: <span class="user">{user}</span> has located a frohen sattelite that appears to have a <span class="bad">Level 1 Frostborn Space Worm</span> living inside of it`,
	asset: 454,
}, {
	object: "An unusual flock of Space Whales",
	followup: "There is a flock of a dozen Space Whales 10 Naughts away that appear to be fighting with one of the bigger Space Whales. You attempt to resolve images of the situation.",
	finish: `You have spotted a dangerous Level 5 Space Squid that appears to be feeding on a flock of Space Whales. We should avoid this area at all costs`,
	finishLog: `<span class="asset">Telescope Report #842</span>: <span class="user">{user}</span> has spotted a dangerous <span class="bad">Level 5 Space Squid</span> that appears to be feeding on a flock of Space Whales. We should avoid this area at all costs`,
	asset: 842,
}, {
	object: "A strange shock affecting the hull",
	followup: "While calibrating the telescope, you notice that there are multiple shocks affecting a few of the outer hull plates of the ship. You launch a drone to investigate the disturbance.",
	finish: `You have found that the outer hull of the ship is infested with Space Termites. It is recommended we vibrate the shields in a jackhammer pattern to immobilize the termites until we reach a star dock`,
	finishLog: `<span class="asset">Telescope Report #573</span>: <span class="user">{user}</span> has found that the outer hull of the ship is infested with <span class="bad">Space Termites</span>. It is recommended we vibrate the shields in a jackhammer pattern to immobilize the termites until we reach a star dock`,
	asset: 573,
}, {
	object: "A distress call from an uncharted planet",
	followup: "There is a weak distress call coming from S-Class Planet 44 Naughts away. You begin attempting to rebuild the lost message.",
	finish: `You have decoded a distress call coming from Forn Rebels located on an S-Class Planet. It is against MLM Starcode to communicate with rebels of the Ironstone accords. It is recommended we ignore this distress call.`,
	finishLog: `<span class="asset">Telescope Report #112</span>: <span class="user">{user}</span> has decoded a distress call coming from Forn Rebels located on an S-Class Planet. It is against MLM Starcode to communicate with rebels of the Ironstone accords. It is recommended we ignore this distress call.`,
	asset: 112,
}, {
	object: "An unidentified star brig",
	followup: "There is a Star Brig with an unknown MLM callcode 11 Naughts away stationed at a A-Class planet. You begin attempting to resolve an image to identify the vessel.",
	finish: `Youi have discovered a Star Brig of the Forn Empire 11 Naughts away stationed at a A-Class Planet known as Triton, homeworld of the ancient race of people known as Kobolds. Should we Ahoy them?`,
	finishLog: `<span class="asset">Telescope Report #128</span>: <span class="user">{user}</span> has discovered a Star Brig of the <span class="bad">Forn Empire</span> 11 Naughts away stationed at a A-Class Planet known as Triton, homeworld of the ancient race of people known as Kobolds. Should we Ahoy them?`,
	asset: 128
}, {
	object: "A strange oil cloud drifing behind the ship",
	followup: "There is a cloud of oil that seems to be stuck in some sort of gravity well behind the ship. You begin scanning the well to discover the reason for this.",
	finish: `You have uncovered a sloop directly behind the ship less then 1 Naught away. Their weapon systems are armed and they are Ahoying us. Should we answer?`,
	finishLog: `<span class="asset">Telescope Report #595</span>: <span class="user">{user}</span> has uncovered <span class="bad">a sloop</span> directly behind the ship less then 1 Naught away. Their weapon systems are armed and they are Ahoying us. Should we answer?`,
	asset: 595
}, {
	object: "An unidentified sloop",
	followup: "There is an strange looking sloop about 4 Naughts away that appears to be following us. You begin scanning their ship.",
	finish: `You have unconvered an Eldritch Class Sloop believed to be owned by Space Pirate Ashmonger. Should we Ahoy them?`,
	finishLog: `<span class="asset">Telescope Report #629</span>: <span class="user">{user}</span> has unconvered an <span class="bad">Eldritch Class Sloop</span> believed to be owned by Space Pirate Ashmonger. Should we Ahoy them?`,
	asset: 629
}, {
	object: "A grouping of reaver class ships",
	followup: "There is a group of a dozen or more small reaver class ships amassing next to a dying star 10 Naughts away. You begin gathering data on the ships for the captain.",
	finish: `You have uncovered a total of 17 reaver class star ships each with markings of the Grand Paladin Order on them stationed next to the dying star 10 Naughts away. Should we Ahoy them?`,
	finishLog: `<span class="asset">Telescope Report #395</span>: <span class="user">{user}</span> has uncovered a total of <span class="bad">17 reaver class star ships</span> each with markings of the Grand Paladin Order on them stationed next to the dying star 10 Naughts away. Should we Ahoy them?`,
	asset: 395
}, {
	object: "A large indentified gunboat",
	followup: "There is a large unidentified gunboat that appears to have suffered major damage near a mineral field 15 Naughts away. You begin scanning the ship to report to the captain.",
	finish: "You have identified a Gobo Gunboat 15 naughts away near a minerial field 15 Naughts away. Their ship appears to have substained massive damage as over 90% of their systems are offline including Weapons, Shields, and Lifesupport. Should we hail them?",
	finishLog: `<span class="asset">Telescope Report #600</span>: <span class="user">{user}</span> has identified a Gobo Gunboat 15 naughts away near a minerial field 15 Naughts away. Their ship appears to have substained massive damage as over 90% of their systems are offline including Weapons, Shields, and Lifesupport. Should we hail them?`,
	asset: 600
}, {
	object: "A distress call from a small sloop",
	followup: "There is a sloop that belongs to the People of the Stone releasing a distress call about 8 Naughts away. You begin scanning the ship to report to the captian.",
	finish: "You have found a sloop releasing a distress call that belongs to the People of the Stone releasing a distress call about 8 Naughts away that appears to be having issues with its atmospheric generator. Should we ahoy them?",
	finishLog: `<span class="asset">Telescope Report #984</span>: <span class="user">{user}</span> has found a sloop releasing a distress call that belongs to the People of the Stone releasing a distress call about 8 Naughts away that appears to be having issues with its atmospheric generator. Should we ahoy them?`,
	asset: 984
}, {
	object: "A large ship near a mining station",
	followup: "There is a large ship near a mining station 9 Naughts away that scanners are having trouble reading. You begin recalibrating the scanners to prepare a report for the captain.",
	finish: "You have spotted a Class 3 Longboat that belongs to the People of the Stone stationed next to a mining station 9 Naughts away. Scanners were struggling reading the ship due to a unknown chemical cloud the surrodens the entire space station. Should we ahoy the Long Boat?",
	finishLog: `<span class="asset">Telescope Report #993</span>: <span class="user">{user}</span> has spotted a Class 3 Longboat that belongs to the People of the Stone stationed next to a mining station 9 Naughts away. Scanners were struggling reading the ship due to a unknown chemical cloud the surrodens the entire space station. Should we ahoy the Long Boat?`,
	asset: 993
}, {
	object: "A large warp signature",
	followup: `There is Class 5 Kraken Star Ship known as the "Stone of Atlantis" is stationed around an S-Class Planet 32 Naughts away. You begin preparing a report to alert the captain.`,
	finish: `You have located a Class 5 Kraken Star Ship known as the "Stone of Atlantis" is stationed around an S-Class Planet. The Stone of Alantis is known to be piloted by Star Admiral Maven Arcstone. Should we ahoy the Star Admiral?`,
	finishLog: `<span class="asset">Telescope Report #998</span>: <span class="user">{user}</span> has located a Class 5 Kraken Star Ship known as the "Stone of Atlantis" is stationed around an S-Class Planet. The Stone of Alantis is known to be piloted by Star Admiral Maven Arcstone. Should we ahoy the Star Admiral?`,
	asset: 998
}]

export default async function roomCrowsnest(spaceSquirrels: SpaceSquirrels) {
	const crowsnest = new Room({
		name: "Crow's Nest",
		channelId: "915138475974594560",
		messageId: "915157562138165258",
		threadId: "915157562893140008",
		messageContent: spaceSquirrels.getMessage("crowsnest-description"),
		actionRows: [
			await spaceSquirrels.getNavigation(Rooms.CROWSNEST),
			await getCrowsnestGenerators.bind(spaceSquirrels)(),
			await getCrowsnestActions.bind(spaceSquirrels)(),
		],
	}, spaceSquirrels.client, spaceSquirrels.redis)

	return crowsnest;
}

async function getCrowsnestGenerators(this: SpaceSquirrels) {
	const generatorStates = await this.redis.lrange("mm-space:crowsnest-generator-status", 0, 4) as ActionStates[];

	return generatorStates.map((state, index) => {
		let id = `space-crowsnest-generator-${index}`
		switch (state) {
			case ActionStates.READY:
				id += "-charge"
				return {
					button: new MessageButton().setCustomId(id).setEmoji("⚡").setLabel("Charge Generator").setStyle("SUCCESS"),
					exclusiveId: `crowsnest-generator-charge-${index}`,
					exclusiveDenyMessage: this.getMessage(`crowsnest-generator-charge-exclusive`),
					delay: 20,
					delayWaitMessage: this.getMessage(`crowsnest-generator-charge-wait`),
					delayDenyMessage: this.getMessage(`crowsnest-generator-charge-delay`),
					callback: callbackCrowsnestGenerator.bind(this),
				}
			case ActionStates.DAMAGED:
				id += "-repair"
				return {
					button: new MessageButton().setCustomId(id).setEmoji("🛠").setLabel("Repair Generator").setStyle("DANGER"),
					exclusiveId: `crowsnest-generator-repair-${index}`,
					exclusiveDenyMessage: this.getMessage(`crowsnest-generator-repair-exclusive`),
					delay: 30,
					delayWaitMessage: this.getMessage(`crowsnest-generator-repair-wait`),
					delayDenyMessage: this.getMessage(`crowsnest-generator-repair-delay`),
					callback: callbackCrowsnestGenerator.bind(this),
				}
		}
	})
}

async function callbackCrowsnestGenerator(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const [, , , indexStr, type] = interaction.customId.split("-");
	const index = parseInt(indexStr);

	if (type === "charge") {
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has charged the <span class="system">atmospheric generator</span>`);

		const editMessage = interactionEdit(this.getMessage("crowsnest-generator-charge"));
		if (interaction.replied) return interaction.editReply(editMessage);
		interaction.reply({ ...editMessage, ephemeral: true });
	}
	if (type === "repair") {
		await this.redis.lset("mm-space:crowsnest-generator-status", index, ActionStates.READY);
		const newAction = (await getCrowsnestGenerators.bind(this)())[index];
		this.rooms.crowsnest.actions[1][index] = newAction;
		this.rooms.crowsnest.addActionsRecursive(newAction);
		this.rooms.crowsnest.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired the <span class="system">atmospheric generator</span>`);

		const editMessage = interactionEdit(this.getMessage("crowsnest-generator-repair"));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}
}

async function getCrowsnestActions(this: SpaceSquirrels) {
	const [
		telescope,
		starchart,
		ravens,
		scanner,
	] = await Promise.all([
		this.redis.get("mm-space:crowsnest-telescope-status"),
		this.redis.get("mm-space:crowsnest-starchart-status"),
		this.redis.get("mm-space:crowsnest-ravens-status"),
		this.redis.get("mm-space:crowsnest-scanner-status"),
	]) as ActionStates[];

	return [
		telescope !== ActionStates.DAMAGED ? {
			button: new MessageButton().setCustomId("space-crowsnest-telescope-use").setEmoji("🔭").setLabel("Scout Galaxy").setStyle("PRIMARY"),
			exclusiveId: "crowsnest-telescope-use",
			exclusiveDenyMessage: this.getMessage("crowsnest-telescope-use-exclusive"),
			delayWaitMessage: this.getMessage("crowsnest-telescope-use-wait"),
			delayDenyMessage: this.getMessage("crowsnest-telescope-use-delay"),
			callback: callbackCrowsnestTelescope.bind(this),
		} : {
			button: new MessageButton().setCustomId("space-crowsnest-telescope-repair").setEmoji("🛠").setLabel("Repair Telescope").setStyle("DANGER"),
			exclusiveId: "crowsnest-telescope-repair",
			exclusiveDenyMessage: this.getMessage("crowsnest-telescope-repair-exclusive"),
			delay: 30,
			delayWaitMessage: this.getMessage("crowsnest-telescope-repair-wait"),
			delayDenyMessage: this.getMessage("crowsnest-telescope-repair-delay"),
			callback: callbackCrowsnestTelescope.bind(this),
		},
		{
			button: new MessageButton().setCustomId("space-crowsnest-starchart-use").setEmoji("🗺").setLabel("Review Starchart").setStyle("PRIMARY").setDisabled(true),
			callback: callbackNotImplemented.bind(this)
		},
		{
			button: new MessageButton().setCustomId("space-crowsnest-ravens-use").setEmoji("🕊").setLabel("Raven Transmission").setStyle("PRIMARY").setDisabled(true),
			callback: callbackNotImplemented.bind(this)
		},
		{
			button: new MessageButton().setCustomId("space-crowsnest-scanner-use").setEmoji("⌚").setLabel("Scan Local Area").setStyle("PRIMARY").setDisabled(true),
			callback: callbackNotImplemented.bind(this)
		},
	]
}

async function callbackCrowsnestTelescope(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	if (interaction.customId === "space-crowsnest-telescope-repair") {
		await this.redis.set("mm-space:crowsnest-telescope-status", ActionStates.READY);
		const newAction = (await getCrowsnestActions.bind(this)())[0];
		this.rooms.crowsnest.actions[2][0] = newAction;
		this.rooms.crowsnest.addActionsRecursive(newAction);
		this.rooms.crowsnest.updateMessage();

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has repaired the <span class="system">Galaxy Telescope</span>`);

		const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-repair"));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}

	const blocked = await this.redis.get(`mm-space:scouting-${interaction.user.id}`);
	if (blocked) {
		const time = await this.redis.ttl(`mm-space:scouting-${interaction.user.id}`);
		const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-blocked", `${time} seconds`));
		if (interaction.replied) return interaction.editReply(editMessage);
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}

	const delay = 5;
	if ("exclusiveId" in action) {
		this.redis.set(`mm-space:exclusive-${action.exclusiveId}`, interaction.user.id, "EX", delay);
	}
	this.redis.set(`mm-space:delay-${interaction.user.id}`, interaction.customId, "EX", delay);
	this.rooms.crowsnest.activeInteractions.set(interaction.user.id, [action, interaction]);

	let message: string | MessageEmbed;
	if ("delayWaitMessage" in action && typeof action.delayWaitMessage === "string") {
		message = action.delayWaitMessage.replace(/\$\{delay\}/g, delay.toString());
	} else if ("delayWaitMessage" in action && typeof action.delayWaitMessage !== "string") {
		message = action.delayWaitMessage;
		if (message.description) message.description = message.description.replace(/\$\{delay\}/g, delay.toString());
	} else {
		message = this.getMessage("crowsnest-telescope-use-wait");
	}

	interaction.reply({...interactionEdit(message), ephemeral: true});
	const delayMs = delay * 1000;
	await new Promise(resolve => setTimeout(resolve, delayMs));

	if (!this.rooms.crowsnest.activeInteractions.delete(interaction.user.id)) return; // if the interaction is not in the set anymore, it has been cancelled

	const found: number[] = [];

	const getScoutActions = (): Action[] => {
		const actions: Action[] = found.map((index) => {
			const object = scoutOptions[index];
			return {
				button: new MessageButton().setCustomId(`space-crowsnest-telescope-examine_${index}`).setLabel(object.object).setStyle("PRIMARY"),
				exclusiveId: "crowsnest-telescope-use",
				delay: 35,
				delayWaitMessage: this.getMessage("crowsnest-telescope-followup", object.followup),
				delayDenyMessage: this.getMessage("crowsnest-telescope-use-delay"),
				callback: async (interaction: ButtonInteraction, currentRoom: Room, action: Action) => {
					const blocked = await this.redis.get(`mm-space:scouting-${interaction.user.id}`);
					if (blocked) {
						const time = await this.redis.ttl(`mm-space:scouting-${interaction.user.id}`);
						const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-blocked", `${time} seconds`));
						if (interaction.replied) return interaction.editReply(editMessage);
						else return interaction.reply({ ...editMessage, ephemeral: true });
					}

					this.redis.set(`mm-space:scouting-${interaction.user.id}`, "true", "EX", 300)//20 * 60);
					this.logger.important(object.finishLog.replace(/{user}/g, (interaction.member as GuildMember).displayName));

					const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-finish", object.finish));
					if (interaction.replied) return interaction.editReply(editMessage);
					return interaction.reply({ ...editMessage, ephemeral: true });
				},
			}
		});
		if (actions.length < 3) actions.push({
			button: new MessageButton().setCustomId("space-crowsnest-telescope-reuse").setLabel("Scout Galaxy").setStyle("SECONDARY"),
			exclusiveId: "crowsnest-telescope-use",
			delay: 25,
			delayWaitMessage: this.getMessage("crowsnest-telescope-use-wait"),
			delayDenyMessage: this.getMessage("crowsnest-telescope-use-delay"),
			callback: callbackScoutHandler.bind(this),
		})
		this.rooms.crowsnest.addActionsRecursive(actions);
		return actions;
	}

	const callbackScoutHandler = async (interaction: ButtonInteraction, currentRoom: Room, action: Action) => {
		if (Math.random() < 0.6) {
			const newIndex = [...Array(scoutOptions.length)].map((_, i) => i).sort(() => 0.5 - Math.random()).find(i => !found.includes(i));
			if (newIndex !== undefined) {
				found.push(newIndex);

				const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-scout-found", scoutOptions[newIndex].object), getScoutActions.bind(this)());
				if (interaction.replied) return interaction.editReply(editMessage);
				return interaction.reply({...editMessage, ephemeral: true});
			};
		}
		const editMessage = interactionEdit(this.getMessage("crowsnest-telescope-scout-nothing"), getScoutActions.bind(this)());
		if (interaction.replied) return interaction.editReply(editMessage);
		return interaction.reply({...editMessage, ephemeral: true});
	}

	callbackScoutHandler(interaction, currentRoom, action);
}

async function callbackNotImplemented(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action) {
	const editMessage = interactionEdit(this.getMessage("action-not-implemented"));
	if (interaction.replied) return interaction.editReply(editMessage);
	return interaction.reply({...editMessage, ephemeral: true});
}

export async function crowsnestDamageGenerator(this: SpaceSquirrels, index: number) {
	console.log(`crowsnestDamageGenerator(${index})`);
	await this.redis.lset(`mm-space:crowsnest-generator-status`, index, ActionStates.DAMAGED);
	const newAction = (await getCrowsnestGenerators.bind(this)())[index];
	this.rooms.crowsnest.actions[1][index] = newAction;
	this.rooms.crowsnest.addActionsRecursive(newAction);
	this.rooms.crowsnest.updateMessage();

	this.logger.log(`An <span class="system">Atmospheric Generator</span> has been damaged`);
}
export async function crowsnestGeneratorRepair(this: SpaceSquirrels, index: number) {
	console.log(`crowsnestGeneratorRepair(${index})`);
	await this.redis.lset(`mm-space:crowsnest-generator-status`, index, ActionStates.READY);
	const newAction = (await getCrowsnestGenerators.bind(this)())[index];
	this.rooms.crowsnest.actions[1][index] = newAction;
	this.rooms.crowsnest.addActionsRecursive(newAction);
	this.rooms.crowsnest.updateMessage();

	this.logger.log(`An <span class="system">Atmospheric Generator</span> is being repaired`);
}

export async function crowsnestDamageTelescope(this: SpaceSquirrels) {
	console.log(`crowsnestDamageTelescope()`);	
	await this.redis.set(`mm-space:crowsnest-telescope-status`, ActionStates.DAMAGED);
	const newAction = (await getCrowsnestActions.bind(this)())[0];
	this.rooms.crowsnest.actions[2][0] = newAction;
	this.rooms.crowsnest.addActionsRecursive(newAction);
	this.rooms.crowsnest.updateMessage();

	this.logger.log(`The <span class="system">Galaxy Telescope</span> has been damaged`);
}
export async function crowsnestTelescopeRepair(this: SpaceSquirrels) {
	console.log(`crowsnestTelescopeRepair()`);
	await this.redis.set(`mm-space:crowsnest-telescope-status`, ActionStates.READY);
	const newAction = (await getCrowsnestActions.bind(this)())[0];
	this.rooms.crowsnest.actions[2][0] = newAction;
	this.rooms.crowsnest.addActionsRecursive(newAction);
	this.rooms.crowsnest.updateMessage();

	this.logger.log(`The <span class="system">Galaxy Telescope</span> is being repaired`);
}

export async function crowsnestGetDamagableSystems(this: SpaceSquirrels) {
	const actions = (await this.redis.lrange("mm-space:crowsnest-generator-status", 0, 4))
		.filter(status => status !== ActionStates.DAMAGED)
		.map((status, index) => crowsnestDamageGenerator.bind(this, index));

	
	if (await this.redis.get("mm-space:crowsnest-telescope-status") !== ActionStates.DAMAGED)
		actions.push(crowsnestDamageTelescope.bind(this));

	return actions;
}