// Чат с ИИ-помощником: отправляет историю на /api/chat и показывает ответ.
document.addEventListener('DOMContentLoaded', () => {
    const instances = [...document.querySelectorAll('[data-ai-chat-instance]')];
    if (!instances.length) return;

    const STORAGE_KEY = 'lawanAiChatV1';
    const WELCOME = 'Здравствуйте! Я ИИ-помощник Lawan. Могу помочь с позицией по делу, планом действий, черновиком документа или справкой. С чем поработаем?';

    function readHistory() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch (e) { return []; }
    }

    function nowTime() {
        return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(value) {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    instances.forEach(root => {
        const body = root.querySelector('[data-ai-body]');
        const form = root.querySelector('[data-ai-form]');
        const input = root.querySelector('[data-ai-input]');
        const sendBtn = root.querySelector('[data-ai-send]');
        const clearBtn = root.querySelector('[data-ai-clear]');
        const statusEl = root.querySelector('[data-ai-status]') || document.getElementById('aiStatus');
        if (!body || !form || !input || !sendBtn) return;

        let history = readHistory();
        let busy = false;

        function save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-60)));
                window.dispatchEvent(new CustomEvent('lawan:ai-history-updated', { detail: { source: root } }));
            } catch (e) {}
        }

        function scrollDown() { body.scrollTop = body.scrollHeight; }

        function addBubble(role, text, time, extraClass) {
            const row = document.createElement('div');
            row.className = 'message-row ' + (role === 'user' ? 'outgoing' : 'incoming') + (extraClass ? ' ' + extraClass : '');
            row.innerHTML = '<div class="message-bubble"><div class="message-text">' +
                escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') +
                '</div><div class="message-meta"><span class="message-time">' + (time || nowTime()) + '</span></div></div>';
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
            history.forEach(message => addBubble(message.role, message.content, message.time));
        }

        function setBusy(state) {
            busy = state;
            input.disabled = state;
            sendBtn.disabled = state;
            if (statusEl) statusEl.textContent = state ? 'печатает...' : 'в сети';
            if (!state && !root.closest('[hidden]')) input.focus();
        }

        async function send(text) {
            history.push({ role: 'user', content: text, time: nowTime() });
            save();
            addBubble('user', text, history[history.length - 1].time);
            setBusy(true);
            const typing = addTyping();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: history.map(message => ({ role: message.role, content: message.content })) })
                });
                const data = await response.json().catch(() => ({}));
                typing.remove();
                if (!response.ok || !data.reply) throw new Error(data.error || 'Ошибка сервера (' + response.status + ')');

                history.push({ role: 'assistant', content: data.reply, time: nowTime() });
                save();
                addBubble('assistant', data.reply, history[history.length - 1].time);
            } catch (error) {
                typing.remove();
                addBubble('assistant', 'Не получилось получить ответ: ' + error.message, '', 'error');
                history.pop();
                save();
                input.value = text;
            } finally { setBusy(false); }
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            const text = input.value.trim();
            if (!text || busy) return;
            input.value = '';
            send(text);
        });

        if (clearBtn) clearBtn.addEventListener('click', () => {
            if (busy) return;
            history = [];
            save();
            renderAll();
        });

        window.addEventListener('lawan:ai-history-updated', event => {
            if (event.detail && event.detail.source === root) return;
            history = readHistory();
            renderAll();
        });

        renderAll();
    });

    const launcher = document.getElementById('aiWidgetLauncher');
    const panel = document.getElementById('aiWidgetPanel');
    const close = document.getElementById('aiWidgetClose');
    if (!launcher || !panel || !close) return;

    function setOpen(open) {
        panel.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
        if (open) panel.querySelector('[data-ai-input]').focus();
        else launcher.focus();
    }

    launcher.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });
});
