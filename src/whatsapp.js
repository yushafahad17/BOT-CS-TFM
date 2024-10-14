const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs').promises;
const { Boom } = require('@hapi/boom');
const messageHandler = require('./messageHandler');
const sharp = require('sharp');

const ownerNumber = '6285798045817@s.whatsapp.net';
const groupId = '120363298036479484@g.us';
let sock;

// Simpan daftar akses dalam file
const accessListFile = path.join(__dirname, 'accessList.json');

// Fungsi untuk membaca daftar akses
async function readAccessList() {
    try {
        const data = await fs.readFile(accessListFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading access list:', error);
        return {};
    }
}

// Fungsi untuk menulis daftar akses
async function writeAccessList(accessList) {
    try {
        await fs.writeFile(accessListFile, JSON.stringify(accessList, null, 2));
    } catch (error) {
        console.error('Error writing access list:', error);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, '../auth_info_baileys'));

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened successfully');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            console.log('Received message:', msg);
            await handleIncomingMessage(msg);
        }
    });
}

async function handleIncomingMessage(msg) {
    if (msg.key.remoteJid === 'status@broadcast') return;

    const senderJid = msg.key.fromMe ? undefined : msg.key.participant || msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const isGroup = msg.key.remoteJid.endsWith('@g.us');

    if (messageType === 'imageMessage') {
        await handleImageMessage(msg, senderJid);
    } else if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        if (messageContent.startsWith('/')) {
            await handleCommand(messageContent, senderJid, isGroup, msg.key.remoteJid);
        } else {
            if (await hasAccess(senderJid)) {
                await sendMessageToGroup(senderJid, { text: messageContent });
            } else {
                await sock.sendMessage(senderJid, { text: 'Maaf, Anda tidak memiliki akses untuk menggunakan bot ini. Gunakan /perintah-bot untuk melihat perintah yang tersedia untuk umum.' });
            }
        }
    }
}

async function handleImageMessage(msg, senderJid) {
    const imageMessage = msg.message.imageMessage;
    const caption = imageMessage.caption || '';

    if (await hasAccess(senderJid)) {
        try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { 
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            });
            const processedImage = await processImage(buffer);
            const imagePath = path.join(__dirname, '..', 'processed_images', `${Date.now()}.jpg`);
            await fs.writeFile(imagePath, processedImage);

            await sendMessageToGroup(senderJid, { 
                image: { url: imagePath }, 
                caption: `*Customer Report (Image)*\n\n*From:* ${senderJid}\n*Caption:* ${caption}`
            });

            await sock.sendMessage(senderJid, { text: 'Gambar Anda telah diterima dan diteruskan ke customer service.' });
        } catch (error) {
            console.error('Error processing image:', error);
            await sock.sendMessage(senderJid, { text: 'Maaf, terjadi kesalahan saat memproses gambar Anda.' });
        }
    } else {
        await sock.sendMessage(senderJid, { text: 'Maaf, Anda tidak memiliki akses untuk mengirim gambar ke bot ini.' });
    }
}

async function processImage(buffer) {
    return await sharp(buffer)
        .resize(800, 600, { fit: 'inside' }) // Resize image to max 800x600
        .jpeg({ quality: 80 }) // Convert to JPEG and set quality
        .toBuffer();
}

async function handleCommand(command, senderJid, isGroup, chatJid) {
    const [cmd, ...args] = command.slice(1).split(' ');

    // Perintah yang dapat diakses oleh semua orang
    const publicCommands = ['perintah-bot', 'owner-bot'];

    if (!await hasAccess(senderJid) && !publicCommands.includes(cmd.toLowerCase())) {
        await sock.sendMessage(chatJid, { text: 'Anda tidak memiliki akses untuk menggunakan perintah ini.' });
        return;
    }

    // Tidak perlu memeriksa apakah perintah dari grup yang diizinkan
    // karena kita ingin bot berfungsi di mana saja untuk pengguna yang memiliki akses

    switch (cmd.toLowerCase()) {
        case 'balas-chat':
            await handleReplyChat(args.join(' '), chatJid);
            break;
        case 'tolak-chat':
            await handleRejectChat(args[0], chatJid);
            break;
        case 'tambah-akses':
            if (senderJid === ownerNumber) {
                await handleAddAccess(args.join(' '), chatJid);
            } else {
                await sock.sendMessage(chatJid, { text: 'Eitsss fitur ini cuma AETHER doang yang bisa menambahkan akses.' });
            }
            break;
        case 'list-akses':
            if (senderJid === ownerNumber) {
                await handleListAccess(chatJid);
            } else {
                await sock.sendMessage(chatJid, { text: 'Eitsss fitur ini cuma AETHER doang yang bisa melihat daftar akses.' });
            }
            break;
        case 'hapus-akses':
            if (senderJid === ownerNumber) {
                await handleRemoveAccess(args[0], chatJid);
            } else {
                await sock.sendMessage(chatJid, { text: 'Eitsss fitur ini cuma AETHER doang yang bisa menghapus akses.' });
            }
            break;
        case 'perintah-bot':
            await handleCommandList(chatJid);
            break;
        case 'owner-bot':
            await handleOwnerInfo(chatJid);
            break;
        default:
            await sock.sendMessage(chatJid, { text: 'Perintah tidak dikenal.' });
    }
}

async function handleReplyChat(message, chatJid) {
    const [username, ...replyParts] = message.split(' ');
    const replyMessage = replyParts.join(' ').trim();

    if (!username || !replyMessage) {
        await sock.sendMessage(chatJid, { text: 'Format salah. Gunakan: /balas-chat username pesan' });
        return;
    }

    console.log(`Attempting to reply to ${username}, with message: ${replyMessage}`);
    
    messageHandler.sendMessageToUser(username, replyMessage);
    
    await sock.sendMessage(chatJid, { text: `Balasan untuk ${username} telah dikirim` });
}

async function handleRejectChat(username, chatJid) {
    if (!username) {
        await sock.sendMessage(chatJid, { text: 'Format salah. Gunakan: /tolak-chat username' });
        return;
    }

    messageHandler.sendMessageToUser(username, "Maaf, chat Anda ditolak oleh customer service.");
    await sock.sendMessage(chatJid, { text: `Chat dari ${username} telah ditolak` });
}

async function handleAddAccess(input, chatJid) {
    const [number, ...nameParts] = input.split(' ');
    const name = nameParts.join(' ');

    if (!number || !name) {
        await sock.sendMessage(chatJid, { text: 'Format salah. Gunakan: /tambah-akses 62xxx Nama User' });
        return;
    }

    const formattedNumber = `${number}@s.whatsapp.net`;
    const accessList = await readAccessList();
    accessList[formattedNumber] = name;
    await writeAccessList(accessList);

    await sock.sendMessage(chatJid, { text: `Akses diberikan kepada ${name} (${formattedNumber})` });
}

async function handleListAccess(chatJid) {
    const accessList = await readAccessList();
    let message = 'Daftar pengguna yang memiliki akses:\n\n';
    for (const [number, name] of Object.entries(accessList)) {
        message += `${name}: ${number}\n`;
    }
    await sock.sendMessage(chatJid, { text: message });
}

async function handleRemoveAccess(number, chatJid) {
    if (!number) {
        await sock.sendMessage(chatJid, { text: 'Format salah. Gunakan: /hapus-akses 62xxx' });
        return;
    }

    const formattedNumber = `${number}@s.whatsapp.net`;
    const accessList = await readAccessList();
    if (accessList[formattedNumber]) {
        const name = accessList[formattedNumber];
        delete accessList[formattedNumber];
        await writeAccessList(accessList);
        await sock.sendMessage(chatJid, { text: `Akses untuk ${name} (${formattedNumber}) telah dihapus` });
    } else {
        await sock.sendMessage(chatJid, { text: `Nomor ${formattedNumber} tidak ditemukan dalam daftar akses` });
    }
}

async function sendMessageToGroup(senderJid, message) {
    try {
        console.log(`Attempting to send message to group: ${groupId}`);
        console.log('Message content:', message);

        // Periksa apakah grup ada dan bot memiliki akses
        const groupInfo = await sock.groupMetadata(groupId);
        if (!groupInfo) {
            throw new Error('Group not found or bot does not have access');
        }

        if (message.image) {
            const imageBuffer = await sharp(message.image.url)
                .resize(800, 600, { fit: 'inside' })
                .toBuffer();

            await sock.sendMessage(groupId, {
                image: imageBuffer,
                caption: message.text
            });
        } else {
            console.log('Sending text message to WhatsApp group');
            const sentMessage = await sock.sendMessage(groupId, {
                text: `*Customer Report*\n\n*From:* ${senderJid}\n*Message:* ${message.text}`
            });
            console.log('Sent message ID:', sentMessage.key.id);
            console.log('Text message sent successfully');
        }

        console.log(`Message from ${senderJid} successfully sent to group`);
    } catch (error) {
        console.error('Failed to send message to group:', error);
        throw error;
    }
}

async function hasAccess(jid) {
    if (jid === ownerNumber) return true;
    const accessList = await readAccessList();
    return !!accessList[jid];
}

async function handleCommandList(chatJid) {
    const commandList = `
*Daftar Perintah Bot:*

Perintah untuk semua pengguna:
1. */perintah-bot* - Menampilkan daftar perintah bot
2. */owner-bot* - Menampilkan informasi owner bot

Perintah untuk pengguna dengan akses:
3. */balas-chat [username] [pesan]* - Membalas chat dari pengguna
4. */tolak-chat [username]* - Menolak chat dari pengguna

Perintah Khusus Owner:
5. */tambah-akses [nomor] [nama]* - Menambahkan akses untuk nomor baru
6. */list-akses* - Menampilkan daftar pengguna yang memiliki akses
7. */hapus-akses [nomor]* - Menghapus akses dari nomor tertentu

Gunakan perintah dengan bijak dan sesuai kebutuhan.
    `;

    await sock.sendMessage(chatJid, { text: commandList });
}

async function handleOwnerInfo(chatJid) {
    const ownerInfo = `
*Informasi Owner Bot*

*Nama:* AETHER
*Nomor:* +62 857-9804-5817
*Deskripsi:* Owner dan pengembang bot WhatsApp Customer Service ini.

Untuk keperluan bisnis atau pertanyaan, silakan hubungi nomor di atas.
    `;

    await sock.sendMessage(chatJid, { text: ownerInfo });
}

async function getGroups() {
    const groups = await sock.groupFetchAllParticipating();
    return Object.entries(groups).map(([id, group]) => ({
        id,
        name: group.subject,
        participants: group.participants.length
    }));
}

module.exports = {
    connectToWhatsApp,
    sendMessageToGroup,
    getGroups
};