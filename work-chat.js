// Интерактивная демонстрация рабочих чатов: все данные остаются в localStorage.
document.addEventListener('DOMContentLoaded', () => {
    const listEl = document.getElementById('workChatList');
    const messagesEl = document.getElementById('workChatMessages');
    const form = document.getElementById('workChatForm');
    const input = document.getElementById('workChatInput');
    const search = document.getElementById('workChatSearch');
    const nameEl = document.getElementById('workChatName');
    const statusEl = document.getElementById('workChatStatus');
    const avatarEl = document.getElementById('workChatAvatar');
    const fileInput = document.getElementById('workChatFile');
    const attachBtn = document.getElementById('workChatAttach');
    if (!listEl || !messagesEl || !form || !input) return;

    const STORAGE_KEY = 'lawanWorkChatsDemoV1';
    const initialChats = [
        {
            id: 'smirnov', name: 'Смирнов Андрей', initials: 'СА', status: 'в сети', online: true, unread: 0,
            replies: [
                'Да, посмотрю и вернусь с комментариями.',
                'Хорошо, договорились. Если появятся материалы — присылай сюда.',
                'Принял, спасибо! Проверю сегодня.'
            ],
            messages: [
                { from: 'peer', text: 'Андрей, добрый день! Посмотри, пожалуйста, проект искового по делу «Альфы». Кажется, мы упустили сроки по одному эпизоду.', time: '16:20' },
                { from: 'me', text: 'Добрый! Сейчас гляну. Скинь файл в облако, я открою.', time: '16:22' },
                { from: 'peer', file: { name: 'Isk_Alfa_final.docx', size: '2.4 МБ' }, time: '16:23' },
                { from: 'me', text: 'Вижу. Да, по второму эпизоду срок исковой давности истекает 12 числа. Надо срочно подавать ходатайство о восстановлении.', time: '16:25' },
                { from: 'peer', text: 'Согласен. Я подготовлю ходатайство к завтрашнему утру. Спасибо!', time: '16:28' }
            ]
        },
        {
            id: 'ivanova', name: 'Иванова Мария', initials: 'ИМ', status: 'в сети', online: true, unread: 1,
            replies: [
                'Поняла. Подготовлю материалы и пришлю чуть позже.',
                'Да, уже занимаюсь этим. Отпишусь, как будет готово.',
                'Спасибо, учту это в документе.'
            ],
            messages: [
                { from: 'peer', text: 'Доброе утро! По делу Петрова собрала документы. Посмотри, пожалуйста, список доказательств.', time: '09:14' },
                { from: 'me', text: 'Конечно. Пришли сюда, пожалуйста.', time: '09:18' },
                { from: 'peer', text: 'Отправлю после встречи, примерно через 20 минут.', time: '09:19' }
            ]
        },
        {
            id: 'team', name: 'Команда Lawan', initials: 'КЛ', status: '3 участника', online: false, unread: 0,
            replies: [
                'Коллеги, поддерживаю. Давайте зафиксируем это в плане.',
                'Спасибо! Посмотрю и добавлю свои комментарии.',
                'Хорошая идея. Предлагаю обсудить это на коротком созвоне.'
            ],
            messages: [
                { from: 'peer', author: 'Ольга', text: 'Коллеги, напоминаю: сегодня в 15:00 обсуждаем план по новым делам.', time: '10:02' },
                { from: 'me', text: 'Буду. Подготовлю список вопросов.', time: '10:06' },
                { from: 'peer', author: 'Дмитрий', text: 'Я тоже подключусь, спасибо за напоминание.', time: '10:11' }
            ]
        }
    ];
    let chats;
    let activeId = 'smirnov';
    const replying = new Set();

    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        chats = Array.isArray(saved) && saved.length ? saved : initialChats;
        // Добавляем новые демонстрационные диалоги, если набор расширился после сохранения.
        initialChats.forEach(seed => {
            if (!chats.some(chat => chat.id === seed.id)) chats.push(seed);
        });
    } catch (e) { chats = initialChats; }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch (e) {}
    }
    function currentChat() { return chats.find(chat => chat.id === activeId) || chats[0]; }
    function timeNow() { return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
    function formatSize(bytes) {
        return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
    }
    function lastMessage(chat) {
        const last = chat.messages[chat.messages.length - 1];
        return last ? (last.file ? `📎 ${last.file.name}` : last.text) : 'Нет сообщений';
    }

    function renderList() {
        const query = (search ? search.value : '').trim().toLocaleLowerCase('ru');
        listEl.innerHTML = '';
        chats.filter(chat => chat.name.toLocaleLowerCase('ru').includes(query)).forEach(chat => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `demo-chat-item${chat.id === activeId ? ' active' : ''}`;
            button.setAttribute('aria-current', chat.id === activeId ? 'true' : 'false');
            const avatar = document.createElement('span');
            avatar.className = 'demo-list-avatar';
            avatar.textContent = chat.initials;
            const copy = document.createElement('span');
            copy.className = 'demo-chat-copy';
            const title = document.createElement('span');
            title.className = 'demo-chat-title';
            title.textContent = chat.name;
            const preview = document.createElement('span');
            preview.className = 'demo-chat-preview';
            preview.textContent = lastMessage(chat);
            copy.append(title, preview);
            button.append(avatar, copy);
            if (chat.unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'demo-unread';
                badge.textContent = String(chat.unread);
                button.appendChild(badge);
            }
            button.addEventListener('click', () => {
                activeId = chat.id;
                chat.unread = 0;
                persist();
                render();
            });
            listEl.appendChild(button);
        });
        if (!listEl.children.length) {
            const empty = document.createElement('p');
            empty.className = 'demo-list-empty';
            empty.textContent = 'Коллеги не найдены';
            listEl.appendChild(empty);
        }
    }

    function addFileCard(row, file) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble file-bubble';
        const info = document.createElement('div');
        info.className = 'file-info';
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = '↗';
        const details = document.createElement('div');
        details.className = 'file-details';
        const filename = document.createElement('span');
        filename.className = 'file-name';
        filename.textContent = file.name;
        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = file.size;
        details.append(filename, size);
        info.append(icon, details);
        bubble.appendChild(info);
        row.appendChild(bubble);
    }

    function renderMessages() {
        const chat = currentChat();
        messagesEl.innerHTML = '';
        const date = document.createElement('div');
        date.className = 'chat-date';
        date.textContent = 'Сегодня';
        messagesEl.appendChild(date);
        chat.messages.forEach(message => {
            const row = document.createElement('div');
            row.className = `message-row ${message.from === 'me' ? 'outgoing' : 'incoming'}`;
            if (message.file) {
                addFileCard(row, message.file);
            } else {
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble';
                if (message.author) {
                    const author = document.createElement('div');
                    author.className = 'demo-message-author';
                    author.textContent = message.author;
                    bubble.appendChild(author);
                }
                const text = document.createElement('div');
                text.className = 'message-text';
                text.textContent = message.text;
                bubble.appendChild(text);
                row.appendChild(bubble);
            }
            const bubble = row.querySelector('.message-bubble');
            const meta = document.createElement('div');
            meta.className = 'message-meta';
            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = message.time || timeNow();
            meta.appendChild(time);
            if (message.from === 'me') {
                const status = document.createElement('span');
                status.className = 'message-status demo-message-status';
                status.textContent = '✓✓';
                meta.appendChild(status);
            }
            bubble.appendChild(meta);
            messagesEl.appendChild(row);
        });
        if (replying.has(chat.id)) {
            const row = document.createElement('div');
            row.className = 'message-row incoming';
            const typing = document.createElement('div');
            typing.className = 'message-bubble typing-indicator';
            typing.innerHTML = '<span></span><span></span><span></span>';
            row.appendChild(typing);
            messagesEl.appendChild(row);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function render() {
        const chat = currentChat();
        if (!chat) return;
        nameEl.textContent = chat.name;
        statusEl.textContent = chat.status;
        statusEl.classList.toggle('offline', !chat.online);
        avatarEl.textContent = chat.initials;
        renderList();
        renderMessages();
    }

    function simulateReply(chatId) {
        const chat = chats.find(item => item.id === chatId);
        if (!chat) return;
        replying.add(chatId);
        if (chatId === activeId) renderMessages();
        const delay = 1200 + Math.floor(Math.random() * 1000);
        window.setTimeout(() => {
            replying.delete(chatId);
            const reply = chat.replies[Math.floor(Math.random() * chat.replies.length)];
            chat.messages.push({ from: 'peer', text: reply, time: timeNow() });
            if (chat.messages.length > 100) chat.messages = chat.messages.slice(-100);
            if (chatId !== activeId) chat.unread = (chat.unread || 0) + 1;
            persist();
            renderList();
            if (chatId === activeId) renderMessages();
        }, delay);
    }

    function sendMessage(text, file) {
        const chat = currentChat();
        if (!chat || (!text.trim() && !file)) return;
        if (text.trim()) chat.messages.push({ from: 'me', text: text.trim(), time: timeNow() });
        if (file) chat.messages.push({ from: 'me', file, time: timeNow() });
        if (chat.messages.length > 100) chat.messages = chat.messages.slice(-100);
        persist();
        render();
        if (!replying.has(chat.id)) simulateReply(chat.id);
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        const text = input.value;
        if (!text.trim()) return;
        input.value = '';
        sendMessage(text);
    });
    if (search) search.addEventListener('input', renderList);
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) sendMessage('', { name: file.name, size: formatSize(file.size) });
            fileInput.value = '';
        });
    }

    render();
});
