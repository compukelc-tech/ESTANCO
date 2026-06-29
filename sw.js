:root {
  --bg-base: #0f0f11;
  --bg-card: #18181c;
  --bg-input: #232329;
  --bg-sidebar: #131316;
  --border-color: #33333d;
  --border-subtle: #26262d;
  --text-main: #f5f5f7;
  --text-muted: #9fa0a8;
  --text-light: #6a6b73;
  --clr-primary: #d4af37;
  --clr-primary-light: rgba(212, 175, 55, 0.15);
  --clr-success: #10b981;
  --clr-success-light: rgba(16, 185, 129, 0.15);
  --clr-danger: #e11d48;
  --clr-danger-light: rgba(225, 29, 72, 0.15);
  --clr-warning: #f59e0b;
  --clr-info: #0ea5e9;
  --clr-purple: #8b5cf6;
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.6);
  --shadow-xl: 0 20px 60px rgba(0,0,0,0.9);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --font-brand: 'Syne', sans-serif;
  --font-sans: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --topbar-h: 64px;
  --nav-h: 56px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  color: var(--text-main);
  background: var(--bg-base);
  height: 100vh;
  overflow: hidden;
  overscroll-behavior: none;
  font-size: 14px;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 99px; }

.main-content { flex: 1; display: flex; flex-direction: column; height: 100vh; }

.topbar { height: var(--topbar-h); padding: 0 24px; display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.brand-title { font-family: var(--font-brand); font-weight: 700; color: var(--clr-primary); }

.work-nav { display: none; padding: 0 20px; gap: 6px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); height: var(--nav-h); align-items: center; overflow-x: auto; }
.scrollable-body { flex: 1; overflow-y: auto; padding: 24px; overscroll-behavior-y: contain; }

.btn { padding: 9px 16px; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: var(--transition); }
.btn:hover { transform: translateY(-1px); filter: brightness(1.1); }

.form-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; }
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.form-group input, .form-group select { background: var(--bg-input); border: 1px solid var(--border-color); padding: 10px; color: var(--text-main); border-radius: var(--radius-sm); }

.pos-table { width: 100%; border-collapse: collapse; }
.pos-table th { background: var(--bg-input); padding: 12px; font-size: 11px; text-transform: uppercase; color: var(--clr-primary); }
.pos-table td { padding: 12px; border-bottom: 1px solid var(--border-subtle); }

.sidebar-panel { position: fixed; top: 0; right: -440px; width: 420px; height: 100vh; background: var(--bg-card); border-left: 1px solid var(--border-color); z-index: 1000; transition: right 0.3s ease; will-change: transform; }
.sidebar-panel.active { right: 0; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.modal-content { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-xl); width: 90%; max-width: 500px; padding: 20px; }

@media print {
  .no-print { display: none !important; }
  #area-impresion { display: block !important; position: absolute; left: 0; top: 0; color: black; }
  body { background: white !important; }
}

@media (max-width: 768px) {
  .sidebar-panel { width: 100%; right: -100%; }
  .form-grid { grid-template-columns: 1fr !important; }
}
