// Чат с ИИ-помощником: отправляет историю на /api/chat и показывает ответ.
document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('aiChatBody');
    const form = document.getElementById('aiChatForm');
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const clearBtn = document.getElementById('aiClearBtn');
    const statusEl = document.getElementById('aiStatus');
    if (!body || !form || !input) return;

    const STORAGE_KEY = 'lawanAiChatV1';
    const WELCOME = 'Здравствуйте! Я ИИ-помощник Lawan. Могу помочь с позицией по делу, планом действий, черновиком документа или справкой. С чем поработаем?';

    // history: [{ role: 'user' | 'assistant', content, time }]
    let history = [];
    let busy = false;

    try {
        history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(history)) history = [];
    } catch (e) { history = []; }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-60))); } catch (e) {}
    }

    function nowTime() {
        return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollDown() {
        body.scrollTop = body.scrollHeight;
    }

    // Безопасный рендер: экранируем HTML и поддерживаем только **жирный**
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function renderText(str) {
        return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }

    function addBubble(role, text, time, extraClass) {
        const row = document.createElement('div');
        row.className = 'message-row ' + (role === 'user' ? 'outgoing' : 'incoming') + (extraClass ? ' ' + extraClass : '');
        row.innerHTML =
            '<div class="message-bubble">' +
                '<div class="message-text">' + renderText(text) + '</div>' +
                '<div class="message-meta"><span class="message-time">' + (time || nowTime()) + '</span></div>' +
            '</div>';
        body.appendChild(row);
        scrollDown();
        return row;
    }

    function addTyping() {
        const row = document.createElement('div');
        row.className = 'message-row incoming';
        row.innerHTML = '<div class="message-bubble typing-indicator"><span></span><span></span><span></span></div>';
        body.appendChild(row);
        scrollDown();
        return row;
    }

    function renderAll() {
        body.innerHTML = '';
        const date = document.createElement('div');
        date.className = 'chat-date';
        date.textContent = 'Сегодня';
        body.appendChild(date);
        addBubble('assistant', WELCOME, '');
        history.forEach(m => addBubble(m.role, m.content, m.time));
    }

    function setBusy(state) {
        busy = state;
        input.disabled = state;
        sendBtn.disabled = state;
        if (statusEl) statusEl.textContent = state ? 'печатает...' : 'в сети';
        if (!state) input.focus();
    }

    async function send(text) {
        history.push({ role: 'user', content: text, time: nowTime() });
        save();
        addBubble('user', text, history[history.length - 1].time);
        setBusy(true);
        const typing = addTyping();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: history.map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await res.json().catch(() => ({}));
            typing.remove();

            if (!res.ok || !data.reply) {
                throw new Error(data.error || 'Ошибка сервера (' + res.status + ')');
            }
            history.push({ role: 'assistant', content: data.reply, time: nowTime() });
            save();
            addBubble('assistant', data.reply, history[history.length - 1].time);
        } catch (err) {
            typing.remove();
            // Отправленное сообщение остаётся в истории, чтобы можно было повторить попытку
            addBubble('assistant', 'Не получилось получить ответ: ' + err.message, '', 'error');
            // Убираем неотвеченное сообщение из истории, иначе подряд пойдут две реплики пользователя
            history.pop();
            save();
            input.value = text;
        } finally {
            setBusy(false);
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || busy) return;
        input.value = '';
        send(text);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (busy) return;
            history = [];
            save();
            renderAll();
        });
    }

    renderAll();
});
