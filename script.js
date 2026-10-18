// Ждем, пока весь HTML документ загрузится
document.addEventListener('DOMContentLoaded', () => {

    // 1. Находим все кнопки-переключатели (по классу feature-item)
    const tabButtons = document.querySelectorAll('.feature-item');

    // 2. Находим все контейнеры с чатами (по классу chat-view)
    const chatViews = document.querySelectorAll('.chat-view');

    // 3. Проходимся по каждой кнопке и вешаем на неё обработчик клика
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {

            // --- ШАГ А: Переключение активного состояния кнопок ---
            // Убираем класс 'active' у ВСЕХ кнопок (они становятся серыми)
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Добавляем класс 'active' ТОЛЬКО нажатой кнопке (она становится белой)
            button.classList.add('active');


            // --- ШАГ Б: Переключение видимости чатов ---
            // Получаем ID нужного чата из атрибута data-target нажатой кнопки
            const targetId = button.getAttribute('data-target');

            // Скрываем ВСЕ чаты
            chatViews.forEach(chat => chat.classList.remove('active'));

            // Находим нужный чат по ID и показываем его
            const targetChat = document.getElementById(targetId);
            if (targetChat) {
                targetChat.classList.add('active');
            } else {
                console.warn(`Чат с id="${targetId}" не найден на странице.`);
            }
        });
    });
    // --- Логика бургер-меню ---
    const burgerBtn = document.getElementById('burgerBtn');
    const navWrapper = document.getElementById('navWrapper');

    if (burgerBtn && navWrapper) {
        // Открытие/закрытие меню
        burgerBtn.addEventListener('click', () => {
            burgerBtn.classList.toggle('active');
            navWrapper.classList.toggle('open');
        });

        // Закрытие меню при клике на любую ссылку внутри
        navWrapper.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                burgerBtn.classList.remove('active');
                navWrapper.classList.remove('open');
            });
        });

        // Закрытие меню при клике вне его
        document.addEventListener('click', (event) => {
            const isClickInsideMenu = navWrapper.contains(event.target);
            const isClickOnBurger = burgerBtn.contains(event.target);

            if (!isClickInsideMenu && !isClickOnBurger && navWrapper.classList.contains('open')) {
                burgerBtn.classList.remove('active');
                navWrapper.classList.remove('open');
            }
        });
    }
        // ============================================
    //     ПЕРЕКЛЮЧЕНИЕ: главная / календарь
    // ============================================
    const navCalendar = document.getElementById('nav-calendar');
    const navHome = document.getElementById('nav-home');
    const mainView = document.getElementById('main-view');
    const calendarView = document.getElementById('calendar-view');

    function switchView(targetId) {
        const views = ['main-view', 'calendar-view', 'tasks-view'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === targetId) ? 'block' : 'none';
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Закрываем бургер-меню, если открыто
        const navWrapper = document.getElementById('navWrapper');
        const burgerBtn = document.getElementById('burgerBtn');
        if (navWrapper) navWrapper.classList.remove('open');
        if (burgerBtn) burgerBtn.classList.remove('active');
    }

    if (navCalendar) {
        navCalendar.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('calendar-view');
        });
    }
    if (navHome) {
        navHome.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('main-view');
        });
    }

        // ============================================
    //           РАБОЧИЙ КАЛЕНДАРЬ-ПЛАНЕР
    // ============================================
    let currentDate = new Date(2026, 9, 17); // 17 октября 2026 (месяц 9 = октябрь)
    let currentView = 'week'; // 'week' или 'month'
    
    // Загрузка/Сохранение (Формат: { "2026-10-17": [{id, text, completed}] })
    function loadTasks() {
        try { return JSON.parse(localStorage.getItem('plannerTasksV2') || '{}'); } 
        catch (e) { return {}; }
    }
    function saveTasks(tasks) {
        localStorage.setItem('plannerTasksV2', JSON.stringify(tasks));
    }

    function formatDateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // --- Отрисовка ---
    function render() {
        const allTasks = loadTasks();
        
        if (currentView === 'week') {
            document.getElementById('weekView').style.display = 'flex';
            document.getElementById('monthView').style.display = 'none';
            renderWeek(allTasks);
        } else {
            document.getElementById('weekView').style.display = 'none';
            document.getElementById('monthView').style.display = 'block';
            renderMonth(allTasks);
        }
    }

    function renderWeek(allTasks) {
        const header = document.getElementById('weekDaysHeader');
        const grid = document.getElementById('weekGrid');
        const title = document.getElementById('currentPeriodTitle');
        
        header.innerHTML = '';
        grid.innerHTML = '';

        // Находим понедельник текущей недели
        const dayOfWeek = currentDate.getDay(); // 0 = Вс
        const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
        const monday = new Date(currentDate.setDate(diff));
        
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        
        title.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        const today = new Date();
        const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            
            const dateKey = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = dateKey === todayStr;

            // Шапка дня
            const hDiv = document.createElement('div');
            hDiv.className = 'week-day-header-item';
            hDiv.innerHTML = `
                <span class="wdh-name">${dayNames[d.getDay()]}</span>
                <span class="wdh-num ${isToday ? 'today' : ''}">${d.getDate()}</span>
            `;
            header.appendChild(hDiv);

            // Колонка дня
            const col = document.createElement('div');
            col.className = 'week-day-column';
            // Добавляем дату для мобильного вида (например "Сб 17")
            col.setAttribute('data-date-label', `${dayNames[d.getDay()]} ${d.getDate()}`);
            col.onclick = (e) => {
                if (e.target.closest('.task-btn')) return; // Игнорируем клики по кнопкам
                openModal(dateKey, d);
            };

            const dayTasks = allTasks[dateKey] || [];
            dayTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = `task-card ${task.completed ? 'completed' : ''}`;
                
                card.innerHTML = `
                    <div class="task-card-title">${task.text}</div>
                    <div class="task-card-actions">
                        <button class="task-btn check-btn" data-id="${task.id}" title="Отметить выполненной">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button class="task-btn delete-btn" data-id="${task.id}" title="Удалить">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                `;
                col.appendChild(card);
            });

            // Обработчики для кнопок внутри задач
            col.querySelectorAll('.check-btn').forEach(btn => {
                btn.onclick = (e) => { e.stopPropagation(); toggleTask(dateKey, btn.dataset.id); };
            });
            col.querySelectorAll('.delete-btn').forEach(btn => {
                btn.onclick = (e) => { e.stopPropagation(); deleteTask(dateKey, btn.dataset.id); };
            });

            grid.appendChild(col);
        }
    }

    function renderMonth(allTasks) {
        const grid = document.getElementById('monthGrid');
        const title = document.getElementById('currentPeriodTitle');
        grid.innerHTML = '';

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        
        title.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let startDayOfWeek = firstDay.getDay();
        startDayOfWeek = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1;

        const today = new Date();
        const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

        // Пустые ячейки
        for (let i = 0; i < startDayOfWeek; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-month-day empty';
            grid.appendChild(empty);
        }

        // Дни
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = formatDateKey(year, month, day);
            const isToday = dateKey === todayStr;
            
            const cell = document.createElement('div');
            cell.className = 'cal-month-day';
            if (isToday) cell.classList.add('today');

            // Цифра дня (уже без кружка, просто текст)
            const numDiv = document.createElement('div');
            numDiv.className = 'month-day-num';
            numDiv.textContent = day;
            cell.appendChild(numDiv);
            
            const dayTasks = allTasks[dateKey] || [];

            // Если это сегодня и задач нет — пишем текст
            if (isToday && dayTasks.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-today-msg-month';
                emptyMsg.textContent = 'Добавь задачу на сегодня';
                cell.appendChild(emptyMsg);
            }

            // Если задачи есть — выводим их (максимум 3)
            dayTasks.slice(0, 3).forEach(task => {
                const tDiv = document.createElement('div');
                tDiv.className = 'month-task-dot';
                tDiv.textContent = task.text;
                if (task.completed) tDiv.style.textDecoration = 'line-through';
                cell.appendChild(tDiv);
            });
            if (dayTasks.length > 3) {
                const more = document.createElement('div');
                more.className = 'month-task-dot';
                more.textContent = `+${dayTasks.length - 3} еще`;
                cell.appendChild(more);
            }

            cell.onclick = () => openModal(dateKey, new Date(year, month, day));
            grid.appendChild(cell);
        }
    }

    // --- Действия с задачами ---
    function openModal(dateKey, dateObj) {
        const modal = document.getElementById('taskModal');
        const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        
        document.getElementById('modalDate').textContent = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        document.getElementById('taskInput').value = '';
        modal.style.display = 'flex';
        document.getElementById('taskInput').focus();
        modal.dataset.dateKey = dateKey;
    }

    function toggleTask(dateKey, taskId) {
        const allTasks = loadTasks();
        if (!allTasks[dateKey]) return;
        const task = allTasks[dateKey].find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            saveTasks(allTasks);
            render();
        }
    }

    function deleteTask(dateKey, taskId) {
        const allTasks = loadTasks();
        if (!allTasks[dateKey]) return;
        allTasks[dateKey] = allTasks[dateKey].filter(t => t.id !== taskId);
        if (allTasks[dateKey].length === 0) delete allTasks[dateKey];
        saveTasks(allTasks);
        render();
    }

    // --- Инициализация UI ---
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            render();
        };
    });

    document.getElementById('prevPeriod').onclick = () => {
        if (currentView === 'week') currentDate.setDate(currentDate.getDate() - 7);
        else currentDate.setMonth(currentDate.getMonth() - 1);
        render();
    };

    document.getElementById('nextPeriod').onclick = () => {
        if (currentView === 'week') currentDate.setDate(currentDate.getDate() + 7);
        else currentDate.setMonth(currentDate.getMonth() + 1);
        render();
    };

    document.getElementById('todayBtn').onclick = () => {
        currentDate = new Date(); // Сегодня реальная дата
        render();
    };

    // Сохранение из модалки
    document.getElementById('saveTask').onclick = () => {
        const text = document.getElementById('taskInput').value.trim();
        const dateKey = document.getElementById('taskModal').dataset.dateKey;
        if (!text || !dateKey) return;

        const allTasks = loadTasks();
        if (!allTasks[dateKey]) allTasks[dateKey] = [];
        
        allTasks[dateKey].push({
            id: Date.now().toString(),
            text: text,
            completed: false
        });
        
        saveTasks(allTasks);
        document.getElementById('taskModal').style.display = 'none';
        render();
    };

    document.getElementById('cancelTask').onclick = () => {
        document.getElementById('taskModal').style.display = 'none';
    };

    // Enter для сохранения
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('saveTask').click();
    });

    // Первый запуск
    render();

});