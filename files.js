document.addEventListener('DOMContentLoaded', () => {

    /* ============================================
       ХРАНИЛИЩЕ ДЕЛ
       Формат: { cases: [ {id, name, createdAt, files: [ {id, name, size, type, data} ]} ] }
       data — base64 строка содержимого файла
    ============================================ */
    const CASES_KEY = 'plannerCasesV1';
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 МБ

    function loadCases() {
        try {
            const raw = JSON.parse(localStorage.getItem(CASES_KEY));
            if (raw && Array.isArray(raw.cases)) return raw.cases;
        } catch (e) {}
        return [];
    }
    function saveCases(cases) {
        localStorage.setItem(CASES_KEY, JSON.stringify({ cases }));
    }

    /* ============================================
       НАВИГАЦИЯ
    ============================================ */
    const navFiles = document.getElementById('nav-files');
    const navWrapper = document.getElementById('navWrapper');
    const burgerBtn = document.getElementById('burgerBtn');

    if (navFiles) {
        navFiles.addEventListener('click', (e) => {
            e.preventDefault();
            window.showView('files-view');
            renderCases();
        });
    }

    /* ============================================
       РЕНДЕР СПИСКА ДЕЛ
    ============================================ */
    function renderCases() {
        const grid = document.getElementById('casesGrid');
        if (!grid) return;
        const cases = loadCases();
        grid.innerHTML = '';

        // Счётчик дел
        const countEl = document.getElementById('casesCount');
        if (countEl) countEl.textContent = cases.length ? `${cases.length}` : '';

        if (cases.length === 0) {
            grid.innerHTML = '<div class="empty-files" style="grid-column:1/-1">Пока нет дел. Создайте первое дело ниже.</div>';
            return;
        }

        cases.forEach(c => {
            const card = document.createElement('div');
            card.className = 'case-card';
            card.innerHTML = `
                <div class="case-card-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="case-card-title">${escapeHtml(c.name)}</div>
                <div class="case-card-meta">${c.files.length} файл(ов) · создано ${formatDate(c.createdAt)}</div>
            `;
            card.onclick = () => openCase(c.id);
            grid.appendChild(card);
        });
    }

    /* ============================================
       СОЗДАНИЕ ДЕЛА
    ============================================ */
    document.getElementById('createCaseBtn').onclick = () => {
        document.getElementById('caseInput').value = '';
        document.getElementById('caseModal').style.display = 'flex';
        document.getElementById('caseInput').focus();
    };
    document.getElementById('caseCancel').onclick = () => {
        document.getElementById('caseModal').style.display = 'none';
    };
    document.getElementById('caseSave').onclick = () => {
        const name = document.getElementById('caseInput').value.trim();
        if (!name) return;
        const cases = loadCases();
        cases.push({
            id: Date.now().toString(),
            name,
            createdAt: Date.now(),
            files: []
        });
        saveCases(cases);
        document.getElementById('caseModal').style.display = 'none';
        renderCases();
    };
    document.getElementById('caseInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('caseSave').click();
    });

    /* ============================================
       ОТКРЫТИЕ ДЕЛА
    ============================================ */
    let currentCaseId = null;

    function openCase(caseId) {
        const cases = loadCases();
        const c = cases.find(x => x.id === caseId);
        if (!c) return;
        currentCaseId = caseId;
        document.getElementById('caseDetailTitle').textContent = c.name;
        renderFiles(c);
        window.showView('case-detail-view');
    }

    document.getElementById('backToCasesBtn').onclick = () => {
        currentCaseId = null;
        window.showView('files-view');
        renderCases();
    };

    document.getElementById('deleteCaseBtn').onclick = () => {
        if (!currentCaseId) return;
        if (!confirm('Удалить дело и все файлы в нём?')) return;
        let cases = loadCases();
        cases = cases.filter(c => c.id !== currentCaseId);
        saveCases(cases);
        currentCaseId = null;
        window.showView('files-view');
        renderCases();
    };

    /* ============================================
       РЕНДЕР ФАЙЛОВ ВНУТРИ ДЕЛА
    ============================================ */
    function renderFiles(caseObj) {
        const list = document.getElementById('filesList');
        list.innerHTML = '';

        if (caseObj.files.length === 0) {
            list.innerHTML = '<div class="empty-files">Файлов пока нет. Загрузите первый документ выше.</div>';
            return;
        }

        caseObj.files.forEach(f => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-icon">${fileIcon(f.type)}</div>
                <div class="file-item-info">
                    <div class="file-item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                    <div class="file-item-size">${formatSize(f.size)}</div>
                </div>
                <div class="file-item-actions">
                    <button class="file-action-btn download" title="Скачать">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </button>
                    <button class="file-action-btn delete" title="Удалить">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            `;
            item.querySelector('.download').onclick = () => downloadFile(f);
            item.querySelector('.delete').onclick = () => deleteFile(f.id);
            list.appendChild(item);
        });
    }

    /* ============================================
       ЗАГРУЗКА ФАЙЛОВ
    ============================================ */
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) handleFiles(fileInput.files);
            fileInput.value = '';
        });
    }

    function handleFiles(fileList) {
        if (!currentCaseId) return;
        const files = Array.from(fileList);
        const cases = loadCases();
        const c = cases.find(x => x.id === currentCaseId);
        if (!c) return;

        let processed = 0;
        files.forEach(file => {
            if (file.size > MAX_FILE_SIZE) {
                alert(`Файл «${file.name}» больше 5 МБ и не будет загружен.`);
                processed++;
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                c.files.push({
                    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: reader.result   // base64 data URL
                });
                processed++;
                if (processed === files.length) {
                    try {
                        saveCases(cases);
                    } catch (err) {
                        alert('Не удалось сохранить файлы: место в браузере закончилось. Удалите старые файлы и попробуйте снова.');
                        return;
                    }
                    openCase(currentCaseId);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    /* ============================================
       СКАЧИВАНИЕ / УДАЛЕНИЕ
    ============================================ */
    function downloadFile(f) {
        const a = document.createElement('a');
        a.href = f.data;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function deleteFile(fileId) {
        if (!currentCaseId) return;
        if (!confirm('Удалить файл?')) return;
        const cases = loadCases();
        const c = cases.find(x => x.id === currentCaseId);
        if (!c) return;
        c.files = c.files.filter(f => f.id !== fileId);
        saveCases(cases);
        openCase(currentCaseId);
    }

    /* ============================================
       ХЕЛПЕРЫ
    ============================================ */
    function escapeHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
    }
    function formatDate(ts) {
        const d = new Date(ts);
        return `${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    }
    function fileIcon(type) {
        if (type.includes('pdf')) return '📄';
        if (type.includes('image')) return '🖼️';
        if (type.includes('word') || type.includes('document')) return '📝';
        if (type.includes('excel') || type.includes('sheet')) return '📊';
        return '📎';
    }

    /* ============================================
       СТАРТ
    ============================================ */
    renderCases();
});