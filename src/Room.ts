import { ButtonInteraction, Client, Message, InteractionButtonOptions, TextChannel, ThreadChannel, MessageButton, MessagePayload, InteractionReplyOptions, BaseMessageComponentOptions, MessageActionRow, MessageActionRowOptions, Interaction, Snowflake, WebhookClient, MessageEmbed, MessageEditOptions, WebhookEditMessageOptions } from "discord.js";
import { Redis } from "ioredis";

interface RoomOptions {
	name: string;
	channelId: string;
	channelName?: string;
	channelDescription?: string;
	messageId: string | null;
	messageContent: string | MessageEmbed;
	threadId?: string | null;
	actionRows?: Action[][];
};

export type Action = BaseAction & (DelayAction | InstantAction) & (SingleUserAction | MultipleUserAction) & (CallbackAction | ChoiceAction);
type RecursiveAction = BaseAction & (DelayAction | InstantAction) & (CallbackAction | ChoiceAction);
type BaseAction = {
	button: MessageButton;	// the button to use for this action
};

export type DelayAction = {
	delay: number;					// number of seconds to delay the response
	delayWaitMessage: string | MessageEmbed; // message to display while waiting for the delay to expire
	delayDenyMessage: string | MessageEmbed;		// error message if user tries to do something else
}
type InstantAction = {
}

type SingleUserAction = {
	exclusiveId: string;			// id of this action group
	exclusiveDenyMessage: string | MessageEmbed;	// error message if action group is not empty
}
type MultipleUserAction = {
}

type CallbackAction = {
	callback: (interaction: ButtonInteraction, room: Room, action: Action) => Promise<any>;
};
type ChoiceAction = {
	question: string | MessageEmbed;
	choices: RecursiveAction[];
};

const buttonWaitExceptions = [
	"space-crewquarters-lifeboat-0-leave",
	"space-crewquarters-lifeboat-1-leave",
	"space-crewquarters-lifeboat-2-leave",
	"space-crewquarters-lifeboat-3-leave",
	"space-crewquarters-lifeboat-4-leave",
]

export default class Room {;
	init: Promise<this>;
	client: Client;
	redis: Redis;

	activeInteractions: Map<Snowflake, [Action, ButtonInteraction]>;
	actionMap: Map<string, Action>;

	name!: string;
	channel!: TextChannel;
	message!: Message;
	thread!: ThreadChannel | null;
	actions!: Action[][];
	updateMessage!: () => Promise<any>;

	constructor(options: RoomOptions, client: Client, redis: Redis){
		this.client = client;
		this.redis = redis;
		this.init = this._init(options);

		this.activeInteractions = new Map();
		this.actionMap = new Map();
		this.client.on("interactionCreate", (interaction) => {
			if (!interaction.isButton()) return;
			if (interaction.channelId !== this.channel.id) return;
			
			const action = this.actionMap.get(interaction.customId);
			if (action) this.buttonClickListener(action, interaction);
			else console.log(`There should be an action for ${interaction.customId} in ${this.name}, but there isn't.`);
		})
	}

	async _init(options: RoomOptions) {
		this.name = options.name;
		this.actions = options.actionRows || [];
		this.channel = this.client.channels.cache.get(options.channelId) as TextChannel;
		if (!this.channel) this.channel = await this.client.channels.fetch(options.channelId) as TextChannel;
		if (options.messageId)
			this.message = await this.channel.messages.fetch(options.messageId);
		else this.message = await this.channel.send({
			content: typeof options.messageContent === "string" ? options.messageContent : "\u00A0",
			embeds: typeof options.messageContent === "string" ? undefined : [options.messageContent],
			components: this.actions.map(row =>
				new MessageActionRow().setComponents(row.map(action => action.button))
			)
		});
		if (options.threadId)
			this.thread = this.client.channels.cache.get(options.threadId) as ThreadChannel;
		else if (options.threadId === undefined) this.thread = await this.channel.threads.create({
			name: "Chat Thread",
			autoArchiveDuration: 1440
		})
		else if (options.threadId === null) this.thread = null;

		if (options.channelName || options.channelDescription)
			this.channel.edit({
				name: options.channelName,
				topic: options.channelDescription
			})

		if (options.messageContent || this.actions) {
			// disable buttons of actions that are curretnly in use
			//if (this.actions) {
			//	const exclusiveActions = this.actions.flat().filter(action => "exclusive" in action);
			//	await Promise.all(exclusiveActions.map(async action => {
			//		const delayExists = !!(await this.redis.get(`mm-space:exclusive-${(action as SingleUserAction).exclusiveId}`));
			//		action.button.setDisabled(delayExists);
			//	}))
			//}
			
			this.updateMessage = async () => {
				//this
				await this.message.edit(interactionEdit(options.messageContent, this.actions));
			}
			this.updateMessage();
		}

		const buttonIds = new Set<string>();
		if (this.actions && this.actions.length > 5) throw new Error("Too many button rows");
		const recursiveCheck = (row: Action[], index: number) => {
			if (row.length > 5) throw new Error(`Too many buttons in row ${index}`)
			row.forEach(action => {
				if (buttonIds.has(action.button.customId!)) throw new Error(`Button ${action.button.customId} already exists`);
				buttonIds.add(action.button.customId!);
				if ("choices" in action) recursiveCheck(action.choices, index);

				this.actionMap.set(action.button.customId!, action);
			});
		}
		this.actions?.forEach(recursiveCheck);
		
		return this;
	}

	async buttonClickListener(action: Action, interaction: ButtonInteraction): Promise<any> {
		// ignore interactions that aren't for this button
		if (!interaction.isButton()) return;
		if (interaction.customId !== action.button.customId) return;
		if (interaction.channelId !== this.channel.id) return;
		
		// error if this user is currently waiting for another action
		let delayError = false;
		if (!buttonWaitExceptions.includes(interaction.customId)) delayError = !!(await this.redis.get(`mm-space:delay-${interaction.user.id}`));
		if (delayError) {
			const val = this.activeInteractions.get(interaction.user.id)
			if (val) return interaction.reply({...interactionEdit((val[0] as DelayAction).delayDenyMessage), ephemeral: true});
			return interaction.reply({...interactionEdit("You are currently waiting for another action to finish."), ephemeral: true});
		}

		// error if another user is currently using this action s
		if ("exclusiveId" in action && "exclusiveDenyMessage" in action) {
			const userId = await this.redis.get(`mm-space:exclusive-${action.exclusiveId}`);
			if (userId) {
				let message: string | MessageEmbed;
				if (typeof action.exclusiveDenyMessage === "string") {
					message = action.exclusiveDenyMessage.replace(/\$\{user\}/g, `<@${userId}>`);
				} else {
					message = action.exclusiveDenyMessage;
					if (message.description) message.description = message.description.replace(/\{user\}/g, `<@${userId}>`);
				}
				return interaction.reply({...interactionEdit(message), ephemeral: true});
			}
		}

		// delay handling
		if ("delay" in action) {
			// only need to set exclusive markers here because otherwise they'd complete instantly
			if ("exclusiveId" in action) {
				this.redis.set(`mm-space:exclusive-${action.exclusiveId}`, interaction.user.id, "EX", action.delay);
				// disable button and update message
				// action.button.disabled = true;
				// this.message.edit(interactionMessage(this.message.content, this.actions));
			}
			this.redis.set(`mm-space:delay-${interaction.user.id}`, action.button.customId, "EX", action.delay);
			this.activeInteractions.set(interaction.user.id, [action, interaction]);

			let message: string | MessageEmbed;
			if (typeof action.delayWaitMessage === "string") {
				message = action.delayWaitMessage.replace(/\$\{delay\}/g, action.delay.toString());
			} else {
				message = action.delayWaitMessage;
				if (message.description) message.description = message.description.replace(/\$\{delay\}/g, action.delay.toString());
			}

			interaction.reply({...interactionEdit(message), ephemeral: true});
			const delayMs = action.delay * 1000;
			await new Promise(resolve => setTimeout(resolve, delayMs));

			if (!this.activeInteractions.delete(interaction.user.id)) return; // if the interaction is not in the set anymore, it has been cancelled

			// if ("exclusive" in action) {
			// 	action.button.disabled = false;
			// 	this.message.edit(interactionMessage(this.message.content, this.actions));
			// }
		}

		if ("callback" in action) {
			return action.callback(interaction, this, action)
		};
		if ("choices" in action) {
			const editMessage = interactionEdit(action.question, action.choices)
			if (interaction.replied) return interaction.editReply(editMessage)
			else return interaction.reply({...editMessage, ephemeral: true});
		}
	}

	addActionsRecursive(action: Action | Action[]) {
		if (Array.isArray(action)) {
			action.forEach(a => this.addActionsRecursive(a));
			return;
		}
		this.actionMap.set(action.button.customId!, action);
		if ("choices" in action) {
			action.choices.forEach(choice => this.addActionsRecursive(choice));
		}
	}
}

export function interactionEdit(message: string | MessageEmbed, actions?: Action | Action[] | Action[][]): WebhookEditMessageOptions {
	let components: (MessageActionRow | (Required<BaseMessageComponentOptions> & MessageActionRowOptions))[] | undefined = undefined;
	
	if (actions) {
		if (!Array.isArray(actions)) components = [new MessageActionRow().setComponents([actions.button])];
		else if (actions.length === 0) components = undefined;
		else if (!Array.isArray(actions[0])) components = [new MessageActionRow().setComponents((actions as Action[]).map(action => action.button))];
		else components = (actions as Action[][]).map(row => new MessageActionRow().setComponents(row.map(action => action.button)));
	}

	return {
		content: typeof message === "string" ? message : "\u00A0",
		embeds: typeof message === "string" ? undefined : [message],
		components
	}
}

function findAction(actions: Action[][] | Action[], evaluator: (action: Action) => boolean): Action | undefined {
	for (const action of actions) {
		if (Array.isArray(action)) {
			const found = findAction(action, evaluator);
			if (found) return found;
		} else {
			if (evaluator(action)) return action;
			if ("choices" in action) return findAction(action.choices, evaluator);
		}
	}
}