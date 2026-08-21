(function() {
    'use strict';

    const STORAGE_KEY = 'todolist_todos_v1';
    const PRIORITY_LABELS = { none: '无', low: '低', medium: '中', high: '高' };

    let todos = [];
    let currentFilter = 'all';
    let selectedPriority = 'medium';
    let editingId = null;
    let supabaseClient = null;
    let isOnlineMode = false;

    const $ = (id) => document.getElementById(id);
    const todoForm = $('todoForm');
    const todoInput = $('todoInput');
    const todoList = $('todoList');
    const emptyState = $('emptyState');
    const filters = $('filters');
    const clearCompletedBtn = $('clearCompleted');
    const activeCountEl = $('activeCount');
    const completedCountEl = $('completedCount');
    const footerInfo = $('footerInfo');
    const currentDateEl = $('currentDate');
    const syncStatusEl = $('syncStatus');
    const prioritySelector = document.querySelector('.priority-selector');

    function isSupabaseConfigured() {
        const cfg = window.SUPABASE_CONFIG || {};
        return cfg.url && cfg.anonKey &&
               cfg.url !== 'YOUR_SUPABASE_URL' &&
               cfg.anonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
               typeof window.supabase !== 'undefined';
    }

    function initSupabase() {
        if (!isSupabaseConfigured()) {
            setSyncStatus('local', '本地模式');
            return false;
        }
        try {
            supabaseClient = window.supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );
            isOnlineMode = true;
            return true;
        } catch (e) {
            console.warn('Supabase 初始化失败，降级为本地模式', e);
            setSyncStatus('local', '本地模式');
            return false;
        }
    }

    function setSyncStatus(state, text) {
        syncStatusEl.classList.remove('synced', 'syncing', 'error');
        if (state === 'synced') syncStatusEl.classList.add('synced');
        else if (state === 'syncing') syncStatusEl.classList.add('syncing');
        else if (state === 'error') syncStatusEl.classList.add('error');
        syncStatusEl.querySelector('.sync-text').textContent = text;
        syncStatusEl.title = text;
    }

    function toDbRow(todo) {
        return {
            id: todo.id,
            text: todo.text,
            completed: todo.completed,
            priority: todo.priority,
            created_at: todo.createdAt
        };
    }

    function fromDbRow(row) {
        return {
            id: row.id,
            text: row.text,
            completed: row.completed,
            priority: row.priority,
            createdAt: row.created_at
        };
    }

    function loadLocalCache() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                todos = JSON.parse(stored);
                return true;
            }
        } catch (e) {}
        return false;
    }

    function saveLocalCache() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        } catch (e) {}
    }

    async function loadTodos() {
        if (!isOnlineMode) {
            loadLocalCache();
            render();
            return;
        }

        loadLocalCache();
        render();

        setSyncStatus('syncing', '同步中');
        try {
            const { data, error } = await supabaseClient
                .from('todos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            todos = (data || []).map(fromDbRow);
            saveLocalCache();
            render();
            setSyncStatus('synced', '已同步');
        } catch (e) {
            console.warn('从服务器加载失败，使用本地缓存', e);
            setSyncStatus('error', '离线');
        }
    }

    async function syncInsert(todo) {
        if (!isOnlineMode) return true;
        setSyncStatus('syncing', '同步中');
        try {
            const { error } = await supabaseClient
                .from('todos')
                .insert(toDbRow(todo));
            if (error) throw error;
            setSyncStatus('synced', '已同步');
            return true;
        } catch (e) {
            console.warn('同步新增失败', e);
            setSyncStatus('error', '同步失败');
            return false;
        }
    }

    async function syncUpdate(id, patch) {
        if (!isOnlineMode) return true;
        setSyncStatus('syncing', '同步中');
        try {
            const { error } = await supabaseClient
                .from('todos')
                .update(patch)
                .eq('id', id);
            if (error) throw error;
            setSyncStatus('synced', '已同步');
            return true;
        } catch (e) {
            console.warn('同步更新失败', e);
            setSyncStatus('error', '同步失败');
            return false;
        }
    }

    async function syncDelete(id) {
        if (!isOnlineMode) return true;
        setSyncStatus('syncing', '同步中');
        try {
            const { error } = await supabaseClient
                .from('todos')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setSyncStatus('synced', '已同步');
            return true;
        } catch (e) {
            console.warn('同步删除失败', e);
            setSyncStatus('error', '同步失败');
            return false;
        }
    }

    async function syncDeleteMany(ids) {
        if (!isOnlineMode) return true;
        setSyncStatus('syncing', '同步中');
        try {
            const { error } = await supabaseClient
                .from('todos')
                .delete()
                .in('id', ids);
            if (error) throw error;
            setSyncStatus('synced', '已同步');
            return true;
        } catch (e) {
            console.warn('同步批量删除失败', e);
            setSyncStatus('error', '同步失败');
            return false;
        }
    }

    function init() {
        initSupabase();
        renderDate();
        bindEvents();
        loadTodos();
    }

    function renderDate() {
        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const month = now.getMonth() + 1;
        const day = now.getDate();
        currentDateEl.textContent = `${month}月${day}日 · ${weekdays[now.getDay()]}`;
    }

    function bindEvents() {
        todoForm.addEventListener('submit', handleAdd);

        prioritySelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.priority-btn');
            if (!btn) return;
            prioritySelector.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPriority = btn.dataset.priority;
        });

        filters.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            render();
        });

        clearCompletedBtn.addEventListener('click', handleClearCompleted);

        todoList.addEventListener('click', handleListClick);
        todoList.addEventListener('dblclick', handleListDblClick);
        todoList.addEventListener('keydown', handleEditKeydown);
        todoList.addEventListener('blur', handleEditBlur, true);

        window.addEventListener('online', () => {
            if (isOnlineMode) {
                setSyncStatus('syncing', '同步中');
                loadTodos();
            }
        });
    }

    function handleAdd(e) {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (!text) {
            todoInput.focus();
            return;
        }

        const todo = {
            id: Date.now() + Math.random().toString(36).slice(2, 8),
            text: text,
            completed: false,
            priority: selectedPriority,
            createdAt: Date.now()
        };

        todos.unshift(todo);
        todoInput.value = '';
        saveLocalCache();
        render();
        syncInsert(todo);
    }

    function handleListClick(e) {
        const checkbox = e.target.closest('.todo-checkbox');
        if (checkbox) {
            const item = checkbox.closest('.todo-item');
            toggleTodo(item.dataset.id);
            return;
        }

        const actionBtn = e.target.closest('.action-btn');
        if (actionBtn) {
            const item = actionBtn.closest('.todo-item');
            const action = actionBtn.dataset.action;
            if (action === 'delete') {
                deleteTodo(item.dataset.id);
            } else if (action === 'edit') {
                startEdit(item.dataset.id);
            }
        }
    }

    function handleListDblClick(e) {
        const content = e.target.closest('.todo-content');
        if (!content) return;
        const item = content.closest('.todo-item');
        startEdit(item.dataset.id);
    }

    function toggleTodo(id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        todo.completed = !todo.completed;
        saveLocalCache();
        render();
        syncUpdate(id, { completed: todo.completed });
    }

    function deleteTodo(id) {
        const item = todoList.querySelector(`[data-id="${id}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                todos = todos.filter(t => t.id !== id);
                saveLocalCache();
                render();
            }, 280);
        }
        syncDelete(id);
    }

    function startEdit(id) {
        editingId = id;
        render();
        const input = todoList.querySelector('.todo-edit-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    function handleEditKeydown(e) {
        if (!e.target.classList.contains('todo-edit-input')) return;
        const item = e.target.closest('.todo-item');
        const id = item.dataset.id;

        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit(id, e.target.value.trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            editingId = null;
            render();
        }
    }

    function handleEditBlur(e) {
        if (!e.target.classList.contains('todo-edit-input')) return;
        if (editingId === null) return;
        const item = e.target.closest('.todo-item');
        commitEdit(item.dataset.id, e.target.value.trim());
    }

    function commitEdit(id, newText) {
        if (editingId !== id) return;
        const todo = todos.find(t => t.id === id);
        if (newText && todo && newText !== todo.text) {
            todo.text = newText;
            saveLocalCache();
            syncUpdate(id, { text: newText });
        }
        editingId = null;
        render();
    }

    function handleClearCompleted() {
        const completedTodos = todos.filter(t => t.completed);
        if (completedTodos.length === 0) return;

        const completedIds = completedTodos.map(t => t.id);
        const completedItems = todoList.querySelectorAll('.todo-item.completed');
        completedItems.forEach(item => item.classList.add('removing'));

        setTimeout(() => {
            todos = todos.filter(t => !t.completed);
            saveLocalCache();
            render();
        }, 280);
        syncDeleteMany(completedIds);
    }

    function getFilteredTodos() {
        switch (currentFilter) {
            case 'active': return todos.filter(t => !t.completed);
            case 'completed': return todos.filter(t => t.completed);
            default: return todos;
        }
    }

    function formatTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderTodoItem(todo) {
        const li = document.createElement('li');
        li.className = `todo-item${todo.completed ? ' completed' : ''}`;
        li.dataset.id = todo.id;
        const isEditing = editingId === todo.id;

        li.innerHTML = `
            <button class="todo-checkbox" aria-label="${todo.completed ? '标记为未完成' : '标记为完成'}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="priority-indicator ${todo.priority}"></div>
            <div class="todo-content">
                ${isEditing
                    ? `<input type="text" class="todo-edit-input" value="${escapeHtml(todo.text)}" maxlength="200">`
                    : `<div class="todo-text">${escapeHtml(todo.text)}</div>
                       <div class="todo-meta">${formatTime(todo.createdAt)} · 优先级 ${PRIORITY_LABELS[todo.priority]}</div>`
                }
            </div>
            ${!isEditing ? `
                <div class="todo-actions">
                    <button class="action-btn edit" data-action="edit" aria-label="编辑">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" data-action="delete" aria-label="删除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            ` : ''}
        `;
        return li;
    }

    function render() {
        const filtered = getFilteredTodos();
        todoList.innerHTML = '';

        if (filtered.length === 0) {
            todoList.style.display = 'none';
            emptyState.style.display = 'flex';
            if (todos.length === 0) {
                emptyState.querySelector('.empty-title').textContent = '暂无待办事项';
                emptyState.querySelector('.empty-subtitle').textContent = '添加一个新任务开始你的高效一天';
            } else {
                emptyState.querySelector('.empty-title').textContent = '没有匹配的待办';
                emptyState.querySelector('.empty-subtitle').textContent = '试试切换其他筛选条件';
            }
        } else {
            todoList.style.display = 'flex';
            emptyState.style.display = 'none';
            filtered.forEach(todo => todoList.appendChild(renderTodoItem(todo)));
        }

        const activeCount = todos.filter(t => !t.completed).length;
        const completedCount = todos.filter(t => t.completed).length;
        activeCountEl.textContent = activeCount;
        completedCountEl.textContent = completedCount;
        footerInfo.textContent = `共 ${todos.length} 项待办 · ${completedCount} 项已完成`;
        clearCompletedBtn.disabled = completedCount === 0;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
