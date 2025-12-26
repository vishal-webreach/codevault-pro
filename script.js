const STORE_KEY = 'cv_pro_final_v10';

const LIBRARIES = [
    { name: 'Tailwind CSS', url: 'https://cdn.tailwindcss.com', type: 'js', icon: 'fa-css3 text-cyan-400' },
    { name: 'Bootstrap CSS', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css', type: 'css', icon: 'fa-bootstrap text-purple-400' },
    { name: 'Bootstrap JS', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js', type: 'js', icon: 'fa-bootstrap text-purple-400' },
    { name: 'React', url: 'https://unpkg.com/react@18/umd/react.development.js', type: 'js', icon: 'fa-react text-blue-400' },
    { name: 'ReactDOM', url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js', type: 'js', icon: 'fa-react text-blue-400' },
    { name: 'Vue 3', url: 'https://unpkg.com/vue@3/dist/vue.global.js', type: 'js', icon: 'fa-vuejs text-green-400' },
    { name: 'jQuery', url: 'https://code.jquery.com/jquery-3.7.1.min.js', type: 'js', icon: 'fa-js text-yellow-500' },
    { name: 'Three.js', url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', type: 'js', icon: 'fa-cube text-white' },
    { name: 'FontAwesome', url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', type: 'css', icon: 'fa-font-awesome text-blue-300' },
    { name: 'Axios', url: 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js', type: 'js', icon: 'fa-bolt text-yellow-200' },
    { name: 'Lodash', url: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js', type: 'js', icon: 'fa-code text-gray-400' },
];

class CodeVault {
    constructor() {
        this.files = {};
        this.activeFile = null;
        this.editor = null;
        this.isPreview = false;
        this.saveTimer = null;
        this.isResizing = false;
        this.sidebarOpen = false;
        
        // Initialize CodeMirror
        this.editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
            lineNumbers: true, 
            theme: 'dracula', 
            mode: 'javascript', 
            indentUnit: 4, 
            lineWrapping: true,
            viewportMargin: Infinity
        });
        this.editor.on('change', () => this.handleEdit());

        // Keep editor layout robust during resizing
        new ResizeObserver(() => this.editor.refresh()).observe(document.getElementById('cm-wrapper'));

        this.load();
        if(!Object.keys(this.files).length) this.defaults();
        
        this.renderList();
        this.open(this.activeFile || Object.keys(this.files)[0]);
        
        this.initResizer();
        this.renderLibraryList();

        // Global Events
        document.addEventListener('keydown', e => { 
            if((e.ctrlKey || e.metaKey) && e.key === 's') { 
                e.preventDefault(); 
                this.save(true); 
            } 
        });
        document.getElementById('inp-filename').addEventListener('keyup', e => { if(e.key === 'Enter') this.createFile(); });
        document.getElementById('inp-rename').addEventListener('keyup', e => { if(e.key === 'Enter') this.executeRename(); });
    }

    // --- Responsive Sidebar Toggle ---
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        this.sidebarOpen = !this.sidebarOpen;

        if (this.sidebarOpen) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    initResizer() {
        const resizer = document.getElementById('resizer');
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isResizing = true;
            document.getElementById('iframe-overlay').classList.remove('hidden'); 
            document.body.classList.add('resizing');
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            
            if (window.innerWidth < 768) return; 

            const container = document.getElementById('main-split');
            const containerRect = container.getBoundingClientRect();
            const newPreviewWidth = containerRect.right - e.clientX;
            
            // Constrain width
            if (newPreviewWidth > 200 && newPreviewWidth < containerRect.width - 200) {
                const percent = (newPreviewWidth / containerRect.width) * 100;
                document.getElementById('preview-pane').style.width = percent + '%';
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.getElementById('iframe-overlay').classList.add('hidden');
                document.body.classList.remove('resizing');
                this.editor.refresh(); 
            }
        });
    }

    // --- Core Logic ---

    load() {
        try {
            const data = localStorage.getItem(STORE_KEY);
            if(data) {
                const parsed = JSON.parse(data);
                this.files = parsed.files || {};
                this.activeFile = parsed.active;
            }
        } catch(e) { console.error("Load error", e); }
    }

    save(instant = false) {
        if(this.activeFile && this.files[this.activeFile]) {
            this.files[this.activeFile].content = this.editor.getValue();
        }
        
        const persist = () => {
            localStorage.setItem(STORE_KEY, JSON.stringify({ files: this.files, active: this.activeFile }));
            document.getElementById('save-status').classList.add('opacity-0');
            if(this.isPreview) this.updatePreview();
        };

        document.getElementById('save-status').classList.remove('opacity-0');
        
        clearTimeout(this.saveTimer);
        if(instant) {
            persist();
            this.showToast('Saved');
        } else {
            this.saveTimer = setTimeout(persist, 1000);
        }
    }

    handleEdit() {
        this.save();
    }

    // --- ZIP Export Logic ---
    
    exportProjectAsZip() {
        if(this.activeFile && this.files[this.activeFile]) {
            this.files[this.activeFile].content = this.editor.getValue();
        }

        if(!window.JSZip) {
            this.showToast("Export library loading... try again", true);
            return;
        }

        const zip = new JSZip();
        Object.keys(this.files).forEach(filename => {
            zip.file(filename, this.files[filename].content);
        });

        zip.generateAsync({type:"blob"})
        .then(function(content) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = "CodeVault_Project.zip";
            a.click();
            app.showToast("Project Exported!");
        });
    }

    // --- Prettier Formatting Logic ---

    formatCurrentFile() {
        if (!this.activeFile) return;
        
        if (typeof prettier === 'undefined') {
            this.showToast('Formatter loading... wait a moment', true);
            return;
        }

        const content = this.editor.getValue();
        let parser = null;
        let plugins = [];

        if (this.activeFile.endsWith('.html')) {
            parser = 'html';
            plugins = [prettierPlugins.html, prettierPlugins.babel, prettierPlugins.postcss];
        } else if (this.activeFile.endsWith('.css')) {
            parser = 'css';
            plugins = [prettierPlugins.postcss];
        } else if (this.activeFile.endsWith('.js') || this.activeFile.endsWith('.json')) {
            parser = 'babel';
            plugins = [prettierPlugins.babel];
        }

        if (!parser) {
            this.showToast('Language not supported for formatting', true);
            return;
        }

        try {
            const formatted = prettier.format(content, {
                parser: parser,
                plugins: plugins,
                tabWidth: 4,
                printWidth: 80,
                singleQuote: true
            });

            const cursor = this.editor.getCursor();
            this.editor.setValue(formatted);
            this.editor.setCursor(cursor);
            
            this.showToast('Code Formatted');
            this.save(true);
        } catch (e) {
            console.error("Format error:", e);
            this.showToast('Format Failed: Syntax Error', true);
        }
    }

    // --- Library Injection Logic ---

    renderLibraryList() {
        const container = document.getElementById('lib-list-container');
        container.innerHTML = '';
        
        LIBRARIES.forEach(lib => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between bg-gray-900 border border-gray-700 p-2 rounded hover:border-purple-500 transition-colors group cursor-pointer";
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-brands ${lib.icon} w-5 text-center"></i>
                    <span class="text-sm">${lib.name}</span>
                </div>
                <button class="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Add">
                    <i class="fa-solid fa-plus"></i>
                </button>
            `;
            div.onclick = () => this.injectLibrary(lib);
            container.appendChild(div);
        });
    }

    openLibraryModal() {
        if(!this.activeFile || !this.activeFile.endsWith('.html')) {
            this.showToast("Please open an HTML file first", true);
            return;
        }
        this.showModal('modal-library');
    }

    injectCustomLib() {
        const url = document.getElementById('inp-lib-url').value.trim();
        if(!url) return;
        
        const type = url.endsWith('.css') ? 'css' : 'js';
        const name = url.split('/').pop() || 'Custom Lib';
        
        this.injectLibrary({ name, url, type });
        document.getElementById('inp-lib-url').value = '';
    }

    injectLibrary(lib) {
        const content = this.editor.getValue();
        let newContent = content;
        let tag = '';
        
        // Define tags safely
        const closeHead = '<' + '/head>';
        const closeBody = '<' + '/body>';
        
        if(lib.type === 'css') {
            tag = `<link rel="stylesheet" href="${lib.url}">`;
            if(content.includes(closeHead)) {
                newContent = content.replace(closeHead, `  ${tag}\n${closeHead}`);
            } else if(content.includes('<html>')) {
                 newContent = content.replace('<html>', `<html>\n<head>\n  ${tag}\n</head>`);
            } else {
                newContent = tag + '\n' + content;
            }
        } else {
            tag = `<script src="${lib.url}"><` + `/script>`;
            if(content.includes(closeBody)) {
                newContent = content.replace(closeBody, `  ${tag}\n${closeBody}`);
            } else {
                newContent = content + '\n' + tag;
            }
        }

        if(newContent !== content) {
            this.editor.setValue(newContent);
            this.showToast(`Added ${lib.name}`);
            this.closeModals();
            this.save(true);
        } else {
            this.showToast("Could not auto-inject tag", true);
        }
    }

    // --- File Management ---

    defaults() {
        const htmlContent = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <link rel="stylesheet" href="style.css">\n  <title>App</title>\n<' + '/head>\n<body>\n  <div class="box">\n    <h1>CodeVault Pro</h1>\n    <p>Edit files to see live updates.</p>\n    <button onclick="testAlert()">Test Alert</button>\n    <button onclick="testLog()" class="secondary">Test Console</button>\n  </div>\n  <script src="script.js"><' + '/script>\n<' + '/body>\n<' + '/html>';
        
        this.files['index.html'] = { mode: 'htmlmixed', content: htmlContent };
        this.files['style.css'] = { mode: 'css', content: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding-top: 40px; margin: 0; }\n.box { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }\nh1 { color: #1f2937; margin-top: 0; }\np { color: #4b5563; }\nbutton { margin: 5px; padding: 10px 20px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: transform 0.1s; }\nbutton:active { transform: scale(0.95); }\nbutton.secondary { background: #4b5563; }' };
        this.files['script.js'] = { mode: 'javascript', content: 'console.log("System Ready.");\n\nfunction testAlert() {\n  // Intercepted by CodeVault\n  alert("Success! The environment is secure and working.");\n}\n\nfunction testLog() {\n  const obj = { id: 1, status: "Active", data: [10, 20], dom: document.body };\n  console.log("Logging an object:", obj);\n}' };
    }

    open(name) {
        if(!this.files[name]) return;
        this.activeFile = name;
        this.editor.setValue(this.files[name].content);
        this.editor.setOption('mode', this.files[name].mode);
        document.getElementById('current-file-name').innerText = name;
        document.getElementById('current-file-icon').className = `fa-brands ${this.getIcon(name)}`;
        this.renderList();
        document.getElementById('empty-state').classList.add('hidden');
        
        if(this.sidebarOpen && window.innerWidth < 768) {
            this.toggleSidebar();
        }

        if(this.isPreview) this.updatePreview();
    }

    createFile() {
        const name = document.getElementById('inp-filename').value.trim();
        if(!name) return;
        
        if(this.files[name]) {
            this.showToast('File already exists!', true);
            return;
        }

        let mode = 'javascript';
        if(name.endsWith('.html')) mode = 'htmlmixed';
        else if(name.endsWith('.css')) mode = 'css';
        else if(name.endsWith('.json')) mode = 'application/json';
        
        this.files[name] = { content: '', mode };
        this.open(name);
        this.closeModals();
        this.save(true);
    }

    openRenameModal() {
        if(!this.activeFile) return;
        document.getElementById('inp-rename').value = this.activeFile;
        this.showModal('modal-rename');
        setTimeout(() => {
            const el = document.getElementById('inp-rename');
            el.focus();
            el.select();
        }, 50);
    }

    executeRename() {
        const newName = document.getElementById('inp-rename').value.trim();
        const oldName = this.activeFile;

        if(!newName || newName === oldName) {
            this.closeModals();
            return;
        }

        if(this.files[newName]) {
            this.showToast("Filename already exists", true);
            return;
        }

        this.files[newName] = this.files[oldName];
        delete this.files[oldName];
        
        let mode = 'javascript';
        if(newName.endsWith('.html')) mode = 'htmlmixed';
        else if(newName.endsWith('.css')) mode = 'css';
        else if(newName.endsWith('.json')) mode = 'application/json';
        this.files[newName].mode = mode;

        this.activeFile = newName;
        this.open(newName);
        this.closeModals();
        this.save(true);
        this.showToast("File Renamed");
    }

    deleteFile() {
        if(this.activeFile) {
            delete this.files[this.activeFile];
            const remaining = Object.keys(this.files);
            this.activeFile = remaining.length ? remaining[0] : null;
            
            if(this.activeFile) this.open(this.activeFile);
            else {
                this.editor.setValue('');
                document.getElementById('current-file-name').innerText = '...';
                document.getElementById('empty-state').classList.remove('hidden');
            }
            this.save(true);
            this.closeModals();
        }
    }

    // --- Preview Engine ---

    togglePreview() {
        this.isPreview = !this.isPreview;
        const p = document.getElementById('preview-pane');
        const btn = document.getElementById('btn-preview');
        const r = document.getElementById('resizer');
        const e = document.getElementById('editor-pane');
        
        if(this.isPreview) {
            p.classList.remove('hidden');
            p.classList.add('flex');
            
            if(window.innerWidth < 768) {
                e.classList.add('hidden');
                p.style.width = '100%';
                r.classList.add('hidden');
            } else {
                e.classList.remove('hidden');
                r.classList.remove('hidden');
                r.classList.add('md:flex');
                if(!p.style.width || p.style.width === '100%') p.style.width = '50%'; 
            }
            
            btn.classList.replace('bg-purple-600', 'bg-gray-700');
            btn.classList.replace('hover:bg-purple-500', 'hover:bg-gray-600');
            
            this.updatePreview();
        } else {
            p.classList.add('hidden');
            p.classList.remove('flex');
            e.classList.remove('hidden');
            r.classList.add('hidden');
            r.classList.remove('md:flex');
            
            btn.classList.replace('bg-gray-700', 'bg-purple-600');
            btn.classList.replace('hover:bg-gray-600', 'hover:bg-purple-500');
        }
        setTimeout(() => this.editor.refresh(), 300);
    }

    updatePreview() {
        const iframe = document.getElementById('preview-frame');
        const consoleDiv = document.getElementById('console-output');
        consoleDiv.innerHTML = ''; 

        let entry = this.activeFile && this.activeFile.endsWith('.html') ? this.activeFile : 'index.html';
        if(!this.files[entry]) entry = Object.keys(this.files).find(f => f.endsWith('.html'));

        if(!entry) {
            iframe.srcdoc = '<div style="padding:20px;text-align:center;font-family:sans-serif;color:#666">No HTML file found. Create an index.html file to start.</div>';
            return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.files[entry].content, 'text/html');

        doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
            const f = l.getAttribute('href');
            if(this.files[f]) {
                const style = doc.createElement('style');
                style.textContent = this.files[f].content;
                l.replaceWith(style);
            }
        });

        doc.querySelectorAll('script[src]').forEach(s => {
            const f = s.getAttribute('src');
            if(this.files[f]) {
                const script = doc.createElement('script');
                script.textContent = this.files[f].content;
                s.replaceWith(script);
            }
        });

        const runtimeScript = doc.createElement('script');
        runtimeScript.textContent = `
            window.alert = function(msg) {
                const d = document.createElement('div');
                Object.assign(d.style, {
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#1f2937', color: '#f3f4f6', padding: '12px 24px', borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', fontFamily: 'system-ui', zIndex: 99999,
                    fontWeight: '500', fontSize: '14px', border: '1px solid #374151',
                    animation: 'slideDown 0.3s cubic-bezier(0, 0, 0.2, 1)'
                });
                d.innerHTML = '<span style="color:#a78bfa">Alert:</span> ' + msg;
                if(!document.getElementById('cv-anim')) {
                    const s = document.createElement('style');
                    s.id = 'cv-anim';
                    s.textContent = '@keyframes slideDown { from { opacity:0; transform:translate(-50%, -10px); } to { opacity:1; transform:translate(-50%,0); } }';
                    document.head.appendChild(s);
                }
                document.body.appendChild(d);
                setTimeout(() => {
                    d.style.opacity = '0';
                    d.style.transition = 'opacity 0.3s';
                    setTimeout(() => d.remove(), 300);
                }, 3000);
            };

            const sendLog = (type, args) => {
                const msg = args.map(arg => {
                    if (typeof arg === 'object') {
                        try { return JSON.stringify(arg, null, 2); } 
                        catch(e) { return '[Circular Object or Complex Type]'; }
                    }
                    return arg;
                }).join(' ');
                window.parent.postMessage({ type: 'console', logType: type, msg: msg }, '*');
            };
            
            const originalLog = console.log;
            console.log = function(...args) { originalLog.apply(console, args); sendLog('log', args); };
            const originalErr = console.error;
            console.error = function(...args) { originalErr.apply(console, args); sendLog('error', args); };
            
            window.onerror = function(msg, url, line) {
                sendLog('error', [msg + ' (Line ' + line + ')']);
            };
        `;
        doc.body.appendChild(runtimeScript);

        iframe.srcdoc = doc.documentElement.outerHTML;
    }

    // --- UI Helpers ---

    renderList() {
        const el = document.getElementById('file-list');
        el.innerHTML = '';
        Object.keys(this.files).sort().forEach(f => {
            const div = document.createElement('div');
            const isActive = f === this.activeFile;
            div.className = `flex items-center gap-2 p-2 rounded cursor-pointer text-sm mb-1 ${isActive ? 'bg-gray-800 text-white border-l-2 border-purple-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;
            div.innerHTML = `<i class="fa-brands ${this.getIcon(f)} w-4 text-center"></i> ${f}`;
            div.onclick = () => this.open(f);
            el.appendChild(div);
        });
    }

    getIcon(n) {
        if(n.endsWith('.js')) return 'fa-js text-yellow-400';
        if(n.endsWith('.html')) return 'fa-html5 text-orange-500';
        if(n.endsWith('.css')) return 'fa-css3 text-blue-400';
        if(n.endsWith('.json')) return 'fa-npm text-red-500';
        return 'fa-file-code';
    }

    // --- Modals ---

    openNewFileModal() {
        this.showModal('modal-new');
        setTimeout(() => document.getElementById('inp-filename').focus(), 50);
    }
    
    openResetModal() {
        this.showModal('modal-reset');
    }

    executeReset() {
        localStorage.removeItem(STORE_KEY);
        location.reload();
    }

    confirmDeleteFile() {
        if(!this.activeFile) return;
        document.getElementById('del-name').innerText = this.activeFile;
        this.showModal('modal-delete');
    }

    showModal(id) {
        document.getElementById(id).classList.remove('hidden');
        document.getElementById(id).classList.add('flex');
    }

    closeModals() {
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');
        });
        document.getElementById('inp-filename').value = '';
        document.getElementById('inp-lib-url').value = '';
        document.getElementById('inp-rename').value = '';
    }

    showToast(msg, isError = false) {
        const t = document.getElementById('toast');
        const txt = document.getElementById('toast-msg');
        const icon = t.querySelector('i');
        
        txt.innerText = msg;
        if(isError) {
            t.classList.replace('border-green-500', 'border-red-500');
            icon.className = 'fa-solid fa-triangle-exclamation text-red-500';
        } else {
            t.classList.replace('border-red-500', 'border-green-500');
            icon.className = 'fa-solid fa-check-circle text-green-500';
        }

        t.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 2500);
    }
}

const app = new CodeVault();

// Handle Preloader
window.onload = () => {
    setTimeout(() => {
        const loader = document.getElementById('preloader');
        if(loader) {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 500);
        }
    }, 800);
};

// Handle Console Messages from Iframe
window.addEventListener('message', (e) => {
    if(e.data && e.data.type === 'console') {
        const div = document.createElement('div');
        div.textContent = `> ${e.data.msg}`;
        if(e.data.logType === 'error') div.classList.add('text-red-400');
        const consoleOutput = document.getElementById('console-output');
        consoleOutput.appendChild(div);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
});