import { MessageEmbed } from "discord.js";
import { Redis } from "ioredis";
import ws from "ws";

export class Logger {
	redis: Redis;
	sockets: Set<ws>;
	
	constructor(redis: Redis, sockets: Set<ws>) {
		this.redis = redis;
		this.sockets = sockets;
	}

	statusupdate(status: string) {
		if (this.sockets.size > 0) this.sockets.forEach(s => {
			var i = 0;
			for (let line of status.split("\r\n")) {
				s.send("s" + line + "\r\n");
			}
		});
	}

	log(arg: string) {
		this.redis.rpush("mm-space:ship-log-notimportant", arg);
		this.redis.rpush("mm-space:ship-log-important", arg);
		console.log(arg);
		if (this.sockets.size > 0) this.sockets.forEach(s => {
			s.send("n" + arg);
			s.send("i" + arg);
		});
	}

	important(arg: string) {
		this.redis.rpush("mm-space:ship-log-important", arg);
		this.log(arg);
		if(this.sockets.size > 0) this.sockets.forEach(s => s.send("i"+arg));
	}
}

export enum People {
	MONICA = "monica",
	BILLY = "billy",
	CHEETOH = "cheetoh",
	COMPUTER = "computer",
}

export enum Rooms {
	ONBOARDING = "onboarding",
	MAINDECK = "maindeck",
	ENGINEBAY = "enginebay",
	CANNONDECK = "cannondeck",
	CROWSNEST = "crowsnest",
	CREWQUARTERS = "crewquarters",
	CAPTAINSQUARTERS = "captainsquarters",
}

export enum LoadingDuration {
	TEN = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_10.gif",
	FIFTEEN = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_15.gif",
	TWENTY = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_20.gif",
	TWENTYFIVE = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_25.gif",
	THIRTY = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_30.gif",
	THIRTYFIVE = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_35.gif",
	FORTY = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_40.gif",
	FORTYFIVE = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_45.gif",
	FIFTY = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_50.gif",
	FIFTYFIVE = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_55.gif",
	SIXTY = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_60.gif",
	ERROR = "https://files.sneakyrp.com/space/spaceSquirrelsLoading_error.gif",
}

export function createEmbed(name: People, greeting: string, text: string, duration?: LoadingDuration) {
	switch (name) {
		case People.MONICA:
			return new MessageEmbed({
				author: { name: "Monica Rupert" },
				thumbnail: { url: "https://i.danidipp.com/V7U7r.jpg" },
				color: 0xF238E9,
				title: greeting,
				description: text,
				image: duration ? { url: duration } : undefined,
			})
		case People.BILLY:
			return new MessageEmbed({
				author: { name: "Billy the Pirate" },
				thumbnail: { url: "https://i.danidipp.com/JC48w.png" },
				color: 0xBB0905,
				title: greeting,
				description: text,
				image: duration ? { url: duration } : undefined,
			})
		case People.CHEETOH:
			return new MessageEmbed({
				author: { name: "Cheetoh Bandito" },
				thumbnail: { url: "https://i.danidipp.com/yfv4g.png" },
				color: 0xF27938,
				title: greeting,
				description: text,
				image: duration ? { url: duration } : undefined,
			})
		case People.COMPUTER:
			return new MessageEmbed({
				author: { name: "Computer" },
				thumbnail: { url: "https://i.danidipp.com/xI62C.png" },
				color: 0x7BB7B7,
				title: greeting,
				description: text,
				image: duration ? { url: duration } : undefined,
			})
	}
}

export function oxfordJoin(arr: string[]) {
	if (arr.length == 0) return "";
	if (arr.length == 1) return arr[0];
	if (arr.length == 2) return arr[0] + " and " + arr[1];
	var last = arr.pop();
	return arr.join(", ") + ", and " + last;
}