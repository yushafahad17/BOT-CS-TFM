document.addEventListener('DOMContentLoaded', function() {
    console.log('Chat page loaded');
    currentUsername = localStorage.getItem('username');
    console.log('Current username:', currentUsername);
    
    if (!currentUsername) {
        console.log('No username found, redirecting to login page');
        window.location.href = '/';
        return;
    }

    initializeSocket();

    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');

    if (sendButton && messageInput) {
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        console.log('Event listeners attached');
    } else {
        console.error('Send button or message input not found');
    }
});

// ... kode lainnya ...
