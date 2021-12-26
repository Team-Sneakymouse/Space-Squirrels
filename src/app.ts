import { Client, Intents, Message, MessageOptions, MessagePayload, Snowflake, TextChannel } from "discord.js";
import express from "express";
import ws from "ws";
import redis from "ioredis";
import SpaceSquirrels, { DamageSystems } from "./SpaceSquirrels";
import { Logger } from "./utils";
import { crewquartersLaunchLifeboats } from "./RoomCrewquarters";
import { interactionEdit } from "./Room";

const redisClient = new redis("redis");
const app = express();
let spaceSqirrels: SpaceSquirrels;

app.get("/", (req, res) => {
	res.send("Hello World!");
});

app.get("/status", async (req, res) => {
	while (!spaceSqirrels) await new Promise((resolve) => setTimeout(resolve, 100));
	res.setHeader("Content-Type", "text/plain");
	res.send(await spaceSqirrels.getState());
});

app.get("/important", async (req, res) => {
	const log = await redisClient.lrange("mm-space:ship-log-important", -50, -1);
	res.setHeader("Content-Type", "text/plain");
	res.send(log.join(",\r\n")+",");
});

app.get("/notimportant", async (req, res) => {
	const log = await redisClient.lrange("mm-space:ship-log-notimportant", -50, -1);
	res.setHeader("Content-Type", "text/plain");
	res.send(log.join(",\r\n")+",");
});

app.post("/log", express.text({ type: "*/*" }), async (req, res) => {
	spaceSqirrels.logger.log(req.body);
	res.send("ok");
});

app.post("/clearShip", async (req, res) => {
	const keys = await redisClient.keys("mm-space:user-status-*");
	if (keys.length > 0) await redisClient.del(...keys);
	if (!spaceSqirrels) return res.send("not ok");
	
	redisClient.del("mm-space:ship-occupants-total");
	redisClient.del("mm-space:crewquarters-lifeboat-crew1", "mm-space:crewquarters-lifeboat-crew2", "mm-space:crewquarters-lifeboat-crew3", "mm-space:crewquarters-lifeboat-crew4", "mm-space:crewquarters-lifeboat-crew5");
	redisClient.del(...(await redisClient.keys("mm-space:exclusive-*")), "")
	redisClient.del(...(await redisClient.keys("mm-space:delay-*")), "")


	spaceSqirrels.rooms.onboarding.channel.permissionOverwrites.cache.forEach(overwrite => overwrite.type == "member" && overwrite.delete());
	const rooms = [
		spaceSqirrels.rooms.maindeck,
		spaceSqirrels.rooms.enginebay,
		spaceSqirrels.rooms.cannondeck,
		spaceSqirrels.rooms.crowsnest,
		spaceSqirrels.rooms.crewquarters,
	]

	rooms.forEach(room => { 
		const crew = room.channel.permissionOverwrites.cache.filter(perm => perm.type === "member" && perm.allow.has("VIEW_CHANNEL")).map(perm => perm.id);
		crew.forEach(async userId => {
			redisClient.del(`mm-space:user-status-${userId}`);
			room.activeInteractions.delete(userId);
			room.channel.permissionOverwrites.delete(userId);
			spaceSqirrels!.rooms.onboarding.channel.permissionOverwrites.delete(userId);
		})
	})
	
	res.send("ok");
});

app.post("/api", express.text({ type: "*/*" }), async (req, res) => {
	res.send("OK");
	while(!spaceSqirrels) await new Promise((resolve) => setTimeout(resolve, 100));
	const args = req.body.split(" ");
	switch (args[0]) {
		case "repair":
			if (args[1] === "laser") return spaceSqirrels.repairSystem(DamageSystems.LASER, parseInt(args[2]));
			if (args[1] === "shield") return spaceSqirrels.repairSystem(DamageSystems.SHIELD, parseInt(args[2]));
			if (args[1] === "cannon") return spaceSqirrels.repairSystem(DamageSystems.CANNON, parseInt(args[2]));
			if (args[1] === "room") return spaceSqirrels.repairSystem(DamageSystems.ROOM, args[2]);
			return console.log("Unknown repair command: ", args);
		case "damage":
			if (args[1] === "laser") return spaceSqirrels.damageSystem(DamageSystems.LASER, parseInt(args[2]));
			if (args[1] === "shield") return spaceSqirrels.damageSystem(DamageSystems.SHIELD, parseInt(args[2]));
			if (args[1] === "cannon") return spaceSqirrels.damageSystem(DamageSystems.CANNON, parseInt(args[2]));
			if (args[1] === "any") return spaceSqirrels.damageSystem(DamageSystems.ANY, parseInt(args[2]));
			if (args[1] === "room") return spaceSqirrels.damageSystem(DamageSystems.ROOM, args[2]);
			return console.log("Unknown damage command: ", args);
		case "load":
			return console.log("Unknown load command: ", args);
		case "unload":
			if (args[1] === "laser") return spaceSqirrels.unloadSystem(DamageSystems.LASER, parseInt(args[2]));
			if (args[1] === "cannon") return spaceSqirrels.unloadSystem(DamageSystems.CANNON, parseInt(args[2]));
			return console.log("Unknown unload command: ", args);
		case "fire":
			if (args[1] === "laser") return spaceSqirrels.fireSystem(DamageSystems.LASER, parseInt(args[2]));
			if (args[1] === "cannon") return spaceSqirrels.fireSystem(DamageSystems.CANNON, parseInt(args[2]));
			return console.log("Unknown fire command: ", args);
		case "launch":
			return crewquartersLaunchLifeboats.bind(spaceSqirrels)();
			
	}
	console.log(req.body);
});

const wsServer = new ws.Server({ noServer: true });
const sockets = new Set<ws>();
wsServer.on("connection", async (socket) => {
	sockets.add(socket);
	await spaceSqirrels?.getState();
	socket.send("n"+(await redisClient.lrange("mm-space:ship-log-notimportant", -50, -1)).join("\r\n"));
	socket.on("message", async (message) => {
		console.log(message.toString("utf8"));
		//socket.emit("message", message)
	});
	socket.on("close", () => {
		sockets.delete(socket);
	});
});

const server = app.listen(8080, async () => {
	console.log("Server started on port 8080");
	while (true) {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		if (sockets.size > 0) spaceSqirrels?.getState()
	}
});
server.on("upgrade", (request, socket, head) => {
	wsServer.handleUpgrade(request, socket, head, (ws) => {
		wsServer.emit("connection", ws, request);
	});
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.once("ready", async () => {
	spaceSqirrels = await new SpaceSquirrels(client, redisClient, new Logger(redisClient, sockets)).init;
	console.log("Discord ready");
	//console.log(await spaceSqirrels.getState());
});

client.login(process.env.DISCORD_TOKEN);