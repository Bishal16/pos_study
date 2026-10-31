// Applies the saved light/dark choice before the page paints (shared by Control, Atlas and ERD; no choice = follow the system)
try { var t = localStorage.getItem('unipos-theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
