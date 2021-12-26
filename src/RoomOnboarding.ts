import { ButtonInteraction, GuildMember, Message, MessageActionRow, MessageButton } from "discord.js";
import Room, { Action, interactionEdit } from "./Room";
import SpaceSquirrels from "./SpaceSquirrels";
import { People, Rooms } from "./utils";

const roles: {
	[key in People]: string;
} = {
	[People.BILLY]: "915298239228575754",
	[People.MONICA]: "915298753370537995",
	[People.CHEETOH]: "915299026977587301",
	[People.COMPUTER]: "",
}

export default function roomOnboarding(spaceSquirrels: SpaceSquirrels) {
	const roomOnboarding = new Room({
		name: "Onboarding",
		channelId: "915016393118867486",
		messageId: "915156299195506728",
		threadId: null,
		messageContent: spaceSquirrels.getMessage("onboarding-signup"),
		actionRows: [[{
			button: new MessageButton().setCustomId("space-onboarding-signup").setLabel("Sign me Up!").setStyle("PRIMARY"),
			callback: callbackSignup.bind(spaceSquirrels).bind(spaceSquirrels),
		}]],
	}, spaceSquirrels.client, spaceSquirrels.redis);

	spaceSquirrels.getNavigation(Rooms.ONBOARDING).then(actions => actions.forEach(action => roomOnboarding.actionMap.set(action.button.customId!, action)));

	return roomOnboarding
}

async function callbackSignup(this: SpaceSquirrels, interaction: ButtonInteraction, currentRoom: Room, action: Action): Promise<any> {
	if (await this.redis.get("mm-space:ship-onboarding") === "false") {
		const editMessage = interactionEdit(this.getMessage("onboarding-disabled"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
	
	const status = await this.redis.get(`mm-space:user-status-${interaction.user.id}`);
	if (status === "joined") {
		const editMessage = interactionEdit(this.getMessage("onboarding-joined"), await this.getNavigation(Rooms.ONBOARDING));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (status === "brigged") {
		const editMessage = interactionEdit(this.getMessage("onboarding-brigged"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else if (status === "dead") {
		const editMessage = interactionEdit(this.getMessage("onboarding-dead"));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	} else {
		await this.redis.set(`mm-space:user-status-${interaction.user.id}`, "joined");
		this.redis.incr("mm-space:ship-occupants-total");
		this.logger.log(`<span class="user">${(interaction.member as GuildMember).displayName}</span> has joined <span class="${this.shipMode}">${this.shipMode.charAt(0).toUpperCase() + this.shipMode.slice(1)}'s</span> crew`);

		if(roles[this.shipMode]) (interaction.member as GuildMember).roles.add(roles[this.shipMode]);

		const editMessage = interactionEdit(this.getMessage("onboarding-welcome"), await this.getNavigation(Rooms.ONBOARDING));
		if (interaction.replied) return interaction.editReply(editMessage)
		else return interaction.reply({...editMessage, ephemeral: true});
	}
}
