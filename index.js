import WebSocket from "ws";
import { connect } from "undici";
import config from "./config.js";




let ws;
let reconnectInterval;
const guilds = {};

async function setupWebSocket() {
    ws = new WebSocket(`wss://gateway.discord.gg/us-east`);

    ws.on("open", handleWebSocketOpen);
    ws.on("message", handleMessage);
    ws.on("close", handleWebSocketClose);
    ws.on("error", handleWebSocketError);
}
function handleWebSocketOpen() {
    ws.send(JSON.stringify({
        op: 2,
        d: {
            token: config.selfToken,
            intents: 1,
            properties: {
                os: "IOS",
                browser: "firefox",
                device: "firefox",
            },
        },
    }));
}
async function handleGuildUpdate(data) {
    const guild = guilds[data.d.guild_id];
    if ((guild || data.d.vanity_url_code) !== data.d.vanity_url_code) {
        const start = Date.now();
        const client = connect("https://canary.discord.com");

        try {
            const { statusCode, headers, body } = await client.request({
                method: "PATCH",
                path: `/api/v8/guilds/${config.guildId}/vanity-url`,
                headers: {
                    "Authorization": config.sniperToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ code: guild })
            });

            let responseBody = "";
            for await (const data of body) {
                responseBody += data;
            }

            const end = Date.now();
            const elapsed = end - start;
            console.log(`"Code": "${guild}", "Uses": "0", "Elapsed time": "${elapsed}"`);

            if (statusCode === 200) {
                process.exit();
            }
        } catch (error) {
            console.error("HTTP request error:", error);
        } finally {
            client.close();
        }
    }
}
function handleMessage(message) {
    const data = JSON.parse(message);

    switch (data.t) {
        case "GUILD_UPDATE":
            handleGuildUpdate(data);
            break;
        case "READY":
            handleReady(data);
            break;
        default:
            handleOp1(data);
            break;
    }
}
function handleReady(data) {
    data.d.guilds.forEach(guild => {
        if (guild.vanity_url_code) {
            guilds[guild.id] = guild.vanity_url_code;
        }
    });

    console.log(Object.values(guilds));
}
function handleOp1(data) {
    setInterval(() => ws.send(JSON.stringify({ op: 1 })), data.d.heartbeat_interval);
}
function handleWebSocketClose() {
    console.log("ERROR WEBSOCKET CONNECTION CLOSED Reconnecting websocket connection...");
    clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(setupWebSocket, 1000);
}

function handleWebSocketError(event) {
    console.error("WebSocket error:", event);
    process.exit(1); 
}

setupWebSocket();