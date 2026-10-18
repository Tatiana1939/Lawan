document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Переключение на вкладку "Задачи" ---------- */
    const navTasks = document.getElementById('nav-tasks');
    const navWrapper = document.getElementById('navWrapper');
    const burgerBtn = document.getElementById('burgerBtn');

    function showTasksView() {
        ['main-view', 'calendar-view', 'tasks-view'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === 'tasks-view') ? 'block' : 'none';
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (navWrapper) navWrapper.classList.remove('open');
        if (burgerBtn) burgerBtn.classList.remove('active');
        renderBoards();
    }

    if (navTasks) {
        navTasks.addEventListener('click', (e) => {
            e.preventDefault();
            showTasksView();
        });
    }

    /* ---------- Управление видами ---------- */
    const viewBtns = document.querySelectorAll('.toolbar-icon-btn');
    const viewContainers = {
        board: document.getElementById('boardViewContainer'),
        calendar: document.getElementById('calendarViewContainer'),
        gantt: document.getElementById('ganttViewContainer')
    };

    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            Object.keys(viewContainers).forEach(k => {
                viewContainers[k].classList.toggle('active', k === view);
            });
        });
    });

    /* ---------- ХРАНИЛИЩЕ ДОСОК ---------- */
    const BOARDS_KEY = 'plannerBoardsV2';

    function loadBoards() {
        try {
            const raw = JSON.parse(localStorage.getItem(BOARDS_KEY));
            if (raw && Array.isArray(raw) && raw.length > 0) return raw;
        } catch(e) {}

        const def = [
            { id: 'board-1', name: 'Моя доска' },
            { id: 'board-2', name: 'Проект Альфа' },
            { id: 'board-3', name: 'Личное' }
        ];
        localStorage.setItem(BOARDS_KEY, JSON.stringify(def));
        return def;
    }
    function saveBoards(boards) { localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)); }

    let currentBoardId = loadBoards()[0].id;

    function renderBoards() {
        const tabsContainer = document.getElementById('boardsTabs');
        if (!tabsContainer) return;
        tabsContainer.innerHTML = '';
        const boards = loadBoards();

        boards.forEach(board => {
            const btn = document.createElement('button');
            btn.className = 'board-tab' + (board.id === currentBoardId ? ' active' : '');
            btn.textContent = board.name;
            btn.onclick = () => {
                currentBoardId = board.id;
                renderBoards();
                renderKanban();
            };
            tabsContainer.appendChild(btn);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'add-board-btn';
        addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Доска`;
        addBtn.onclick = () => {
            document.getElementById('boardInput').value = '';
            document.getElementById('boardModal').style.display = 'flex';
            document.getElementById('boardInput').focus();
        };
        tabsContainer.appendChild(addBtn);
    }

    document.getElementById('boardCancel').onclick = () => document.getElementById('boardModal').style.display = 'none';
    document.getElementById('boardSave').onclick = () => {
        const name = document.getElementById('boardInput').value.trim();
        if (!name) return;
        const boards = loadBoards();
        const newBoard = { id: 'board-' + Date.now(), name };
        boards.push(newBoard);
        saveBoards(boards);
        currentBoardId = newBoard.id;
        document.getElementById('boardModal').style.display = 'none';
        renderBoards();
        renderKanban();
    };

    /* ---------- КАНБАН ---------- */
    const TASKS_KEY = 'plannerTasksV4';

    function loadTasks() {
        try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '{}'); } catch(e) { return {}; }
    }
    function saveTasks(tasks) { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }

    function ensureDemoData() {
        if (localStorage.getItem(TASKS_KEY)) return;
        const demo = {
            'board-1': [
                {
                    id: 't1', text: 'Получить финальное утверждение дизайна от заказчика', status: 'todo',
                    markers: { priority: 'high', deadline: '27 авг', assignee: 'А. Смирнов' },
                    subtasks: [
                        { id: 's1', text: 'Согласовать правки с юристом', completed: true, subtasks: [
                                { id: 's1-1', text: 'Отправить документы на проверку', completed: true, subtasks: [] }
                            ]},
                        { id: 's2', text: 'Отправить на почту клиенту', completed: false, subtasks: [] }
                    ]
                },
                {
                    id: 't2', text: 'Подготовить итоговые файлы для разработчиков', status: 'todo',
                    markers: { assignee: 'И. Иванов', deadline: '28 авг' },
                    subtasks: [{ id: 's3', text: 'Собрать исходники в папку', completed: false, subtasks: [] }]
                }
            ]
        };
        saveTasks(demo);
    }

    // Выпадающие меню тулбара
    document.querySelectorAll('.marker-trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = trigger.closest('.marker-dropdown');
            document.querySelectorAll('.marker-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
            dropdown.classList.toggle('open');
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.marker-dropdown.open').forEach(d => d.classList.remove('open'));
        document.querySelectorAll('.marker-menu.open').forEach(m => m.classList.remove('open'));
    });

    // Drag & Drop для маркеров из тулбара
    document.querySelectorAll('.marker-drag-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('marker-type', item.dataset.marker);
            e.dataTransfer.setData('marker-value', item.dataset.value);
            e.dataTransfer.effectAllowed = 'copy';
            setTimeout(() => item.closest('.marker-dropdown').classList.remove('open'), 0);
        });
    });

    // Модалка подзадач (бесконечная)
    let activeSubtaskParentId = null;
    let activeSubtaskTaskId = null;

    document.getElementById('subtaskCancel').onclick = () => document.getElementById('subtaskModal').style.display = 'none';
    document.getElementById('subtaskSave').onclick = () => {
        const text = document.getElementById('subtaskInput').value.trim();
        if (!text || !activeSubtaskTaskId) return;
        const all = loadTasks();
        const tasks = all[currentBoardId] || [];
        const task = tasks.find(t => t.id === activeSubtaskTaskId);

        if (task) {
            const newSub = { id: Date.now().toString(), text, completed: false, subtasks: [] };
            if (activeSubtaskParentId) {
                // Добавляем в подзадачу (рекурсивный поиск)
                const addToSub = (subs) => {
                    for (let s of subs) {
                        if (s.id === activeSubtaskParentId) { s.subtasks.push(newSub); return true; }
                        if (addToSub(s.subtasks)) return true;
                    }
                    return false;
                };
                addToSub(task.subtasks);
            } else {
                // Добавляем в корень
                task.subtasks.push(newSub);
            }
            saveTasks(all);
            renderKanban();
        }
        document.getElementById('subtaskModal').style.display = 'none';
    };

    // ДОБАВЛЕНА ОБРАБОТКА ENTER ДЛЯ ПОДЗАДАЧ
    document.getElementById('subtaskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('subtaskSave').click();
    });

    function renderKanban() {
        const board = document.getElementById('kanbanBoard');
        if (!board) return;

        ensureDemoData();
        const allData = loadTasks();
        const tasks = allData[currentBoardId] || [];
        const columns = { todo: [], doing: [], done: [] };
        tasks.forEach(t => { if (columns[t.status]) columns[t.status].push(t); });

        Object.keys(columns).forEach(status => {
            const container = document.querySelector(`.kanban-cards[data-status="${status}"]`);
            if (!container) return;
            container.innerHTML = '';

            if (columns[status].length === 0) {
                const empty = document.createElement('div');
                empty.className = 'kanban-empty';
                empty.textContent = 'Пока пусто.';
                container.appendChild(empty);
            }

            columns[status].forEach(task => {
                const card = document.createElement('div');
                card.className = 'kanban-card' + (task.completed ? ' completed' : '');
                card.dataset.id = task.id;

                // Маркеры
                let badgesHtml = '';
                const m = task.markers || {};
                if (m.assignee) badgesHtml += `<span class="kanban-badge assignee" draggable="true" data-badge-type="assignee" data-badge-value="${escapeHtml(m.assignee)}">👤 ${escapeHtml(m.assignee)} <button class="badge-delete" data-remove="assignee">×</button></span>`;
                if (m.deadline) badgesHtml += `<span class="kanban-badge deadline" draggable="true" data-badge-type="deadline" data-badge-value="${escapeHtml(m.deadline)}">📅 ${escapeHtml(m.deadline)} <button class="badge-delete" data-remove="deadline">×</button></span>`;
                if (m.priority) {
                    const pLabel = m.priority === 'high' ? 'Высокий' : m.priority === 'medium' ? 'Средний' : 'Низкий';
                    badgesHtml += `<span class="kanban-badge priority ${m.priority}" draggable="true" data-badge-type="priority" data-badge-value="${m.priority}">⚡ ${pLabel} <button class="badge-delete" data-remove="priority">×</button></span>`;
                }

                // Рекурсивный рендер подзадач
                const renderSubs = (subs, parentTaskId, isRoot = false) => {
                    if (!subs || subs.length === 0) return '';

                    let html = isRoot ? `<div class="subtasks-list">` : `<div class="subtask-children">`;

                    subs.forEach(sub => {
                        html += `
                            <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                                <div class="subtask-row">
                                    <button class="subtask-checkbox ${sub.completed ? 'checked' : ''}" data-sub-id="${sub.id}">
                                        ${sub.completed ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                                    </button>
                                    <span class="subtask-text">${escapeHtml(sub.text)}</span>
                                    <button class="add-nested-btn" data-add-sub="${parentTaskId}" data-parent-id="${sub.id}" title="Добавить вложенную">+</button>
                                    <button class="subtask-delete" data-sub-delete="${sub.id}" data-parent-task="${parentTaskId}">×</button>
                                </div>
                                ${renderSubs(sub.subtasks, parentTaskId, false)}
                            </div>
                        `;
                    });
                    html += `</div>`;
                    return html;
                };

                let subtasksHtml = renderSubs(task.subtasks, task.id, true);
                subtasksHtml += `<button class="add-subtask-btn" data-add-sub="${task.id}">+ Подзадача</button>`;

                card.innerHTML = `
                    <button class="card-delete-btn" data-action="delete" title="Удалить задачу">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>

                    <div class="kanban-card-row">
                        <button class="kanban-checkbox" data-action="toggle">
                            ${task.completed ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                        </button>
                        <div class="kanban-card-title">${escapeHtml(task.text)}</div>
                        
                        <button class="kanban-add-marker-btn" title="Добавить маркер">+</button>
                        <div class="marker-menu">
                            <button class="marker-menu-item" data-add-marker="priority" data-value="high">🔴 Высокий</button>
                            <button class="marker-menu-item" data-add-marker="deadline" data-value="Сегодня">📅 Сегодня</button>
                        </div>
                    </div>
                    
                    <div class="kanban-card-tags">${badgesHtml}</div>
                    ${subtasksHtml}
                `;

                // Обработчики подзадач
                card.querySelectorAll('.subtask-checkbox').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const all = loadTasks();
                        const t = all[currentBoardId].find(x => x.id === task.id);
                        const toggleSub = (subs) => {
                            for (let s of subs) {
                                if (s.id === btn.dataset.subId) { s.completed = !s.completed; return true; }
                                if (toggleSub(s.subtasks)) return true;
                            }
                        };
                        toggleSub(t.subtasks);
                        saveTasks(all);
                        renderKanban();
                    };
                });

                card.querySelectorAll('.subtask-delete').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const all = loadTasks();
                        const t = all[currentBoardId].find(x => x.id === task.id);
                        const removeSub = (subs) => {
                            const idx = subs.findIndex(s => s.id === btn.dataset.subDelete);
                            if (idx !== -1) { subs.splice(idx, 1); return true; }
                            for (let s of subs) { if (removeSub(s.subtasks)) return true; }
                        };
                        removeSub(t.subtasks);
                        saveTasks(all);
                        renderKanban();
                    };
                });

                card.querySelectorAll('[data-add-sub]').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        activeSubtaskTaskId = btn.dataset.addSub;
                        activeSubtaskParentId = btn.dataset.parentId || null;
                        document.getElementById('subtaskInput').value = '';
                        document.getElementById('subtaskModal').style.display = 'flex';
                        document.getElementById('subtaskInput').focus();
                    };
                });

                // Маркеры и кнопки
                const addBtn = card.querySelector('.kanban-add-marker-btn');
                const markerMenu = card.querySelector('.marker-menu');
                addBtn.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.marker-menu.open').forEach(m => { if(m !== markerMenu) m.classList.remove('open'); }); markerMenu.classList.toggle('open'); };

                card.querySelectorAll('.marker-menu-item').forEach(item => {
                    item.onclick = (e) => { e.stopPropagation(); markerMenu.classList.remove('open'); updateTaskMarker(task.id, item.dataset.addMarker, item.dataset.value); };
                });

                card.querySelectorAll('.badge-delete').forEach(btn => {
                    btn.onclick = (e) => { e.stopPropagation(); updateTaskMarker(task.id, btn.dataset.remove, null); };
                });

                // Перетаскивание бейджей (маркеров) на другие карточки
                card.querySelectorAll('.kanban-badge').forEach(badge => {
                    badge.addEventListener('dragstart', (e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('badge-type', badge.dataset.badgeType);
                        e.dataTransfer.setData('badge-value', badge.dataset.badgeValue);
                        e.dataTransfer.effectAllowed = 'move';
                        setTimeout(() => updateTaskMarker(task.id, badge.dataset.badgeType, null), 0);
                    });
                });

                // Обработка чекбокса и удаления задачи
                card.querySelector('[data-action="toggle"]').onclick = (e) => {
                    e.stopPropagation();
                    const all = loadTasks();
                    const idx = all[currentBoardId].findIndex(x => x.id === task.id);
                    const was = all[currentBoardId][idx].completed;
                    all[currentBoardId][idx].completed = !was;
                    all[currentBoardId][idx].status = !was ? 'done' : 'doing';
                    saveTasks(all);
                    renderKanban();
                };
                card.querySelector('[data-action="delete"]').onclick = (e) => {
                    e.stopPropagation();
                    const all = loadTasks();
                    all[currentBoardId] = all[currentBoardId].filter(x => x.id !== task.id);
                    saveTasks(all);
                    renderKanban();
                };

                // Drag & Drop карточки
                card.draggable = true;
                card.addEventListener('dragstart', (e) => {
                    if (e.dataTransfer.types.includes('marker-type') || e.dataTransfer.types.includes('badge-type')) return;
                    card.classList.add('dragging');
                    e.dataTransfer.setData('task-id', task.id);
                });
                card.addEventListener('dragend', () => card.classList.remove('dragging'));

                // Приём маркеров (из тулбара и перетаскиваемых бейджей)
                card.addEventListener('dragover', (e) => {
                    if (e.dataTransfer.types.includes('marker-type') || e.dataTransfer.types.includes('badge-type')) {
                        e.preventDefault();
                        card.classList.add('drag-over-marker');
                    }
                });
                card.addEventListener('dragleave', () => card.classList.remove('drag-over-marker'));
                card.addEventListener('drop', (e) => {
                    if (e.dataTransfer.types.includes('marker-type')) {
                        e.preventDefault(); e.stopPropagation(); card.classList.remove('drag-over-marker');
                        updateTaskMarker(task.id, e.dataTransfer.getData('marker-type'), e.dataTransfer.getData('marker-value'));
                    }
                    if (e.dataTransfer.types.includes('badge-type')) {
                        e.preventDefault(); e.stopPropagation(); card.classList.remove('drag-over-marker');
                        updateTaskMarker(task.id, e.dataTransfer.getData('badge-type'), e.dataTransfer.getData('badge-value'));
                    }
                });

                container.appendChild(card);
            });
        });
    }

    function updateTaskMarker(taskId, type, value) {
        const all = loadTasks();
        const task = all[currentBoardId].find(x => x.id === taskId);
        if (!task) return;
        if (!task.markers) task.markers = {};
        if (value === null) delete task.markers[type];
        else task.markers[type] = value;
        saveTasks(all);
        renderKanban();
    }

    // Дроп карточек в колонки
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('task-id')) { e.preventDefault(); col.classList.add('drag-over'); }
        });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', (e) => {
            if (e.dataTransfer.types.includes('task-id')) {
                e.preventDefault(); col.classList.remove('drag-over');
                const id = e.dataTransfer.getData('task-id');
                const all = loadTasks();
                const task = all[currentBoardId].find(x => x.id === id);
                if (task) {
                    task.status = col.dataset.status;
                    task.completed = (task.status === 'done');
                    saveTasks(all);
                    renderKanban();
                }
            }
        });
    });

    // Новая задача
    document.querySelectorAll('.kanban-add-btn').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('kanbanInput').value = '';
            document.getElementById('kanbanModal').style.display = 'flex';
            document.getElementById('kanbanInput').focus();
            document.getElementById('kanbanModal').dataset.status = btn.dataset.status;
        };
    });

    document.getElementById('kanbanCancel').onclick = () => document.getElementById('kanbanModal').style.display = 'none';
    document.getElementById('kanbanSave').onclick = () => {
        const text = document.getElementById('kanbanInput').value.trim();
        if (!text) return;
        const status = document.getElementById('kanbanModal').dataset.status || 'todo';
        const all = loadTasks();
        if (!all[currentBoardId]) all[currentBoardId] = [];
        all[currentBoardId].push({ id: Date.now().toString(), text, status, markers: {}, subtasks: [], completed: status === 'done' });
        saveTasks(all);
        document.getElementById('kanbanModal').style.display = 'none';
        renderKanban();
    };

    // ДОБАВЛЕНА ОБРАБОТКА ENTER ДЛЯ ЗАДАЧ
    document.getElementById('kanbanInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('kanbanSave').click();
    });

    function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
});