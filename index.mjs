import WebSocket from 'ws';
import fetch from 'node-fetch';
import config from './config.js';

let socket, reconnectInterval, guilds = {}, heartbeatInterval;

const connectToWebSocket = () => {
    socket = new WebSocket('wss://gateway.discord.gg/us-east');

    socket.on('open', () => {
        console.log('Connected to Discord WebSocket Gateway.');
        handleWebSocketOpen();
    });

    socket.on('message', handleMessage);

    socket.on('close', () => {
        console.log('WebSocket connection closed. Reconnecting...');
        clearInterval(heartbeatInterval);
        clearTimeout(reconnectInterval);
        reconnectInterval = setTimeout(connectToWebSocket, 100);
    });

    socket.on('error', handleWebSocketError);
};

const handleWebSocketOpen = () => {
    socket.send(JSON.stringify({
        op: 2,
        d: {
            token: config.selfToken,
            intents: 1,
            properties: {
                os: 'IOS',
                browser: 'firefox',
                device: 'firefox'
            }
        }
    }));

    heartbeatInterval = setInterval(() => {
        socket.send(JSON.stringify({
            op: 1
        }));
    }, 5000);
};

const handleMessage = (message) => {
    const data = JSON.parse(message);
    switch (data.t) {
        case 'GUILD_UPDATE':
            handleGuildUpdate(data);
            break;
        case 'READY':
            handleReady(data);
            break;
        default:
            handleOp1(data);
            break;
    }
};

const handleGuildUpdate = async (data) => {
    const guild = guilds[data.d.guild_id];
    if (!guild || guild !== data.d.vanity_url_code) {
        const start = Date.now();
        try {
            const res = await sendPatchRequest(data);
            const end = Date.now();
            const elapsed = end - start;
            console.log(`"Code": "${guild}", "Uses": "0", "Elapsed time": "${elapsed}"`);
            if (res.status === 200) process.exit();
        } catch (error) {
            console.error(error);
        }
    }
};

const handleReady = (data) => {
    data.d.guilds.forEach(guild => {
        if (guild.vanity_url_code) guilds[guild.id] = guild.vanity_url_code;
    });
    console.log(Object.values(guilds));
};

const handleOp1 = (data) => {};

const handleWebSocketError = (error) => {
    console.error('WebSocket encountered an error:', error);
    return process.exit();
};

const sendPatchRequest = async (data) => {
    const guild = guilds[data.d.guild_id];
    const body = JSON.stringify({ code: guild });

    const options = {
        method: 'PATCH',
        headers: {
            'Authorization': config.sniperToken,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        },
        body: body
    };

    const response = await fetch(`https://canary.discord.com/api/v8/guilds/${config.guildId}/vanity-url`, options);
    return response;
};

connectToWebSocket();
