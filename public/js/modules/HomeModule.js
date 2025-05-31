(function() {
    'use strict';
    
    const HomeModule = {
        id: 'home',
        name: 'Home',
        version: '1.0.0',
        
        init() {
            if (this.initialized) return;
            
            this.setupEventListeners();
            this.initialized = true;
        },
        
        setupEventListeners() {
            const searchInput = document.getElementById('tool-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchTools(e.target.value);
                });
            }
        },
        
        searchTools(query) {
            const toolsGrid = document.getElementById('tools-grid');
            const noResults = document.getElementById('no-results');
            const tools = toolsGrid.querySelectorAll('.tool-card');
            
            if (!query.trim()) {
                tools.forEach(tool => tool.style.display = '');
                noResults.classList.add('hidden');
                return;
            }
            
            const searchQuery = query.toLowerCase();
            let hasResults = false;
            
            tools.forEach(tool => {
                const name = tool.getAttribute('data-tool-name').toLowerCase();
                const desc = tool.getAttribute('data-tool-desc').toLowerCase();
                
                const isVisible = name.includes(searchQuery) || desc.includes(searchQuery);
                tool.style.display = isVisible ? '' : 'none';
                if (isVisible) hasResults = true;
            });
            
            noResults.classList.toggle('hidden', hasResults);
        },
        
        render() {
            const nav = document.getElementById('main-nav');
            nav.classList.remove('hidden');
            
            const user = window.stateManager.getState('user');
            if (user) {
                document.getElementById('user-email').textContent = user.email;
            }
            
            ['auth-module', 'coco-money-module'].forEach(id => {
                document.getElementById(id).classList.add('hidden');
            });
            document.getElementById('home-module').classList.remove('hidden');
            document.getElementById('sheet-fullscreen').classList.add('hidden');
            
            const searchInput = document.getElementById('tool-search');
            if (searchInput) {
                searchInput.value = '';
                this.searchTools('');
            }
        }
    };

    window.moduleManager.register(HomeModule);
})();
