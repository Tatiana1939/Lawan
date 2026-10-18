// Сервер Lawan: отдаёт сайт и проксирует запросы чата к ИИ.
// Ключи API хранятся только здесь (в .env), в браузер они не попадают.
// Поддерживаются провайдеры: gigachat (бесплатный Freemium) и anthropic (платный).
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const tls = require('tls');
const crypto = require('crypto');
const express = require('express');

// Мини-загрузчик .env (без внешних пакетов)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
}

const env = process.env;
const PORT = env.PORT || 3000;
const PROVIDER = (env.PROVIDER || (env.GIGACHAT_CREDENTIALS ? 'gigachat' : 'anthropic')).toLowerCase();
const MAX_HISTORY = 30;      // сколько последних сообщений отправляем модели
const MAX_MESSAGE_LEN = 4000;

const SYSTEM_PROMPT = `Ты — ИИ-помощник в CRM-системе Lawan для адвокатов и юристов в России.
Отвечай по-русски, коротко и по делу, как опытный коллега-юрист.
Помогаешь с: анализом правовой ситуации, структурой позиции по делу, планом действий и задач,
черновиками процессуальных документов (иски, ходатайства, претензии, отзывы), процессуальными сроками,
краткими справками по делу.
Правила:
- Ссылайся на нормы права (кодекс, статья), только если уверен в них. Не выдумывай номера дел, реквизиты судебных актов и цитаты. Если не уверен — прямо скажи об этом и посоветуй проверить в СПС (КонсультантПлюс, Гарант).
- Процессуальные сроки всегда предлагай перепроверить по актуальной редакции закона.
- Если не хватает фактов — задай один уточняющий вопрос.
- Ты помощник, а не замена адвокату: итоговое решение принимает юрист.
Форматирование: простой текст, короткие абзацы, при необходимости нумерованные списки. Не используй markdown-заголовки и таблицы.`;

// ---------- Общий HTTP-помощник (для GigaChat: нужен сертификат Минцифры) ----------
let cachedCa = null;
function getCa() {
    if (cachedCa) return cachedCa;
    const certPath = path.join(__dirname, 'certs', 'russian_trusted_root_ca.pem');
    cachedCa = [...tls.rootCertificates];
    if (fs.existsSync(certPath)) {
        const pem = fs.readFileSync(certPath, 'utf8');
        if (pem.includes('BEGIN CERTIFICATE')) cachedCa.push(pem);
        else console.warn('Файл certs/russian_trusted_root_ca.pem не похож на сертификат в формате PEM.');
    }
    return cachedCa;
}

function httpRequest(urlStr, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const isHttps = url.protocol === 'https:';
        const options = { method, headers, hostname: url.hostname, port: url.port || (isHttps ? 443 : 80), path: url.pathname + url.search };
        if (isHttps) {
            options.ca = getCa();
            if (env.GIGACHAT_INSECURE === 'true') options.rejectUnauthorized = false;
        }
        const req = (isHttps ? https : http).request(options, res => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                let json = {};
                try { json = JSON.parse(data); } catch (e) {}
                resolve({ status: res.statusCode, json, raw: data });
            });
        });
        req.setTimeout(60000, () => req.destroy(new Error('Превышено время ожидания ответа.')));
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ---------- Провайдер: GigaChat ----------
const GIGA = {
    credentials: env.GIGACHAT_CREDENTIALS,
    scope: env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS',
    model: env.GIGACHAT_MODEL || 'GigaChat-2',
    authUrl: env.GIGACHAT_AUTH_URL || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    apiUrl: (env.GIGACHAT_API_URL || 'https://api.giga.chat/v1').replace(/\/$/, '')
};
let gigaToken = { value: null, expiresAt: 0 };

async function getGigaToken() {
    if (gigaToken.value && Date.now() < gigaToken.expiresAt - 60000) return gigaToken.value;
    const r = await httpRequest(GIGA.authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': crypto.randomUUID(),
            'Authorization': 'Basic ' + GIGA.credentials
        },
        body: 'scope=' + encodeURIComponent(GIGA.scope)
    });
    if (r.status !== 200 || !r.json.access_token) {
        console.error('GigaChat: ошибка авторизации', r.status, r.raw);
        throw new Error('GigaChat не принял ключ авторизации (код ' + r.status + '). Проверьте GIGACHAT_CREDENTIALS в .env.');
    }
    gigaToken = { value: r.json.access_token, expiresAt: r.json.expires_at || Date.now() + 25 * 60000 };
    return gigaToken.value;
}

async function askGigaChat(messages) {
    if (!GIGA.credentials) throw new Error('В .env не задан GIGACHAT_CREDENTIALS (ключ авторизации GigaChat).');
    try {
        let token = await getGigaToken();
        const call = () => httpRequest(GIGA.apiUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                model: GIGA.model,
                messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
                max_tokens: 1500,
                temperature: 0.4
            })
        });
        let r = await call();
        if (r.status === 401) {            // токен протух — получаем новый и повторяем
            gigaToken = { value: null, expiresAt: 0 };
            token = await getGigaToken();
            r = await call();
        }
        if (r.status !== 200) {
            console.error('GigaChat: ошибка API', r.status, r.raw);
            if (r.status === 402 || r.status === 429) throw new Error('Закончились токены или превышен лимит запросов GigaChat.');
            throw new Error((r.json && (r.json.message || r.json.error)) || 'Ошибка GigaChat (код ' + r.status + ').');
        }
        const choice = r.json.choices && r.json.choices[0];
        return (choice && choice.message && choice.message.content || '').trim();
    } catch (err) {
        const certErrors = ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_UNTRUSTED'];
        if (err && certErrors.includes(err.code)) {
            throw new Error('Сертификат Минцифры не установлен. Скачайте его в папку certs/ (см. инструкцию) и перезапустите сервер.');
        }
        throw err;
    }
}

// ---------- Провайдер: Anthropic ----------
async function askAnthropic(messages) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('В .env не задан ANTHROPIC_API_KEY.');
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
            max_tokens: 1500,
            system: SYSTEM_PROMPT,
            messages
        })
    });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
        console.error('Ошибка API Anthropic:', apiRes.status, JSON.stringify(data));
        throw new Error((data && data.error && data.error.message) || 'Ошибка API (' + apiRes.status + ')');
    }
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

const PROVIDERS = { gigachat: askGigaChat, anthropic: askAnthropic };

// ---------- Сервер ----------
const app = express();
app.use(express.json({ limit: '100kb' }));

app.post('/api/chat', async (req, res) => {
    const ask = PROVIDERS[PROVIDER];
    if (!ask) return res.status(500).json({ error: 'Неизвестный PROVIDER в .env: ' + PROVIDER });

    const raw = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
    let messages = raw
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LEN) }))
        .slice(-MAX_HISTORY);

    // Диалог должен начинаться с реплики пользователя и ею же заканчиваться
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'Пустой или некорректный запрос.' });
    }

    try {
        const reply = await ask(messages);
        res.json({ reply: reply || 'Не удалось сформировать ответ, попробуйте переформулировать вопрос.' });
    } catch (err) {
        console.error('Сбой запроса к ИИ:', err);
        res.status(502).json({ error: err.message || 'Не удалось связаться с сервисом ИИ.' });
    }
});

// Статика сайта (только публичные файлы)
const BLOCKED = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env', '/.env.example']);
app.use((req, res, next) => {
    if (BLOCKED.has(req.path) || req.path.startsWith('/node_modules') || req.path.startsWith('/.git') || req.path.startsWith('/certs')) {
        return res.status(404).end();
    }
    next();
});
app.use(express.static(__dirname, { dotfiles: 'ignore' }));

app.listen(PORT, () => {
    console.log(`Lawan запущен: http://localhost:${PORT}  (ИИ: ${PROVIDER})`);
    if (PROVIDER === 'gigachat' && !GIGA.credentials) console.warn('ВНИМАНИЕ: GIGACHAT_CREDENTIALS не задан — чат работать не будет.');
    if (PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) console.warn('ВНИМАНИЕ: ANTHROPIC_API_KEY не задан — чат работать не будет.');
});
