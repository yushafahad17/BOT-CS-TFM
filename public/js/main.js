const socket = io();
let currentUsername = '';
let selectedFile = null;
let emojiPicker;

// Fungsi untuk menyimpan riwayat chat ke localStorage
function saveChatHistory(message) {
    let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
    chatHistory.push(message);
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// Fungsi untuk memuat riwayat chat dari localStorage
function loadChatHistory() {
    return JSON.parse(localStorage.getItem('chatHistory')) || [];
}

function login() {
    const username = document.getElementById('username').value;
    if (username.trim() !== '') {
        currentUsername = username;
        localStorage.setItem('username', username);
        if (socket.disconnected) {
            socket.connect();
        }
        socket.emit('join', username);
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        displayMessage('System', `Selamat datang, ${username}! Anda sekarang terhubung ke customer service Therz File Manager.`);
        
        // Memuat dan menampilkan riwayat chat
        const chatHistory = loadChatHistory();
        chatHistory.forEach(msg => displayMessage(msg.sender, msg.message, msg.sent, msg.image));
    } else {
        alert('Silakan masukkan username/nama anda.');
    }
}

function sendMessage() {
    const messageTextarea = document.getElementById('message');
    const message = messageTextarea.value.trim();
    if (message !== '' || selectedFile) {
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const messageData = { 
                    username: currentUsername, 
                    message: message,
                    image: event.target.result
                };
                socket.emit('chat message', messageData);
                displayMessage('You', message, true, event.target.result);
                saveChatHistory({ sender: 'You', message, sent: true, image: event.target.result });
                messageTextarea.value = ''; // Bersihkan textarea setelah mengirim
                clearImagePreview();
            };
            reader.readAsDataURL(selectedFile);
        } else {
            const messageData = { username: currentUsername, message: message };
            socket.emit('chat message', messageData);
            displayMessage('You', message, true);
            saveChatHistory({ sender: 'You', message, sent: true });
            messageTextarea.value = ''; // Bersihkan textarea setelah mengirim
        }
    }
}

function displayMessage(sender, message, sent = false, imageUrl = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sent ? 'sent' : 'received');
    
    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.classList.add('preview-image');
        messageElement.appendChild(img);
    }
    
    const textElement = document.createElement('p');
    textElement.textContent = `${sender}: ${message}`;
    messageElement.appendChild(textElement);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    if (confirm('Apakah Anda yakin ingin menghapus riwayat obrolan?')) {
        socket.emit('clear chat', currentUsername);
        document.getElementById('chat-messages').innerHTML = '';
        localStorage.removeItem('chatHistory');
        displayMessage('System', 'Riwayat obrolan telah dihapus.');
    }
}

function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    const preview = document.getElementById('image-preview');
    if (selectedFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" class="preview-image">`;
        };
        reader.readAsDataURL(selectedFile);
    } else {
        clearImagePreview();
    }
}

function clearImagePreview() {
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('file-input').value = '';
    selectedFile = null;
}

socket.on('chat history', (history) => {
    history.forEach(msg => {
        displayMessage(msg.sender, msg.message, msg.sender === currentUsername, msg.image);
        saveChatHistory(msg);
    });
});

socket.on('new message', (data) => {
    displayMessage(data.sender, data.message, false, data.image);
    saveChatHistory({ sender: data.sender, message: data.message, sent: false, image: data.image });
});

socket.on('message sent', (response) => {
    if (response.success) {
        console.log('Pesan berhasil terkirim');
    } else {
        console.error('Gagal mengirim pesan:', response.error);
        displayMessage('System', 'Gagal mengirim pesan. Silakan coba lagi.', false);
    }
});

socket.on('chat cleared', () => {
    console.log('Chat history cleared');
});

function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('username');
        socket.disconnect();
        document.getElementById('chat-container').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('username').value = '';
        document.getElementById('chat-messages').innerHTML = '';
        currentUsername = '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    currentUsername = localStorage.getItem('username');
    if (currentUsername) {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        socket.connect();
        socket.emit('join', currentUsername);
        displayMessage('System', `Selamat datang kembali, ${currentUsername}! Anda sekarang terhubung ke customer service Therz File Manager.`);
        
        // Memuat dan menampilkan riwayat chat
        const chatHistory = loadChatHistory();
        chatHistory.forEach(msg => displayMessage(msg.sender, msg.message, msg.sent, msg.image));
    }

    // Add event listener for Enter key in message input
    document.getElementById('message').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add event listener for Enter key in username input
    document.getElementById('username').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });

    // Add event listener for file input
    document.getElementById('file-input').addEventListener('change', handleFileSelect);

    const toggleButton = document.getElementById('toggle-options');
    const optionsContainer = document.getElementById('options-container');
    const emojiButton = document.getElementById('emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const messageInput = document.getElementById('message');
    const fileInput = document.getElementById('file-input');

    toggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        optionsContainer.style.display = optionsContainer.style.display === 'none' ? 'block' : 'none';
        toggleButton.textContent = optionsContainer.style.display === 'none' ? '🔼' : '🔽';
    });

    emojiButton.addEventListener('click', (event) => {
        event.stopPropagation();
        emojiPickerContainer.style.display = emojiPickerContainer.style.display === 'none' ? 'block' : 'none';
    });

    document.querySelector('label[for="file-input"]').addEventListener('click', () => {
        fileInput.click();
    });

    emojiPicker = document.querySelector('emoji-picker');
    emojiPicker.addEventListener('emoji-click', event => {
        const emoji = event.detail.unicode;
        messageInput.value += emoji;
        emojiPickerContainer.style.display = 'none';
    });

    document.addEventListener('click', (event) => {
        if (!toggleButton.contains(event.target) && !optionsContainer.contains(event.target)) {
            optionsContainer.style.display = 'none';
        }
        if (!emojiButton.contains(event.target) && !emojiPickerContainer.contains(event.target)) {
            emojiPickerContainer.style.display = 'none';
        }
    });

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px'; // 150px adalah max-height
    });

    const messageTextarea = document.getElementById('message');

    messageTextarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Mencegah default action (mengirim form)
            const cursorPosition = this.selectionStart;
            const textBeforeCursor = this.value.substring(0, cursorPosition);
            const textAfterCursor = this.value.substring(cursorPosition);
            this.value = textBeforeCursor + '\n' + textAfterCursor;
            this.selectionStart = this.selectionEnd = cursorPosition + 1;
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        } else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
