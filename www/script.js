import { StatusBar } from '@capacitor/status-bar';

document.addEventListener('DOMContentLoaded', () => {
  StatusBar.hide();
});

    const codeEditor = document.getElementById('codeEditor');
    const codeHighlight = document.getElementById('codeHighlight');
    const lineNumbers = document.getElementById('lineNumbers');
    const previewFrame = document.getElementById('previewFrame');
    const runBtn = document.getElementById('runBtn');
    const win = document.getElementById('previewWin');
    const backdrop = document.getElementById('backdrop');
    const titlebar = document.getElementById('winTitlebar');

    // ---- Syntax highlighting ----
    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const master = /(?<comment>&lt;!--[\s\S]*?--&gt;|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(?<string>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(?<tag>&lt;\/?[A-Za-z][\w-]*)|(?<attr>\b[a-zA-Z-][\w-]*(?=\s*=))|(?<number>\b\d+(?:\.\d+)?\b)|(?<keyword>\b(?:function|const|let|var|return|if|else|for|while|new|class|import|export|from|of|in|true|false|null|undefined|typeof|this|DOCTYPE)\b)/g;

    function highlight(code) {
      const escaped = escapeHtml(code);
      return escaped.replace(master, (match, ...rest) => {
        const groups = rest[rest.length - 1];
        for (const name in groups) {
          if (groups[name] !== undefined) return `<span class="${name}">${match}</span>`;
        }
        return match;
      });
    }

    function updateLineNumbers() {
      const lines = codeEditor.value.split('\n').length;
      let html = '';
      for (let i = 1; i <= lines; i++) html += `<div>${i}</div>`;
      lineNumbers.innerHTML = html;
    }

    function render() {
      codeHighlight.innerHTML = highlight(codeEditor.value) + '\n';
      updateLineNumbers();
    }

    function syncScroll() {
      codeHighlight.scrollTop = codeEditor.scrollTop;
      codeHighlight.scrollLeft = codeEditor.scrollLeft;
      lineNumbers.scrollTop = codeEditor.scrollTop;
      if (typeof positionHighlightBox === 'function' && typeof lastNatural !== 'undefined' && lastNatural) {
        positionHighlightBox();
      }
    }

    // ---- Auto-close tag: ketik <body> otomatis jadi <body></body> dengan kursor di tengah ----
    const VOID_TAGS = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];

    function handleAutoCloseTag() {
      const pos = codeEditor.selectionStart;
      const value = codeEditor.value;
      const before = value.slice(0, pos);
      // Cocokkan tag pembuka yang baru saja selesai diketik tepat sebelum kursor, mis. <body> atau <div class="x">
      const m = before.match(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*)?)>$/);
      if (!m) return;
      const tagName = m[1];
      const fullMatch = m[0];
      if (fullMatch.endsWith('/>')) return; // tag self-closing, mis. <br/>
      if (VOID_TAGS.includes(tagName.toLowerCase())) return; // tag tanpa penutup, mis. <br>, <img>
      const after = value.slice(pos);
      if (after.startsWith('</' + tagName + '>')) return; // sudah ada penutupnya, jangan dobel

      const closing = '</' + tagName + '>';
      codeEditor.value = before + closing + after;
      codeEditor.setSelectionRange(pos, pos);
      render();
      if (activeFile) files[activeFile] = codeEditor.value;
    }

    codeEditor.addEventListener('input', (e) => {
      render();
      if (activeFile) files[activeFile] = codeEditor.value;
      if (e.inputType === 'insertText' && e.data === '>') {
        handleAutoCloseTag();
      }
    });
    codeEditor.addEventListener('scroll', syncScroll);

    // Saat Enter ditekan: lanjutkan indentasi baris sebelumnya + tambah 1 spasi.
    // Kalau kursor persis di antara tag pembuka & tag penutup pasangannya (mis. <body>|</body>),
    // pecah jadi 3 baris: baris isi (indent +1 spasi) di tengah, tag penutup di baris bawah.
    codeEditor.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const value = codeEditor.value;
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const existingIndentMatch = currentLine.match(/^[ \t]*/);
      const existingIndent = existingIndentMatch ? existingIndentMatch[0] : '';

      const beforeCursor = value.slice(0, start);
      const afterCursor = value.slice(end);
      const tagMatch = beforeCursor.match(/<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^<>]*)?>$/);
      if (tagMatch && afterCursor.startsWith('</' + tagMatch[1] + '>')) {
        const insertText = '\n' + existingIndent + ' ' + '\n' + existingIndent;
        codeEditor.value = value.slice(0, start) + insertText + value.slice(end);
        const newPos = start + 1 + existingIndent.length + 1;
        codeEditor.setSelectionRange(newPos, newPos);
        render();
        if (activeFile) files[activeFile] = codeEditor.value;
        syncScroll();
        return;
      }

      const insertText = '\n' + existingIndent + ' ';
      codeEditor.value = value.slice(0, start) + insertText + value.slice(end);
      const newPos = start + insertText.length;
      codeEditor.setSelectionRange(newPos, newPos);
      render();
      if (activeFile) files[activeFile] = codeEditor.value;
      syncScroll();
    });
    render();

    // ---- File explorer / sidebar ----
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const sidebarClose = document.getElementById('sidebarClose');
    const fileList = document.getElementById('fileList');
    const newFileBtn = document.getElementById('newFileBtn');

    const files = { 'index.html': codeEditor.value };
    let activeFile = 'index.html';

    const DOC_ICON_PATH = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line>';
    const JS_ICON_PATH = '<path d="M9 4c-2 0-3 1-3 3v2.5c0 1.2-1 2.5-2.2 2.5C5 12 6 13.3 6 14.5V17c0 2 1 3 3 3"></path><path d="M15 4c2 0 3 1 3 3v2.5c0 1.2 1 2.5 2.2 2.5-1.2 0-2.2 1.3-2.2 2.5V17c0 2-1 3-3 3"></path>';
    const EXT_ICONS = {
      html: { color:'#ff6b8b', sw:'2.4', svg:'<polyline points="8 4 2 12 8 20"></polyline><polyline points="16 4 22 12 16 20"></polyline>' },
      css:  { color:'#5ac8fa', sw:'2.4', svg:'<line x1="9" y1="4" x2="7" y2="20"></line><line x1="17" y1="4" x2="15" y2="20"></line><line x1="4" y1="9" x2="20" y2="9"></line><line x1="3" y1="15" x2="19" y2="15"></line>' },
      js:   { color:'#ffcb6b', sw:'2.1', svg: JS_ICON_PATH },
      json: { color:'#c3e88d', sw:'2.1', svg: JS_ICON_PATH },
      md:   { color:'#89ddff', sw:'2.1', svg: DOC_ICON_PATH },
      txt:  { color:'#8b949e', sw:'2.1', svg: DOC_ICON_PATH }
    };
    const DEFAULT_ICON = { color:'#8b949e', sw:'2.1', svg: DOC_ICON_PATH };

    function hexToRgb(hex) {
      const n = parseInt(hex.replace('#',''), 16);
      return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    }

    function extOf(name) {
      const parts = name.split('.');
      return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function renderFileList() {
      fileList.innerHTML = '';
      Object.keys(files).forEach(name => {
        const ext = extOf(name);
        const icon = EXT_ICONS[ext] || DEFAULT_ICON;
        const rgb = hexToRgb(icon.color);

        const item = document.createElement('div');
        item.className = 'file-item' + (name === activeFile ? ' active' : '');

        const iconEl = document.createElement('span');
        iconEl.className = 'file-icon';
        iconEl.style.setProperty('--icon-bg', `rgba(${rgb},0.14)`);
        iconEl.style.setProperty('--icon-border', `rgba(${rgb},0.35)`);
        iconEl.style.setProperty('--icon-color', icon.color);
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${icon.sw}" stroke-linecap="round" stroke-linejoin="round">${icon.svg}</svg>`;

        const nameEl = document.createElement('span');
        nameEl.className = 'file-name';
        nameEl.textContent = name;

        const delBtn = document.createElement('button');
        delBtn.className = 'file-delete-btn';
        delBtn.title = 'Hapus file';
        delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openDeleteModal(name);
        });

        item.appendChild(iconEl);
        item.appendChild(nameEl);
        item.appendChild(delBtn);
        item.addEventListener('click', () => switchFile(name));
        fileList.appendChild(item);
      });
    }

    function switchFile(name) {
      if (activeFile) files[activeFile] = codeEditor.value;
      activeFile = name;
      codeEditor.value = files[name];
      render();
      renderFileList();
    }

    // ---- Hapus file: tombol X + modal peringatan konfirmasi ----
    const deleteModalBackdrop = document.getElementById('deleteModalBackdrop');
    const deleteModalText = document.getElementById('deleteModalText');
    const deleteModalCancel = document.getElementById('deleteModalCancel');
    const deleteModalConfirm = document.getElementById('deleteModalConfirm');
    let fileToDelete = null;

    function openDeleteModal(name) {
      fileToDelete = name;
      deleteModalText.innerHTML = '';
      deleteModalText.append('WARNING!!! Apakah Anda yakin ingin menghapus "');
      const b = document.createElement('b');
      b.textContent = name;
      deleteModalText.appendChild(b);
      deleteModalText.append('"? Jika iya silakan klik OK. File yang sudah dihapus tidak bisa dikembalikan.');
      deleteModalBackdrop.classList.add('open');
    }
    function closeDeleteModal() {
      deleteModalBackdrop.classList.remove('open');
      fileToDelete = null;
    }
    deleteModalCancel.addEventListener('click', closeDeleteModal);
    deleteModalBackdrop.addEventListener('click', (e) => { if (e.target === deleteModalBackdrop) closeDeleteModal(); });

    deleteModalConfirm.addEventListener('click', () => {
      if (!fileToDelete) return;
      const name = fileToDelete;
      delete files[name];

      const remaining = Object.keys(files);
      if (remaining.length === 0) {
        files['index.html'] = '';
        activeFile = 'index.html';
        codeEditor.value = '';
      } else if (activeFile === name) {
        activeFile = remaining[0];
        codeEditor.value = files[activeFile];
      }
      render();
      renderFileList();
      closeDeleteModal();
    });

    function openSidebar() { sidebar.classList.add('open'); sidebarBackdrop.classList.add('open'); }
    function closeSidebar() { sidebar.classList.remove('open'); sidebarBackdrop.classList.remove('open'); }
    hamburgerBtn.addEventListener('click', () => {
      renderFileList();
      openSidebar();
    });
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);

    // ---- Import file: buka file manager perangkat, baca isinya, tambah ke daftar file ----
    const importFileBtn = document.getElementById('importFileBtn');
    const importFileInput = document.getElementById('importFileInput');

    importFileBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', () => {
      const selected = Array.from(importFileInput.files || []);
      if (!selected.length) return;
      let remaining = selected.length;
      let lastName = null;
      selected.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          let name = file.name;
          let counter = 1;
          // Hindari menimpa file yang sudah ada dengan nama sama
          while (Object.prototype.hasOwnProperty.call(files, name)) {
            const dot = file.name.lastIndexOf('.');
            const base = dot > -1 ? file.name.slice(0, dot) : file.name;
            const ext = dot > -1 ? file.name.slice(dot) : '';
            name = `${base} (${counter})${ext}`;
            counter++;
          }
          files[name] = typeof reader.result === 'string' ? reader.result : '';
          lastName = name;
          remaining--;
          if (remaining === 0 && lastName) {
            switchFile(lastName);
          }
        };
        reader.readAsText(file);
      });
      importFileInput.value = ''; // reset supaya file yg sama bisa dipilih lagi nanti
    });

    // ---- Save file: unduh file yang sedang aktif ke perangkat ----
    const saveBtn = document.getElementById('saveBtn');
    function saveActiveFile() {
      if (!activeFile) return;
      files[activeFile] = codeEditor.value;
      const blob = new Blob([codeEditor.value], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    saveBtn.addEventListener('click', saveActiveFile);

    // ---- New File modal ----
    const modalBackdrop = document.getElementById('modalBackdrop');
    const newFileName = document.getElementById('newFileName');
    const typeButtons = document.querySelectorAll('.type-btn');
    const modalCancel = document.getElementById('modalCancel');
    const modalCreate = document.getElementById('modalCreate');
    let selectedExt = 'html';

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedExt = btn.dataset.ext;
      });
    });

    function openModal() {
      newFileName.value = '';
      selectedExt = 'html';
      typeButtons.forEach(b => b.classList.toggle('active', b.dataset.ext === 'html'));
      modalBackdrop.classList.add('open');
      setTimeout(() => newFileName.focus(), 50);
    }
    function closeModal() { modalBackdrop.classList.remove('open'); }

    newFileBtn.addEventListener('click', openModal);
    modalCancel.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

    function createFile() {
      let base = newFileName.value.trim() || 'untitled';
      base = base.replace(/\.(html|css|js)$/i, '');
      const filename = `${base}.${selectedExt}`;
      files[activeFile] = codeEditor.value;
      files[filename] = ''; // mulai kosong, tanpa boilerplate
      activeFile = filename;
      codeEditor.value = '';
      render();
      renderFileList();
      closeModal();
    }
    modalCreate.addEventListener('click', createFile);
    newFileName.addEventListener('keydown', (e) => { if (e.key === 'Enter') createFile(); });

    // ---- Find / search: lompat & tandai di editor asli, tanpa memberi fokus (anti kehapus) ----
    const searchBtn = document.getElementById('searchBtn');
    const findWidget = document.getElementById('findWidget');
    const findInput = document.getElementById('findInput');
    const findCount = document.getElementById('findCount');
    const findPrev = document.getElementById('findPrev');
    const findNext = document.getElementById('findNext');
    const findClose = document.getElementById('findClose');
    const matchHighlight = document.getElementById('matchHighlight');
    const mirrorOuter = document.getElementById('mirrorOuter');
    const mirrorInner = document.getElementById('mirrorInner');

    let matches = [];
    let matchIndex = -1;
    let lastNatural = null; // { top, left, width, height } posisi alami (scrollTop=0) dari match aktif

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function escapeHtmlText(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function findMatches(term) {
      matches = [];
      if (!term) return;
      const re = new RegExp(escapeRegex(term), 'gi');
      const text = codeEditor.value;
      let m;
      while ((m = re.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }

    function updateNavState() {
      const has = matches.length > 0;
      findPrev.disabled = !has;
      findNext.disabled = !has;
      findCount.textContent = has ? `${matchIndex + 1}/${matches.length}` : '0/0';
    }

    // Ukur posisi match memakai div cermin (mirror), lalu scroll + tandai di editor asli
    function revealMatchInEditor() {
      if (matchIndex < 0 || !matches.length) {
        matchHighlight.style.display = 'none';
        lastNatural = null;
        return;
      }
      const { start, end } = matches[matchIndex];
      const text = codeEditor.value;
      const before = escapeHtmlText(text.slice(0, start));
      const matchText = escapeHtmlText(text.slice(start, end));

      // Samakan lebar area cermin dengan lebar konten textarea yang sebenarnya
      // (clientWidth textarea tidak termasuk scrollbar, beda dgn width:100% biasa)
      mirrorOuter.style.width = codeEditor.clientWidth + 'px';

      mirrorInner.style.transform = 'translateY(0)';
      mirrorInner.innerHTML = before + '<span id="mirrorMarker">' + matchText + '</span>';

      const markerEl = document.getElementById('mirrorMarker');
      const markerRect = markerEl.getBoundingClientRect();
      const outerRect = mirrorOuter.getBoundingClientRect();
      lastNatural = {
        top: markerRect.top - outerRect.top,
        left: markerRect.left - outerRect.left,
        width: markerRect.width,
        height: markerRect.height
      };

      // scroll editor supaya match terlihat di tengah area
      const targetScroll = Math.max(0, lastNatural.top - codeEditor.clientHeight / 2);
      codeEditor.scrollTop = targetScroll;
      syncScroll();
      positionHighlightBox();
    }

    function positionHighlightBox() {
      if (!lastNatural) { matchHighlight.style.display = 'none'; return; }
      matchHighlight.style.display = 'block';
      matchHighlight.style.top = (lastNatural.top - codeEditor.scrollTop) + 'px';
      matchHighlight.style.left = (lastNatural.left - codeEditor.scrollLeft) + 'px';
      matchHighlight.style.width = lastNatural.width + 'px';
      matchHighlight.style.height = lastNatural.height + 'px';
    }

    function goToMatch(index) {
      if (!matches.length) { updateNavState(); return; }
      matchIndex = (index + matches.length) % matches.length;
      updateNavState();
      revealMatchInEditor();
    }

    function openFind() {
      findWidget.classList.add('open');
      findInput.focus();
      findInput.select();
    }
    function closeFind() {
      findWidget.classList.remove('open');
      matches = [];
      matchIndex = -1;
      matchHighlight.style.display = 'none';
      lastNatural = null;
    }

    searchBtn.addEventListener('click', () => {
      if (findWidget.classList.contains('open')) { closeFind(); } else { openFind(); }
    });
    findClose.addEventListener('click', closeFind);

    findInput.addEventListener('input', () => {
      findMatches(findInput.value);
      matchIndex = -1;
      updateNavState();
      matchHighlight.style.display = 'none';
      lastNatural = null;
    });
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) goToMatch(matchIndex - 1); else goToMatch(matchIndex + 1);
      } else if (e.key === 'Escape') {
        closeFind();
      }
    });
    findPrev.addEventListener('click', () => goToMatch(matchIndex - 1));
    findNext.addEventListener('click', () => goToMatch(matchIndex + 1));
    updateNavState();

    // Klik/sentuh langsung ke area kode = mulai edit; highlight pencarian disembunyikan
    codeEditor.addEventListener('mousedown', () => {
      matchHighlight.style.display = 'none';
    });
    codeEditor.addEventListener('touchstart', () => {
      matchHighlight.style.display = 'none';
    }, { passive: true });
    updateNavState();

    // ---- Run: open floating preview window ----
    function openWindow() {
      previewFrame.srcdoc = codeEditor.value;
      win.classList.add('open');
      backdrop.classList.add('open');
    }
    function closeWindow() {
      win.classList.remove('open');
      win.classList.remove('maximized');
      backdrop.classList.remove('open');
    }
    runBtn.addEventListener('click', openWindow);
    document.getElementById('winRefresh').addEventListener('click', () => {
      previewFrame.srcdoc = codeEditor.value;
    });
    backdrop.addEventListener('click', closeWindow);
    document.getElementById('winClose').addEventListener('click', closeWindow);
    document.getElementById('winMin').addEventListener('click', closeWindow);
    document.getElementById('winMax').addEventListener('click', (e) => {
      win.classList.toggle('maximized');
      e.stopPropagation();
    });

    // ---- Drag window ----
    let dragging = false, dragOffX = 0, dragOffY = 0;
    titlebar.addEventListener('mousedown', (e) => {
      if (win.classList.contains('maximized')) return;
      if (e.target.classList.contains('win-dot')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const deskRect = win.parentElement.getBoundingClientRect();
      let x = e.clientX - deskRect.left - dragOffX;
      let y = e.clientY - deskRect.top - dragOffY;
      x = Math.max(0, Math.min(x, deskRect.width - win.offsetWidth));
      y = Math.max(0, Math.min(y, deskRect.height - win.offsetHeight));
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    });
    document.addEventListener('mouseup', () => dragging = false);

    // ---- Resize window (all edges/corners) ----
    const MIN_W = 260, MIN_H = 160;
    let resizing = false, resizeDir = '';
    let startW = 0, startH = 0, startX = 0, startY = 0, startLeft = 0, startTop = 0;

    document.querySelectorAll('.rz').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (win.classList.contains('maximized')) return;
        resizing = true;
        resizeDir = handle.dataset.dir;
        const rect = win.getBoundingClientRect();
        const deskRect = win.parentElement.getBoundingClientRect();
        startW = win.offsetWidth;
        startH = win.offsetHeight;
        startLeft = rect.left - deskRect.left;
        startTop = rect.top - deskRect.top;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const deskRect = win.parentElement.getBoundingClientRect();
      let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;
      if (resizeDir.includes('e')) newW = Math.max(MIN_W, startW + dx);
      if (resizeDir.includes('s')) newH = Math.max(MIN_H, startH + dy);
      if (resizeDir.includes('w')) { newW = Math.max(MIN_W, startW - dx); newLeft = startLeft + (startW - newW); }
      if (resizeDir.includes('n')) { newH = Math.max(MIN_H, startH - dy); newTop = startTop + (startH - newH); }
      newLeft = Math.max(0, newLeft);
      newTop = Math.max(0, newTop);
      newW = Math.min(newW, deskRect.width - newLeft);
      newH = Math.min(newH, deskRect.height - newTop);
      win.style.width = newW + 'px';
      win.style.height = newH + 'px';
      win.style.left = newLeft + 'px';
      win.style.top = newTop + 'px';
    });
    document.addEventListener('mouseup', () => { resizing = false; resizeDir = ''; });

    // ---- Touch support ----
    function pos(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }

    titlebar.addEventListener('touchstart', (e) => {
      if (win.classList.contains('maximized')) return;
      if (e.target.classList.contains('win-dot')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      const p = pos(e);
      dragOffX = p.x - rect.left;
      dragOffY = p.y - rect.top;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (dragging) {
        const deskRect = win.parentElement.getBoundingClientRect();
        const p = pos(e);
        let x = p.x - deskRect.left - dragOffX;
        let y = p.y - deskRect.top - dragOffY;
        x = Math.max(0, Math.min(x, deskRect.width - win.offsetWidth));
        y = Math.max(0, Math.min(y, deskRect.height - win.offsetHeight));
        win.style.left = x + 'px';
        win.style.top = y + 'px';
      }
      if (resizing) {
        const p = pos(e);
        const dx = p.x - startX;
        const dy = p.y - startY;
        const deskRect = win.parentElement.getBoundingClientRect();
        let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;
        if (resizeDir.includes('e')) newW = Math.max(MIN_W, startW + dx);
        if (resizeDir.includes('s')) newH = Math.max(MIN_H, startH + dy);
        if (resizeDir.includes('w')) { newW = Math.max(MIN_W, startW - dx); newLeft = startLeft + (startW - newW); }
        if (resizeDir.includes('n')) { newH = Math.max(MIN_H, startH - dy); newTop = startTop + (startH - newH); }
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        newW = Math.min(newW, deskRect.width - newLeft);
        newH = Math.min(newH, deskRect.height - newTop);
        win.style.width = newW + 'px';
        win.style.height = newH + 'px';
        win.style.left = newLeft + 'px';
        win.style.top = newTop + 'px';
      }
    }, { passive: true });

    document.addEventListener('touchend', () => { dragging = false; resizing = false; resizeDir = ''; });

    document.querySelectorAll('.rz').forEach(handle => {
      handle.addEventListener('touchstart', (e) => {
        if (win.classList.contains('maximized')) return;
        resizing = true;
        resizeDir = handle.dataset.dir;
        const rect = win.getBoundingClientRect();
        const deskRect = win.parentElement.getBoundingClientRect();
        const p = pos(e);
        startW = win.offsetWidth;
        startH = win.offsetHeight;
        startLeft = rect.left - deskRect.left;
        startTop = rect.top - deskRect.top;
        startX = p.x;
        startY = p.y;
      }, { passive: true });
    });

    // ---- Loading screen: animasi persentase asli + ring progress futuristik ----
    (function () {
      const loadingScreen = document.getElementById('loadingScreen');
      if (!loadingScreen) return;
      const ring = document.getElementById('loadingRingProgress');
      const barFill = document.getElementById('loadingBarFill');
      const percentEl = document.getElementById('loadingPercent');
      const statusEl = document.getElementById('loadingStatusText');
      const CIRC = 326.7; // 2 * PI * r(52)
      const DURATION = 7000; // total durasi loading (ms)

      const STATUSES = [
        [0, 'INITIALIZING'],
        [30, 'LOADING ASSETS'],
        [65, 'COMPILING EDITOR'],
        [90, 'ALMOST READY']
      ];

      function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

      let start = null;
      function tick(ts) {
        if (!start) start = ts;
        const elapsed = ts - start;
        const rawT = Math.min(elapsed / DURATION, 1);
        const pct = Math.round(easeOutCubic(rawT) * 100);

        ring.style.strokeDashoffset = CIRC - (CIRC * pct / 100);
        barFill.style.width = pct + '%';
        percentEl.textContent = pct + '%';

        let label = STATUSES[0][1];
        for (const [threshold, text] of STATUSES) {
          if (pct >= threshold) label = text;
        }
        statusEl.textContent = label;

        if (rawT < 1) {
          requestAnimationFrame(tick);
        } else {
          statusEl.textContent = 'READY';
        }
      }
      requestAnimationFrame(tick);

      const minDelay = new Promise(resolve => setTimeout(resolve, DURATION));
      const pageReady = new Promise(resolve => {
        if (document.readyState === 'complete') resolve();
        else window.addEventListener('load', resolve, { once: true });
      });
      Promise.all([minDelay, pageReady]).then(() => {
        loadingScreen.classList.add('hide');
        setTimeout(() => loadingScreen.remove(), 600);
      });
    })();

