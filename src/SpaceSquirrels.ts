import { ButtonInteraction, Client, GuildMember, MessageButton, MessageButtonStyleResolvable, MessageEmbed } from "discord.js";
import { Redis } from "ioredis";
import Room, { Action, interactionEdit } from "./Room";
import { Logger, createEmbed, People, Rooms, LoadingDuration, oxfordJoin } from "./utils";
import roomOnboarding from "./RoomOnboarding"
import roomMaindeck, { maindeckDamageLaser, maindeckFireLaser, maindeckGetDamagableSystems, maindeckRepairLaser, maindeckUnloadLaser } from "./RoomMaindeck";
import roomEnginebay, { enginebayDamageShield, enginebayGetDamagableSystems, enginebayRepairShield } from "./RoomEnginebay";
import roomCannondeck, { cannondeckDamageCannon, cannondeckFireCannon, cannondeckGetDamagableSystems, cannondeckRepairCannon, cannondeckUnloadCannon } from "./RoomCannondeck";
import roomCrowsnest, { crowsnestGetDamagableSystems } from "./RoomCrowsnest";
import roomCrewquarters, { crewquartersGetDamagableSystems } from "./RoomCrewquarters";

export enum DamageSystems {
	ANY,
	ROOM,
	LASER,
	SHIELD,
	CANNON,
}

export default class SpaceSquirrels {
	client: Client;
	redis: Redis;
	logger: Logger;
	init: Promise<this>;


	shipMode!: People;
	rooms!: { [key in Rooms]: Room };

	constructor(client: Client, redis: Redis, logger: Logger) {
		this.client = client;
		this.redis = redis;
		this.logger = logger;

		this.init = this._init();
	}

	async _init(): Promise<this> {
		this.rooms = {} as { [key in Rooms]: Room };
		this.shipMode = await this.redis.get("mm-space:ship-mode") as People;
		//this.shipMode = People.MONICA;

		this.rooms[Rooms.ONBOARDING] = await (roomOnboarding(this)).init;
		this.rooms[Rooms.MAINDECK] = await (await roomMaindeck(this)).init;
		this.rooms[Rooms.ENGINEBAY] = await (await roomEnginebay(this)).init;
		this.rooms[Rooms.CANNONDECK] = await (await roomCannondeck(this)).init;
		this.rooms[Rooms.CROWSNEST] = await (await roomCrowsnest(this)).init;
		this.rooms[Rooms.CREWQUARTERS] = await (await roomCrewquarters(this)).init;

		//this.rooms[Rooms.CAPTAINSQUARTERS] = await (new Room({
		//	name: "Catpatin's Quarters",
		//	channelId: "915147190039617597",
		//	messageId: "915157771400405002",
		//	threadId: null,
		//	messageContent: this.getMessage("captainquarters-description"),
		//	actionRows: [
		//		this.await getNavigation(Rooms.CAPTAINSQUARTERS)
		//	],
		//}, this.client, this.redis)).init;
		//

		return this;
	}

	async getNavigation(room: Rooms): Promise<Action[]> {
		const [
			maindeckStatus,
			enginebayStatus,
			cannondeckStatus,
			crowsnestStatus,
			crewquartersStatus,
		] = await this.redis.mget(
			`mm-space:room-maindeck-status`,
			`mm-space:room-enginebay-status`,
			`mm-space:room-cannondeck-status`,
			`mm-space:room-crowsnest-status`,
			`mm-space:room-crewquarters-status`,
		);

		const maindeck = new MessageButton().setCustomId("space-navigation-move-maindeck").setLabel("⛵ Main Deck").setStyle(maindeckStatus !== "damaged" ? "PRIMARY" : "DANGER").setDisabled(maindeckStatus === "damaged");
		const enginebay = new MessageButton().setCustomId("space-navigation-move-enginebay").setLabel("🎡 Engine Bay").setStyle(enginebayStatus !== "damaged" ? "PRIMARY" : "DANGER").setDisabled(enginebayStatus === "damaged");
		const cannondeck = new MessageButton().setCustomId("space-navigation-move-cannondeck").setLabel("💣 Cannon Deck").setStyle(cannondeckStatus !== "damaged" ? "PRIMARY" : "DANGER").setDisabled(cannondeckStatus === "damaged");
		const crowsnest = new MessageButton().setCustomId("space-navigation-move-crowsnest").setLabel("🧭 Crows Nest").setStyle(crowsnestStatus !== "damaged" ? "PRIMARY" : "DANGER").setDisabled(crowsnestStatus === "damaged");
		const crewquarters = new MessageButton().setCustomId("space-navigation-move-crewquarters").setLabel("🐭 Crew Quarters").setStyle(crewquartersStatus !== "damaged" ? "PRIMARY" : "DANGER").setDisabled(crewquartersStatus === "damaged");

		switch (room) {
			case Rooms.MAINDECK: maindeck.setDisabled(true); break;
			case Rooms.ENGINEBAY: enginebay.setDisabled(true); break;
			case Rooms.CANNONDECK: cannondeck.setDisabled(true); break;
			case Rooms.CROWSNEST: crowsnest.setDisabled(true); break;
			case Rooms.CREWQUARTERS: crewquarters.setDisabled(true); break;

			case Rooms.ONBOARDING: break;
			case Rooms.CAPTAINSQUARTERS: break;
			default: break;
		}

		return [maindeck, enginebay, cannondeck, crowsnest, crewquarters].map(button => {
			return {
				button: button,
				delay: 10,
				delayWaitMessage: this.getMessage("navigation-wait", button.label!),
				delayDenyMessage: this.getMessage("navigation-delay", button.label!),
				callback: this.callbackNavigation.bind(this),
			}
		});
	}

	async callbackNavigation(interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
		const status = await this.redis.get(`mm-space:user-status-${interaction.user.id}`);
		if (status === "brigged") {
			const editMessage = interactionEdit(this.getMessage("onboarding-brigged"));
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({...editMessage, ephemeral: true});
		} else if (status === "dead") {
			const editMessage = interactionEdit(this.getMessage("onboarding-dead"));
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({ ...editMessage, ephemeral: true });
		} else if (status !== "joined") {
			const editMessage = interactionEdit(this.getMessage("onboarding-not-joined"));
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({ ...editMessage, ephemeral: true });
		}

		const nextRoom = action.button.customId?.split("-")[3] as Rooms;
		currentRoom.channel.permissionOverwrites.create(interaction.user.id, { VIEW_CHANNEL: false });
		this.rooms[nextRoom].channel.permissionOverwrites.create(interaction.user.id, { VIEW_CHANNEL: true });

		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> moved to <span class="deck">${this.rooms[nextRoom].name}</span>`);

		const editMessage = interactionEdit(this.getMessage("navigation", this.rooms[nextRoom].channel.id));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({ ...editMessage, ephemeral: true });
	}

	async repairSystem(system: DamageSystems, number: number|Rooms): Promise<void> {
		console.log("repairSystem", system, number);
		switch (system) {
			case DamageSystems.LASER:
				const lasers = await this.redis.lrange(`mm-space:maindeck-laser-status`, 0, 9);
				const indexes = lasers.map((laser, index) => {
					if (laser !== "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];

				number = Math.min(number as number, indexes.length);
				while (number--) maindeckRepairLaser.bind(this)(indexes[number]);
				break;
			case DamageSystems.SHIELD:
				const shields = await this.redis.lrange(`mm-space:enginebay-shields-status`, 0, 9);
				const shieldIndexes = shields.map((shield, index) => {
					if (shield !== "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				number = Math.min(number as number, shieldIndexes.length);
				while (number--) enginebayRepairShield.bind(this)(shieldIndexes[number]);
				break;
			case DamageSystems.CANNON:
				const cannons = await this.redis.lrange(`mm-space:cannondeck-cannon-status`, 0, 19);
				const cannonIndexes = cannons.map((cannon, index) => {
					if (cannon !== "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				number = Math.min(number as number, cannonIndexes.length);
				while (number--) cannondeckRepairCannon.bind(this)(cannonIndexes[number]);
				break;
			case DamageSystems.ROOM:
				if (typeof number === "number") number = ["maindeck", "enginebay", "cannondeck", "crowsnest", "crewquarters"][number] as Rooms;
				if (!(number in this.rooms)) return console.error("Invalid room", number);
				await this.redis.set(`mm-space:room-${number}-status`, "ready");
				this.rooms.maindeck.actions[0] = await this.getNavigation(Rooms.MAINDECK);
				this.rooms.enginebay.actions[0] = await this.getNavigation(Rooms.ENGINEBAY);
				this.rooms.cannondeck.actions[0] = await this.getNavigation(Rooms.CANNONDECK);
				this.rooms.crowsnest.actions[0] = await this.getNavigation(Rooms.CROWSNEST);
				this.rooms.crewquarters.actions[0] = await this.getNavigation(Rooms.CREWQUARTERS);
				Object.values(this.rooms).forEach(room => room.updateMessage());

				this.logger.log(`The <span class="deck">${this.rooms[number].name}</span> has been repaired`);
				break;
		}
	}

	async damageSystem(system: DamageSystems, damage: number | Rooms): Promise<void> {
		console.log("damageSystem", system, damage);
		switch (system) {
			case DamageSystems.LASER:
				const lasers = await this.redis.lrange(`mm-space:maindeck-laser-status`, 0, 9);
				const laserIndexes = lasers.map((laser, index) => {
					if (laser === "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];

				damage = Math.min(damage as number, laserIndexes.length);
				console.log("damanging", laserIndexes.slice(0, damage));
				while (damage--) {
					await maindeckDamageLaser.bind(this)(laserIndexes[damage]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
			case DamageSystems.SHIELD:
				const shields = await this.redis.lrange(`mm-space:enginebay-shields-status`, 0, 9);
				const shieldIndexes = shields.map((shield, index) => {
					if (shield === "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				damage = Math.min(damage as number, shieldIndexes.length);
				console.log("damanging", shieldIndexes.slice(0, damage));
				while (damage--) {
					await enginebayDamageShield.bind(this)(shieldIndexes[damage]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
			case DamageSystems.CANNON:
				const cannons = await this.redis.lrange(`mm-space:cannondeck-cannon-status`, 0, 19);
				const cannonIndexes = cannons.map((cannon, index) => {
					if (cannon === "damaged") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				damage = Math.min(damage as number, cannonIndexes.length);
				console.log("damanging", cannonIndexes.slice(0, damage));
				while (damage--) {
					await cannondeckDamageCannon.bind(this)(cannonIndexes[damage]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
			case DamageSystems.ANY:
				if(typeof damage !== "number") return console.error("Invalid damage", damage);
				let rooms = await this.redis.mget(
					`mm-space:room-maindeck-status`,
					`mm-space:room-enginebay-status`,
					`mm-space:room-cannondeck-status`,
					`mm-space:room-crowsnest-status`,
					`mm-space:room-crewquarters-status`
				);
				const actions = [
					...(rooms[0] !== "damaged" ? (await maindeckGetDamagableSystems.bind(this)()) : []),
					...(rooms[1] !== "damaged" ? (await enginebayGetDamagableSystems.bind(this)()) : []),
					...(rooms[2] !== "damaged" ? (await cannondeckGetDamagableSystems.bind(this)()) : []),
					...(rooms[3] !== "damaged" ? (await crowsnestGetDamagableSystems.bind(this)()) : []),
					...(rooms[4] !== "damaged" ? (await crewquartersGetDamagableSystems.bind(this)()) : []),
				];

				damage = Math.min(damage, actions.length);
				console.log("damanging", damage);
				while (damage--) {
					console.log(actions.length, actions.map(a => a.name));
					const randomIndex = Math.floor(Math.random() * actions.length);
					await actions.splice(randomIndex, 1)[0]();
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
				
			case DamageSystems.ROOM:
				if (typeof damage === "number") damage = ["maindeck", "enginebay", "cannondeck", "crowsnest", "crewquarters"][damage] as Rooms;
				if (!(damage in this.rooms)) return console.error("Invalid room", damage);
				await this.redis.set(`mm-space:room-${damage}-status`, "damaged");
				this.rooms.maindeck.actions[0] = await this.getNavigation(Rooms.MAINDECK);
				this.rooms.enginebay.actions[0] = await this.getNavigation(Rooms.ENGINEBAY);
				this.rooms.cannondeck.actions[0] = await this.getNavigation(Rooms.CANNONDECK);
				this.rooms.crowsnest.actions[0] = await this.getNavigation(Rooms.CROWSNEST);
				this.rooms.crewquarters.actions[0] = await this.getNavigation(Rooms.CREWQUARTERS);
				Object.values(this.rooms).forEach(room => room.updateMessage());

				this.logger.log(`The <span class="deck">${this.rooms[damage].name}</span> has been <span class="bad">destroyed</span>`);
				const crew = this.rooms[damage].channel.permissionOverwrites.cache.filter(perm => perm.type === "member" && perm.allow.has("VIEW_CHANNEL")).map(perm => perm.id);
				crew.forEach(async userId => {
					const user = await this.client.guilds.cache.get("391355330241757205")?.members.fetch(userId);
					const [, interaction] = this.rooms[damage as Rooms].activeInteractions.get(userId) || [];
					if (interaction) {
						const editMessage = interactionEdit(this.getMessage("navigation-death", this.rooms[damage as Rooms].channel.id, userId));
						if (interaction.replied) await interaction.editReply(editMessage);
						else await interaction.reply({ ...editMessage, ephemeral: true });
					} else {
						const editMessage = interactionEdit(this.getMessage("navigation-death", this.rooms[damage as Rooms].channel.id, userId));
						user?.createDM()?.then(channel => channel.send(editMessage));
					}
					this.redis.set(`mm-space:user-status-${userId}`, "dead")
					this.redis.del(`mm-space:delay-${userId}`);

					this.logger.log(`<span class="bad">${user?.displayName}</span> has <span class="bad">died</span> in the destruction of the <span class="deck">${this.rooms[damage as Rooms].name}</span>`);
				
					this.rooms[damage as Rooms].activeInteractions.delete(userId);
					this.rooms[damage as Rooms].channel.permissionOverwrites.create(userId, { VIEW_CHANNEL: false });
					this.rooms.onboarding.channel.permissionOverwrites.create(userId, { VIEW_CHANNEL: true });
				})
				break;
			default:
		}
	}

	async fireSystem(system: DamageSystems, amount: number) {
		console.log("fireSystem", system, amount);
		switch (system) {
			case DamageSystems.LASER:
				const lasers = await this.redis.lrange(`mm-space:maindeck-laser-status`, 0, 9);
				const laserIndexes = lasers.map((laser, index) => {
					if (laser !== "armed") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];

				amount = Math.min(amount as number, laserIndexes.length);
				console.log("firing", laserIndexes.slice(0, amount));
				while (amount--) {
					await maindeckFireLaser.bind(this)(laserIndexes[amount]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
			case DamageSystems.CANNON:
				const cannons = await this.redis.lrange(`mm-space:cannondeck-cannon-status`, 0, 19);
				const cannonIndexes = cannons.map((cannon, index) => {
					if (cannon !== "armed") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				amount = Math.min(amount as number, cannonIndexes.length);
				console.log("firing", cannonIndexes.slice(0, amount));
				while (amount--) {
					await cannondeckFireCannon.bind(this)(cannonIndexes[amount]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
		}
	}

	async unloadSystem(system: DamageSystems, amount: number) {
		console.log("unloadSystem", system, amount);
		switch (system) {
			case DamageSystems.LASER:
				const lasers = await this.redis.lrange(`mm-space:maindeck-laser-status`, 0, 9);
				const laserIndexes = lasers.map((laser, index) => {
					if (laser !== "armed") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];

				amount = Math.min(amount as number, laserIndexes.length);
				console.log("unloading", laserIndexes.slice(0, amount));
				while (amount--) {
					await maindeckUnloadLaser.bind(this)(laserIndexes[amount]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
			case DamageSystems.CANNON:
				const cannons = await this.redis.lrange(`mm-space:cannondeck-cannon-status`, 0, 19);
				const cannonIndexes = cannons.map((cannon, index) => {
					if (cannon !== "armed") return null;
					return index;
				})
					.filter(index => index !== null)
					.sort(() => { return Math.random() < .5 ? 1 : -1 }) as number[];
				
				amount = Math.min(amount as number, cannonIndexes.length);
				console.log("unloading", cannonIndexes.slice(0, amount));
				while (amount--) {
					await cannondeckUnloadCannon.bind(this)(cannonIndexes[amount]);
					await new Promise(resolve => setTimeout(resolve, 100 + (Math.random() * 900)));
				}
				break;
		}
	}

	getMessage(id: string, ...args: string[]): string | MessageEmbed {
		outer: switch (id) {
			case "onboarding-signup": switch (this.shipMode) {
				case People.MONICA: return createEmbed(People.MONICA, "Well hello there~", "Care for a little adventure? Please be so good and press this button to join me today~");
				case People.BILLY: return createEmbed(People.BILLY, "Ahoy lads! Welcome to me ship.", "If ye would like to join me crew today, please press this button to sign up.");
				case People.CHEETOH: return createEmbed(People.CHEETOH, "Hey Dude!", "We're about to go and mine some space rocks and stuff. Wanna come?");
				case People.COMPUTER: return createEmbed(People.COMPUTER, "Welcome aboard!", "You have come across an abandoned space ship. You may press this button to explore it:");
			}
			case "onboarding-welcome": return createEmbed(People.COMPUTER, "Welcome aboard!", "Use these buttons to explore the ship:");
			case "onboarding-joined": return createEmbed(People.COMPUTER, "⚠ Attention", "You already joined the crew.\nUse these buttons to explore the ship:");
			case "onboarding-brigged": return createEmbed(People.COMPUTER, "🛑 Error", "You are in the brig.", LoadingDuration.ERROR);
			case "onboarding-dead": return createEmbed(People.COMPUTER, "🛑 Error", "You are dead. ☠", LoadingDuration.ERROR);
			case "onboarding-not-joined": return createEmbed(People.COMPUTER, "🛑 Error", "You haven't signed up for the ship yet. Head over to <#915016393118867486> to sign up!", LoadingDuration.ERROR);
			case "onboarding-disabled": return createEmbed(People.COMPUTER, "🛑 Error", "Onboarding is currently disabled.", LoadingDuration.ERROR);

			case "navigation-wait": return createEmbed(People.COMPUTER, "🌐 Navigation", "You are currently moving to the **" + args[0] + "**.", LoadingDuration.TEN);
			case "navigation-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", "You are currently moving to the **" + args[0] + "**.", LoadingDuration.ERROR);
			case "navigation-death": return createEmbed(People.COMPUTER, "☠ Death", `The <#${args[0]}> has been destroyed and couldn't make it out in time. Rest in peace, <@${args[1]}>.`);
			case "navigation": return createEmbed(People.COMPUTER, "🌐 Navigation", `You have moved to <#${args[0]}>`)
			// Maindeck
			case "maindeck-description": return createEmbed(People.COMPUTER, "⛵ Main Deck", "This is the Main Deck of the ship. There are Laser Grapplers mounted along the sides which are used to take hold of and bring in loot and cargo.");
				// Lasers
			case "maindeck-laser-arm-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently arming a Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-arm-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already arming this Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-arm-question": return createEmbed(People.COMPUTER, "Laser Grappler", "You sit down at a Laser Grappler turret and prepare to arm it. Which mode do you want to use?");
			case "maindeck-laser-arm-wait": return createEmbed(People.COMPUTER, "Laser Grappler", `You begin loading the Laser Grappler in ${args[0]} Mode. This will take a few seconds...`, LoadingDuration.TWENTYFIVE);
			case "maindeck-laser-punch-question": return createEmbed(People.COMPUTER, "⚠ WARNING!", "Putting the laser into **PUNCH MODE** is considered a war crime. Are you sure you want to do this?");
			case "maindeck-laser-cancel": return createEmbed(People.COMPUTER, "Laser Grappler", "You decide against loading the Laser Grappler.");
			case "maindeck-laser-arm": return createEmbed(People.COMPUTER, "Laser Grappler", `You have loaded the the Laser Grappler into ${args[0]} Mode.`);
			case "maindeck-laser-unload-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently unloading a Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-unload-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already unloading this Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-unload-wait": return createEmbed(People.COMPUTER, "Laser Grappler", `You start unloading this Laser Grappler...`, LoadingDuration.TWENTY);
			case "maindeck-laser-unload": return createEmbed(People.COMPUTER, "Laser Grappler", "You have unloaed the Laser Grappler.");
			case "maindeck-laser-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing a Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing this Laser Grappler.`, LoadingDuration.ERROR);
			case "maindeck-laser-repair-wait": return createEmbed(People.COMPUTER, "Laser Grappler", `You start repairing this Laser Grappler...`, LoadingDuration.THIRTY);
			case "maindeck-laser-repair": return createEmbed(People.COMPUTER, "Laser Grappler", "You have repaired the Laser Grappler.");
				// Poopdeck
			case "maindeck-poopdeck-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently ${args[0] !== "damaged" ? "scrubbing" : "repairing"} the Poop Deck.`, LoadingDuration.ERROR);
			case "maindeck-poopdeck-scrub-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already ${args[0] !== "damaged" ? "scrubbing" : "repairing"} the poop deck.`, LoadingDuration.ERROR);
			case "maindeck-poopdeck-wait":	return createEmbed(People.COMPUTER, "Poop Deck", `You start ${args[0] !== "damaged" ? "scrubbing" : "repairing"} the Poop Deck...`, LoadingDuration.TWENTY);
			case "maindeck-poopdeck-scrub": return createEmbed(People.COMPUTER, "Poop Deck", args[0] !== "damaged" ? "The Poop Deck is squeaky clean! (For now)" : "You have repaired the Poop Deck.");
			case "maindeck-poopdeck-repair": return createEmbed(People.COMPUTER, "Poop Deck", "You have repaired the Poop Deck.");
				// Sails
			case "maindeck-sails-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently bracing the sails.`, LoadingDuration.ERROR);
			case "maindeck-sails-brace": return createEmbed(People.COMPUTER, "Sails", "You are helping to brace the sails. Hold on!", LoadingDuration.TWENTY);
			case "maindeck-sails-done": return createEmbed(People.COMPUTER, "Sails", "You stop bracing the sails.");
			case "maindeck-sails-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the sails.`, LoadingDuration.ERROR);
			case "maindeck-sails-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the sails.`, LoadingDuration.ERROR);
			case "maindeck-sails-repair-wait": return createEmbed(People.COMPUTER, "Sails", `You start repairing the sails...`, LoadingDuration.THIRTY);
			case "maindeck-sails-repair": return createEmbed(People.COMPUTER, "Sails", "The sails have been repaired.");
				// Traps
			case "maindeck-traps-search-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently searching for traps.`, LoadingDuration.ERROR);
			case "maindeck-traps-search-wait": return createEmbed(People.COMPUTER, "Traps", "You start searching for traps...", LoadingDuration.TWENTY);
			case "maindeck-traps-search": return createEmbed(People.COMPUTER, "Traps", "You did not find any traps.");
			case "maindeck-traps-invisible-wait": return createEmbed(People.COMPUTER, "Traps", "You are searching for invisible traps...", LoadingDuration.THIRTY);
			case "maindeck-traps-invisible": return createEmbed(People.COMPUTER, "Traps", "You did not find any invisible traps.");
			case "maindeck-traps-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently searching for the "Search for Traps"-Button.`, LoadingDuration.ERROR);
			case "maindeck-traps-repair-wait": return createEmbed(People.COMPUTER, "Traps", `You start looking for the "Search for Traps"-Button...`, LoadingDuration.THIRTY);
			case "maindeck-traps-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already searching for the "Search for Traps"-Button.`, LoadingDuration.ERROR);
			case "maindeck-traps-repair": return createEmbed(People.COMPUTER, "Traps", `You found the "Search for Traps"-Button.`);
				
			// Enginebay
			case "enginebay-description": return createEmbed(People.COMPUTER, "🎡 Engine Bay", "The Engine Bay is where the ship's engines and shield generators are located. It is where the ship's power is generated and managed.");
				// Shields
			case "enginebay-shields-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently ${args[0]} the shields.`, LoadingDuration.ERROR);
			case "enginebay-shields-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already ${args[0]} the shields.`, LoadingDuration.ERROR);
			case "enginebay-shields-run-question": switch (args[0]) {
				case "Boost": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Accessing the Engineering Terminal.\nWhich part of the Shields do you want to boost?")
				case "Energize": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Hooking into the Engineering Terminal.\nShield Energization Query: From which power source do you wnat to divert the necessary energy?")
				case "Calibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Loggin into the Engineering Terminal.\nWhich seed do you want to use for the calibration?")
				case "Enhance": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Connecting to Engineering Terminal.\nWhich enhancement do you want to apply?")
				case "Brace": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Interlocking with the Engineering Terminal.\nWhich part of the shield do you want to brace for impact?")
				case "Amplify": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Downloading scripts to the Engineering Terminals\nWhich amplification script do you want to run?")
				case "Restore": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Pulling up an Engineering Terminal.\nThe SS5-Shield Restorator requires 5 teracorns of energy to run. From which power source do you want to drain the necessary energy?")
				case "Remix": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Charging Engineering Terminal.\nHow would you like to remix the shields?")
				case "Vibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Jacking into the Engineering Terminal.\nWhich vibration protocol do you want the shields to use?")
				case "Focus": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, "Booting up the Engineering Terminal.\nOn which patterns do you want to focus the shields?")
			}
			case "enginebay-shields-run-wait": switch (args[0]) {
				case "Boost": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Prioritizing ${args[2]} for this shield boost. Please stand by...`, LoadingDuration.TWENTY)
				case "Energize": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Draining the ${args[2]} to energize the shields. Please stand by...`, LoadingDuration.TWENTY)
				case "Calibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Calibrating the shields using ${args[2]}. Please stand by..`, LoadingDuration.TWENTY)
				case "Enhance": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Applying the ${args[2]} Enhancement to the shield array. Please stand by...`, LoadingDuration.TWENTY)
				case "Brace": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Bracing ${args[2]} for impact absorption. Please stand by...`, LoadingDuration.TWENTY)
				case "Amplify": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Running ${args[2]} to amplify the shields. Please stand by...`, LoadingDuration.TWENTY)
				case "Restore": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Diverting energy from the ${args[2]} to restore the shields. Please stand by...`, LoadingDuration.TWENTY)
				case "Remix": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Remixing the shields: ${args[2]}. Please stand by...`, LoadingDuration.TWENTY)
				case "Vibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Loading vibration protocol ${args[2]}. Please stand by...`, LoadingDuration.TWENTY)
				case "Focus": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `Focusing the shields on ${args[2]}. Please stand by...`, LoadingDuration.TWENTY)
			}
			case "enginebay-shields-run": switch (args[0]) {
				case "Boost": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `You boosted the ship's shields.`)
				case "Energize": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `You energized the shields.`)
				case "Calibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `You calibrated the shields with ${args[2] === "Random" ? "a random frequency" : "the frequency "+args[2]}.`)
				case "Enhance": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `You enhanced the shields using ${args[2]}.`)
				case "Brace": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `You braced the shields for impact.`)
				case "Amplify": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `The amplification script was successful.`)
				case "Restore": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `The shields have been restored, using energy from the ${args[2]}.`)
				case "Remix": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `The shields have been remixed.`)
				case "Vibrate": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `The vibration protocol ${args[2]} has been loaded.`)
				case "Focus": return createEmbed(People.COMPUTER, `Shield ${args[1]}`, `The shields are now focused on ${args[2]}.`)
			}
			case "enginebay-shields-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the shields.`, LoadingDuration.ERROR);
			case "enginebay-shields-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the shields.`, LoadingDuration.ERROR);
			case "enginebay-shields-repair-wait":return createEmbed(People.COMPUTER, `Shield ${args[0]}`, `Repairing the shields. Please stand by...`, LoadingDuration.THIRTY);
			case "enginebay-shields-repair": return createEmbed(People.COMPUTER, `Shield ${args[0]}`, `You have repaired the Shield ${args[0]} system.`);
				// Scan Hull
			case "enginebay-scanhull-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently scanning the hull for damages.`, LoadingDuration.ERROR);
			case "enginebay-scanhull-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already scanning the hull.`, LoadingDuration.ERROR);
			case "enginebay-scanhull-run-question": return createEmbed(People.COMPUTER, "Hull Scanner", `Main Engineering console online. Preparing ship-wide hull scan. Which algorithm would you like to run?`);
			case "enginebay-scanhull-run-wait": return createEmbed(People.COMPUTER, "Hull Scanner", `Scanning the hull for ${args[0]}. Please stand by...`, LoadingDuration.TWENTY);
			case "enginebay-scanhull-run": return createEmbed(People.COMPUTER, "Hull Scanner", `The ${args[0]} scan has been completed.`);
			case "enginebay-scanhull-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently reparing the hull scanner.`, LoadingDuration.ERROR);
			case "enginebay-scanhull-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the hull scanner.`, LoadingDuration.ERROR);
			case "enginebay-scanhull-repair-wait": return createEmbed(People.COMPUTER, "Hull Scanner", `Repairing the hull scanner. Please stand by...`, LoadingDuration.THIRTY);
			case "enginebay-scanhull-repair": return createEmbed(People.COMPUTER, "Hull Scanner", `You have repaired the hull scanner.`);
				// Polish Gem
			case "enginebay-polishgem-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently polishing the Gem Core.`, LoadingDuration.ERROR);
			case "enginebay-polishgem-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already polishing the Gem Core.`, LoadingDuration.ERROR);
			case "enginebay-polishgem-run-question": return createEmbed(People.COMPUTER, "Gem Core", `You stand before the ship's Gem Core. A large red gem the size of your head. The massive transfer of energy causes it to require constant polshing in order to prevent cracking.\nWarning: It is very dangerous to polish the Gem Core during an engagement as a shield fluctation could cause an overload which would shock you with upwards of 500 Terracorns of power. Do you want to polish the Gem Core at this moment?`);
			case "enginebay-polishgem-run-wait": return createEmbed(People.COMPUTER, "Gem Core", `You begin to carefully polish the Gem Core...`, LoadingDuration.THIRTY);
			case "enginebay-polishgem-cancel": return createEmbed(People.COMPUTER, "Gem Core", `You decide against polishing the Gem Core for now.`);
			case "enginebay-polishgem-run": return createEmbed(People.COMPUTER, "Gem Core", `You have polished the Gem Core.`);
			case "enginebay-polishgem-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the Gem Core.`, LoadingDuration.ERROR);
			case "enginebay-polishgem-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the Gem Core.`, LoadingDuration.ERROR);
			case "enginebay-polishgem-repair-wait": return createEmbed(People.COMPUTER, "Gem Core", `Sealing the cracks in the Gem Core. Please stand by...`, LoadingDuration.THIRTY);
			case "enginebay-polishgem-repair": return createEmbed(People.COMPUTER, "Gem Core", `You have repaired the Gem Core.`);
				// Overcharge
			case "enginebay-overcharge-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently overcharging the ship.`, LoadingDuration.ERROR); 
			case "enginebay-overcharge-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already overcharging the ship.`, LoadingDuration.ERROR);
			case "enginebay-overcharge-run-question": return createEmbed(People.COMPUTER, "Overcharge", `There is a large lever that can be pulled to overcharge systems on the ship. Do you want to pull one of the Overcharge Switches?\nWarning: It is very dangerous to pull the Overcharge Switch during an engagement as the Gem Core energy could bolt out from shield fluctations with lethal force. Do you want to overcharge all ship systems now?`);
			case "enginebay-overcharge-run-wait": return createEmbed(People.COMPUTER, "Overcharge", `Overcharging the ship. Please stand by...`, LoadingDuration.FORTYFIVE);
			case "enginebay-overcharge-cancel": return createEmbed(People.COMPUTER, "Overcharge", `You decide against overcharging the ship at this time.`);
			case "enginebay-overcharge-run": return createEmbed(People.COMPUTER, "Overcharge", `You have overcharged all ship systems to momentarily increase shipwide efficiency.`);
				// Ignite Mana
			case "enginebay-ignitemana-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently igniting the ship's Mana Folds.`, LoadingDuration.ERROR);
			case "enginebay-ignitemana-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already igniting the ship's Mana Folds.`, LoadingDuration.ERROR);
			case "enginebay-ignitemana-run-question": return createEmbed(People.COMPUTER, "Mana Folds", `Do you want to ignite the Mana Folds to increase the ship's speed for a few seconds?\nWarning: This is extremely dangerous and has led to the death of many Space Squirrels. It should only be done as a last resort for when ship velocity is of the highest priority.`);
			case "enginebay-ignitemana-run-wait": return createEmbed(People.COMPUTER, "Mana Folds", `Igniting the Mana Folds. Please stand by...`, LoadingDuration.THIRTYFIVE);
			case "enginebay-ignitemana-cancel": return createEmbed(People.COMPUTER, "Mana Folds", `You decide against igniting the Mana Folds at this time.`);
			case "enginebay-ignitemana-run": return createEmbed(People.COMPUTER, "Mana Folds", `You have ignited the Mana Folds, creating a burst of speed for the engines.`);
			case "enginebay-ignitemana-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the Mana Folds.`, LoadingDuration.ERROR);
			case "enginebay-ignitemana-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the Mana Folds.`, LoadingDuration.ERROR);
			case "enginebay-ignitemana-repair-wait": return createEmbed(People.COMPUTER, "Mana Folds", `You are repairing the Mana Folds. Please stand by...`, LoadingDuration.THIRTY);
			case "enginebay-ignitemana-repair": return createEmbed(People.COMPUTER, "Mana Folds", `You have repaired the Mana Folds.`);
				// Drain Fluids
			case "enginebay-drainfluids-run-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently draining excess fluids.`, LoadingDuration.ERROR);
			case "enginebay-drainfluids-run-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already draining excess fluids.`, LoadingDuration.ERROR);
			case "enginebay-drainfluids-run-question": return createEmbed(People.COMPUTER, "Fluid Drain", `Do you want to drain excess fluids from the ship's engines?`);
			case "enginebay-drainfluids-run-wait": return createEmbed(People.COMPUTER, "Fluid Drain", `Draining fluids into outer space. Please stand by...`, LoadingDuration.TWENTY);
			case "enginebay-drainfluids-cancel": return createEmbed(People.COMPUTER, "Fluid Drain", `You decide against draining the fluids for now.`);
			case "enginebay-drainfluids-run": return createEmbed(People.COMPUTER, "Fluid Drain", `You have drained excess fluids into open space.`);
			case "enginebay-drainfluids-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the fluid drain.`, LoadingDuration.ERROR);
			case "enginebay-drainfluids-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the fluid drain.`, LoadingDuration.ERROR);
			case "enginebay-drainfluids-repair-wait": return createEmbed(People.COMPUTER, "Fluid Drain", `You are repairing the fluid drain. Please stand by...`, LoadingDuration.THIRTY);
			case "enginebay-drainfluids-repair": return createEmbed(People.COMPUTER, "Fluid Drain", `You have repaired the fluid drain.`);

			// Cannondeck
			case "cannondeck-description": return createEmbed(People.COMPUTER, "💣 Cannon Deck", `This is where you can find the ship's Meteor Cannons. You can load them with ammunition so the captain can use them for combat.`);
				// Cannons
			case "cannondeck-cannon-arm-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently loading a Meteor Cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-arm-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already loading this Meteor Cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-arm-question": return createEmbed(People.COMPUTER, "Meteor Cannons", `Which type of ammunition do you want to load into this cannon?`);
			case "cannondeck-cannon-arm-wait": return createEmbed(People.COMPUTER, "Meteor Cannons", `You are loading ${args[0].toLowerCase()} ammunition into the cannon. Please stand by...`, LoadingDuration.THIRTY);
			case "cannondeck-cannon-arm": return createEmbed(People.COMPUTER, "Meteor Cannons", `You have loaded the Meteor cannon with ${args[0].toLowerCase()} ammunition.`);
			case "cannondeck-cannon-unload-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently unloading a Meteor Cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-unload-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already unloading this Meteor Cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-unload-wait": return createEmbed(People.COMPUTER, "Meteor Cannons", `You are unloading the cannon. Please stand by...`, LoadingDuration.THIRTY);
			case "cannondeck-cannon-unload": return createEmbed(People.COMPUTER, "Meteor Cannons", `You have unloaded the Meteor Cannon.`);
			case "cannondeck-cannon-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the cannon.`, LoadingDuration.ERROR);
			case "cannondeck-cannon-repair-wait": return createEmbed(People.COMPUTER, "Meteor Cannons", `You are repairing the cannon. Please stand by...`, LoadingDuration.THIRTY);
			case "cannondeck-cannon-repair": return createEmbed(People.COMPUTER, "Meteor Cannons", `You have repaired the Meteor Cannon.`);

			// Crowsnest
			case "crowsnest-description": return createEmbed(People.COMPUTER, "🧭 Crowsnest", `This is the ship's Crowsnest. Here you can check on the generators for the Atmospheric Stability System and perform communication and navigation tasks.`);
				// Generator
			case "crowsnest-generator-charge-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently charging the Atmospheric Generator.`, LoadingDuration.ERROR);
			case "crowsnest-generator-charge-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already charging the Atmospheric Generator.`, LoadingDuration.ERROR);
			case "crowsnest-generator-charge-wait": return createEmbed(People.COMPUTER, "Atmospheric Generator", `You are charging the Atmospheric Generator. Please stand by...`, LoadingDuration.TWENTY);
			case "crowsnest-generator-charge": return createEmbed(People.COMPUTER, "Atmospheric Generator", `You have charged the Atmospheric Generator.`);
			case "crowsnest-generator-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the Atmospheric Generator.`, LoadingDuration.ERROR);
			case "crowsnest-generator-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the Atmospheric Generator.`, LoadingDuration.ERROR);
			case "crowsnest-generator-repair-wait": return createEmbed(People.COMPUTER, "Atmospheric Generator", `You are repairing the Atmospheric Generator. Please stand by...`, LoadingDuration.THIRTY);
			case "crowsnest-generator-repair": return createEmbed(People.COMPUTER, "Atmospheric Generator", `You have repaired the Atmospheric Generator.`);
				// Telescope
			case "crowsnest-telescope-use-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently using the Galaxy Telescope.`, LoadingDuration.ERROR);
			case "crowsnest-telescope-use-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already using the Galaxy Telescope.`, LoadingDuration.ERROR);
			case "crowsnest-telescope-use-wait": return createEmbed(People.COMPUTER, "Galaxy Telescope", `You check the sectors surrounding the ship for anything noteworthy and find...`, LoadingDuration.TWENTYFIVE);
			case "crowsnest-telescope-scout-nothing": return createEmbed(People.COMPUTER, "Galaxy Telescope", `Your search resulted in nothing of interest.`);
			case "crowsnest-telescope-scout-found": return createEmbed(People.COMPUTER, "Galaxy Telescope", `You found **${args[0]}**!`);
			case "crowsnest-telescope-blocked": return createEmbed(People.COMPUTER, "Galaxy Telescope", `You recently used the Galaxy Telescope. Please wait at least ${args[0]}.`);
			case "crowsnest-telescope-followup": return createEmbed(People.COMPUTER, "Galaxy Telescope", args[0], LoadingDuration.THIRTYFIVE);
			case "crowsnest-telescope-finish": return createEmbed(People.COMPUTER, "Galaxy Telescope", args[0]);
			case "crowsnest-telescope-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the Galaxy Telescope.`, LoadingDuration.ERROR);
			case "crowsnest-telescope-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the Galaxy Telescope.`, LoadingDuration.ERROR);
			case "crowsnest-telescope-repair-wait": return createEmbed(People.COMPUTER, "Galaxy Telescope", `You are repairing the Galaxy Telescope. Please stand by...`, LoadingDuration.THIRTY);
			case "crowsnest-telescope-repair": return createEmbed(People.COMPUTER, "Galaxy Telescope", `You have repaired the Galaxy Telescope.`);

			// Crewquarters
			case "crewquarters-description": return createEmbed(People.COMPUTER, "🐭 Crew Quarters", `This is the ship's Crew Quarters. The captain uses these systems to gauge the crew's health and vibe. This is also where the emergency life boats are accessed in case of an emergency.`);
				// Vibe
			case "crewquarters-vibe-report-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently reporting your vibe to the captain.`, LoadingDuration.ERROR);
			case "crewquarters-vibe-report-wait": return createEmbed(People.COMPUTER, "Vibe Report", `You are reporting your vibe to the captain. Please stand by...`, LoadingDuration.TEN);
			case "crewquarters-vibe-reported": return createEmbed(People.COMPUTER, "Vibe Report", `You submitted your report of feeling ${args[0]}.`);
			case "crewquarters-vibe-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the vibe buttons.`, LoadingDuration.ERROR);
			case "crewquarters-vibe-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the vibe buttons.`, LoadingDuration.ERROR);
			case "crewquarters-vibe-repair-wait": return createEmbed(People.COMPUTER, "Vibe Repair", `You are repairing the vibe buttons. Please stand by...`, LoadingDuration.THIRTY);
			case "crewquarters-vibe-repair": return createEmbed(People.COMPUTER, "Vibe Repair", `You have repaired the ability for the crew to report feeling ${args[0]}.`);
				// Lifeboat
			case "crewquarters-lifeboat-enter-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently entering a lifeboat.`, LoadingDuration.ERROR);
			case "crewquarters-lifeboat-enter-wait": return createEmbed(People.COMPUTER, "Lifeboat", `You are entering a lifeboat. Please stand by...`, LoadingDuration.FIFTEEN);
			case "crewquarters-lifeboat-enter": return createEmbed(People.COMPUTER, "Lifeboat", `You have entered a lifeboat. Please wait for the captain to launch it.`);
			case "crewquarters-lifeboat-wait-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently sitting in a lifeboat.`, LoadingDuration.ERROR);
			case "crewquarters-lifeboat-leave": return createEmbed(People.COMPUTER, "Lifeboat", `You have left the lifeboat.`);
			case "crewquarters-lifeboat-escape": return createEmbed(People.COMPUTER, "Lifeboat", `The captain has launched your life boat and you have escaped together with ${oxfordJoin(args.map(id => `<@${id}>`))}.`);
			case "crewquarters-lifeboat-repair-delay": return createEmbed(People.COMPUTER, "🛑 ERROR", `You are currently repairing the lifeboat.`, LoadingDuration.ERROR);
			case "crewquarters-lifeboat-repair-exclusive": return createEmbed(People.COMPUTER, "🛑 ERROR", `{user} is already repairing the lifeboat.`, LoadingDuration.ERROR);
			case "crewquarters-lifeboat-repair-wait": return createEmbed(People.COMPUTER, "Lifeboat", `You are repairing the lifeboat. Please stand by...`, LoadingDuration.THIRTY);
			case "crewquarters-lifeboat-repair": return createEmbed(People.COMPUTER, "Lifeboat", `You have repaired the lifeboat.`);
		}
		return `missing text: \`${id}\`${args.length ? ` with args: \`${args.join(", ")}\`` : ""}`;
	}

	async getState() {
		enum RedisType {
			VALUE, LIST5, LIST10, LIST15, LIST20,
			COUNT
		}

		const redisKeys = {
			"ship-mode": RedisType.VALUE,
			"ship-occupants-maindeck": RedisType.COUNT,
			"ship-occupants-enginebay": RedisType.COUNT,
			"ship-occupants-cannondeck": RedisType.COUNT,
			"ship-occupants-crowsnest": RedisType.COUNT,
			"ship-occupants-crewquarters": RedisType.COUNT,

			"maindeck-laser-status": RedisType.LIST10,
			"maindeck-poopdeck-status": RedisType.VALUE,
			"maindeck-sails-status": RedisType.VALUE,
			"maindeck-traps-status": RedisType.VALUE,

			"enginebay-shields-status": RedisType.LIST10,
			"enginebay-shields-vibrate": RedisType.VALUE,
			"enginebay-shields-focus": RedisType.VALUE,
			"enginebay-shields-enhance": RedisType.VALUE,
			"enginebay-shields-calibrate": RedisType.VALUE,
			"enginebay-scanhull-status": RedisType.VALUE,
			"enginebay-polishgem-status": RedisType.VALUE,
			"enginebay-overcharge-status": RedisType.VALUE,
			"enginebay-ignitemana-status": RedisType.VALUE,
			"enginebay-drainfluids-status": RedisType.VALUE,

			"cannondeck-cannon-status": RedisType.LIST20,

			"crowsnest-generator-status": RedisType.LIST5,
			"crowsnest-telescope-status": RedisType.VALUE,
			"crowsnest-starchart-status": RedisType.VALUE,
			"crowsnest-ravens-status": RedisType.VALUE,
			"crowsnest-scanner-status": RedisType.VALUE,

			"crewquarters-vibe-status": RedisType.LIST5,
		};
		const vibeStatsPromise = this.redis.keys("mm-space:user-vibe-*").then(keys => keys.length > 0 ? this.redis.mget(...keys) : []);

		const values = await Promise.all(Object.entries(redisKeys).map(async ([key, type]) => {
			switch (type) {
				case RedisType.VALUE: return `${key},${await this.redis.get("mm-space:" + key) || "ready"}`;
				case RedisType.LIST5: return `${key},${await this.redis.lrange("mm-space:" + key, 0, 4).then(list => list.join(","))}`;
				case RedisType.LIST10: return `${key},${await this.redis.lrange("mm-space:" + key, 0, 9).then(list => list.join(","))}`;
				case RedisType.LIST15: return `${key},${await this.redis.lrange("mm-space:" + key, 0, 14).then(list => list.join(","))}`;
				case RedisType.LIST20: return `${key},${await this.redis.lrange("mm-space:" + key, 0, 19).then(list => list.join(","))}`;
				case RedisType.COUNT:
					const room = key.split("-")[2] as Rooms;
					const occupants = this.rooms[room].channel.permissionOverwrites.cache.filter(perm => perm.type === "member" && perm.allow.has("VIEW_CHANNEL")).size;
					return `${key},${occupants}`;
			}
		}) as Promise<string | string[]>[]);

		const vibeStats = {
			happy: 0,
			sad: 0,
			anger: 0,
			fear: 0,
			chill: 0,
		};
			
		((await vibeStatsPromise).filter(Boolean) as (keyof typeof vibeStats)[]).forEach((vibe) => vibeStats[vibe]++);

		const vibeTotal = Object.values(vibeStats).reduce((acc, val) => acc + val, 0);
		const vibePercent = Object.entries(vibeStats).map(([key, val]) => [key, vibeTotal == 0 ? 0 : Math.round(val / vibeTotal * 100)]);

		values.push(...vibePercent.map(([key, value]) => `crewquarters-vibe-${key},${value}`));
		values.push(`crewquarters-vibe-total,${vibeTotal}`);

		values.push(...(await Promise.all([1,2,3,4,5].map(i => this.redis.scard(`mm-space:crewquarters-lifeboat-crew${i}`)))).map((nr, i) => `crewquarters-lifeboat-crew${i+1},${nr}`));

		const status = values.join(",\r\n")+",";
		this.logger.statusupdate(status);
		return status;
	}

}