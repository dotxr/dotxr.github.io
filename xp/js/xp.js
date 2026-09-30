/* Windows XP desktop — window manager, login, apps */
(function () {
	'use strict';

	var $ = function (s, r) { return (r || document).querySelector(s); };
	var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

	var TASKBAR_H = 34;
	var LINKS = {
		github: 'https://github.com/dotav',
		discord: 'https://discord.gg/RyQWCxqrx6'
	};

	/* ------------------------------------------------------------------ sounds */
	var sounds = {};
	['startup', 'shutdown', 'logoff', 'error', 'ding', 'critical'].forEach(function (n) {
		sounds[n] = new Audio('xp/audio/' + n + '.wav');
		sounds[n].preload = 'auto';
	});
	function sfx(name) {
		var a = sounds[name];
		if (!a) return;
		try { a.currentTime = 0; a.play().catch(function () {}); } catch (e) {}
	}

	/* ------------------------------------------------------------ window manager */
	var zTop = 100;
	var cascade = 0;

	function win(id) { return document.getElementById('win-' + id); }

	function setupWindow(w) {
		var id = w.id.replace('win-', '');
		w.dataset.id = id;
		if (!w.classList.contains('skinless')) {
			var body = document.createElement('div');
			body.className = 'wbody';
			while (w.firstChild) body.appendChild(w.firstChild);
			var bar = document.createElement('div');
			bar.className = 'titlebar';
			bar.innerHTML =
				(w.dataset.icon ? '<img src="' + w.dataset.icon + '" alt="">' : '') +
				'<span></span><div class="wctl">' +
				(w.hasAttribute('data-nomin') ? '' : '<button type="button" class="min" title="Minimize"></button>') +
				(w.hasAttribute('data-nomax') ? '' : '<button type="button" class="max" title="Maximize"></button>') +
				'<button type="button" class="close" title="Close"></button></div>';
			$('span', bar).textContent = w.dataset.title;
			w.appendChild(bar);
			w.appendChild(body);
			makeDraggable(w, bar);
			bar.addEventListener('dblclick', function (e) {
				if (e.target.closest('.wctl') || w.hasAttribute('data-nomax')) return;
				toggleMax(id);
			});
			var min = $('.min', bar), max = $('.max', bar);
			if (min) min.addEventListener('click', function () { minimize(id); });
			if (max) max.addEventListener('click', function () { toggleMax(id); });
			$('.close', bar).addEventListener('click', function () { close(id); });
		} else {
			$$('.wa-drag', w).forEach(function (d) { makeDraggable(w, d); });
			$('.wa-min', w).addEventListener('click', function () { minimize(id); });
			$('.wa-close', w).addEventListener('click', function () { close(id); });
		}
		$$('[data-close]', w).forEach(function (b) { b.addEventListener('click', function () { close(id); }); });
		w.addEventListener('pointerdown', function () { focus(id); });
		// remember intended size from inline style
		w.dataset.w = parseInt(w.style.width, 10) || 0;
		w.dataset.h = parseInt(w.style.height, 10) || 0;
	}

	function setTitle(id, title) {
		var w = win(id);
		w.dataset.title = title;
		var s = $('.titlebar span', w);
		if (s) s.textContent = title;
		var t = task(id);
		if (t) $('span', t).textContent = title;
	}

	function task(id) { return $('#tasks li[data-id="' + id + '"]'); }

	function place(w) {
		var vw = window.innerWidth, vh = window.innerHeight - TASKBAR_H;
		var ww = +w.dataset.w, wh = +w.dataset.h;
		if (ww) w.style.width = Math.min(ww, vw - 8) + 'px';
		if (wh) w.style.height = Math.min(wh, vh - 8) + 'px';
		var r = w.getBoundingClientRect();
		var left, top;
		if (w.dataset.pos === 'right') {
			left = vw - r.width - 20;
			top = 20;
		} else if (w.dataset.pos === 'center') {
			left = (vw - r.width) / 2;
			top = Math.max(8, (vh - r.height) / 2 - 20);
		} else {
			left = 110 + (cascade % 6) * 28;
			top = 30 + (cascade % 6) * 28;
			cascade++;
		}
		left = Math.max(0, Math.min(left, vw - r.width));
		top = Math.max(0, Math.min(top, vh - r.height));
		w.style.left = Math.round(left) + 'px';
		w.style.top = Math.round(top) + 'px';
		w.dataset.placed = '1';
	}

	function open(id) {
		var w = win(id);
		if (!w) return;
		var wasClosed = w.classList.contains('closed');
		w.classList.remove('closed', 'minimized');
		if (wasClosed || !w.dataset.placed) place(w);
		if (!task(id) && !w.classList.contains('dialog')) addTask(w);
		focus(id);
		if (wasClosed && apps[id] && apps[id].onOpen) apps[id].onOpen();
	}

	function close(id) {
		var w = win(id);
		if (!w) return;
		w.classList.add('closed');
		w.classList.remove('active', 'maximized');
		var t = task(id);
		if (t) t.remove();
		if (apps[id] && apps[id].onClose) apps[id].onClose();
		focusTopmost();
	}

	function minimize(id) {
		var w = win(id);
		w.classList.add('minimized');
		w.classList.remove('active');
		var t = task(id);
		if (t) t.classList.remove('active');
		if (id === 'tetris') Tetris.pause();
		focusTopmost();
	}

	function toggleMax(id) {
		win(id).classList.toggle('maximized');
	}

	function focus(id) {
		var w = win(id);
		if (!w || w.classList.contains('closed') || w.classList.contains('minimized')) return;
		$$('.window.active').forEach(function (o) { if (o !== w) o.classList.remove('active'); });
		$$('#tasks li').forEach(function (t) { t.classList.toggle('active', t.dataset.id === id); });
		if (!w.classList.contains('active') || +w.style.zIndex < zTop) w.style.zIndex = ++zTop;
		w.classList.add('active');
		if (id !== 'tetris') Tetris.pause();
	}

	function focusTopmost() {
		var best = null;
		$$('.window').forEach(function (w) {
			if (w.classList.contains('closed') || w.classList.contains('minimized')) return;
			if (!best || +w.style.zIndex > +best.style.zIndex) best = w;
		});
		$$('.window.active').forEach(function (w) { w.classList.remove('active'); });
		$$('#tasks li').forEach(function (t) { t.classList.remove('active'); });
		if (best) focus(best.dataset.id);
	}

	function addTask(w) {
		var id = w.dataset.id;
		var li = document.createElement('li');
		li.dataset.id = id;
		li.innerHTML = '<img src="' + (w.dataset.taskIcon || w.dataset.icon) + '" alt=""><span></span>';
		$('span', li).textContent = w.dataset.title;
		li.title = w.dataset.title;
		li.addEventListener('click', function () {
			if (w.classList.contains('minimized')) { w.classList.remove('minimized'); focus(id); }
			else if (w.classList.contains('active')) minimize(id);
			else focus(id);
		});
		$('#tasks').appendChild(li);
	}

	function makeDraggable(w, handle) {
		handle.addEventListener('pointerdown', function (e) {
			if (e.button !== 0 || e.target.closest('button') || w.classList.contains('maximized')) return;
			e.preventDefault();
			var sx = e.clientX, sy = e.clientY, ox = w.offsetLeft, oy = w.offsetTop;
			handle.setPointerCapture(e.pointerId);
			function mv(ev) {
				var vw = window.innerWidth, vh = window.innerHeight - TASKBAR_H;
				var x = ox + ev.clientX - sx, y = oy + ev.clientY - sy;
				x = Math.max(60 - w.offsetWidth, Math.min(x, vw - 60));
				y = Math.max(0, Math.min(y, vh - 30));
				w.style.left = x + 'px';
				w.style.top = y + 'px';
			}
			function up() {
				handle.removeEventListener('pointermove', mv);
				handle.removeEventListener('pointerup', up);
				handle.removeEventListener('pointercancel', up);
			}
			handle.addEventListener('pointermove', mv);
			handle.addEventListener('pointerup', up);
			handle.addEventListener('pointercancel', up);
		});
	}

	/* ---------------------------------------------------------- message boxes */
	var msgCount = 0;
	function msgBox(title, text, kind) {
		var id = 'msg' + (++msgCount);
		var w = document.createElement('div');
		w.className = 'window dialog msgbox closed';
		w.id = 'win-' + id;
		w.dataset.title = title;
		w.dataset.pos = 'center';
		w.setAttribute('data-nomax', '');
		w.setAttribute('data-nomin', '');
		w.innerHTML = '<div class="msg"><i class="' + (kind === 'info' ? 'ico-info' : 'ico-err') + '">' + (kind === 'info' ? 'i' : '') + '</i><p></p></div>' +
			'<div class="btns"><button type="button" class="xpbtn" data-close>OK</button></div>';
		$('p', w).textContent = text;
		$('#desktop').appendChild(w);
		setupWindow(w);
		var origClose = apps[id] = { onClose: function () { setTimeout(function () { w.remove(); delete apps[id]; }, 0); } };
		open(id);
		$('.xpbtn', w).focus();
		sfx(kind === 'info' ? 'ding' : 'error');
		return origClose;
	}

	/* ---------------------------------------------------------------- explorer */
	var I = 'xp/img/';
	var denied = function (path) {
		return function () { msgBox(path.split('\\').pop() || path, path + ' is not accessible.\n\nAccess is denied.'); };
	};
	var FS = {
		computer: {
			title: 'My Computer', icon: I + 'startmenu/mycomp.png', addr: 'My Computer',
			items: [
				{ name: 'My Documents', icon: I + 'my_documents.png', go: 'documents' },
				{ name: 'Local Disk (C:)', icon: I + 'programs.png', go: 'c' },
				{ name: 'My Music', icon: I + 'startmenu/mymusic.png', open: 'winamp' },
				{ name: 'Control Panel', icon: I + 'startmenu/controlpanel.png', open: 'controlpanel' },
				{ name: 'Printers and Faxes', icon: I + 'startmenu/printers.png', open: 'printers' }
			]
		},
		c: {
			title: 'Local Disk (C:)', icon: I + 'startmenu/mycomp.png', addr: 'C:\\', up: 'computer',
			items: [
				{ name: 'Documents and Settings', icon: I + 'programs.png', go: 'dands' },
				{ name: 'Program Files', icon: I + 'programs.png', fn: denied('C:\\Program Files') },
				{ name: 'WINDOWS', icon: I + 'programs.png', fn: denied('C:\\WINDOWS') }
			]
		},
		dands: {
			title: 'Documents and Settings', icon: I + 'startmenu/mycomp.png', addr: 'C:\\Documents and Settings', up: 'c',
			items: [
				{ name: '.av', icon: I + 'programs.png', go: 'documents' },
				{ name: 'All Users', icon: I + 'programs.png', fn: denied('C:\\Documents and Settings\\All Users') }
			]
		},
		documents: {
			title: 'My Documents', icon: I + 'startmenu/myrecent.png', addr: 'C:\\Documents and Settings\\.av\\My Documents', up: 'dands',
			items: [
				{ name: 'about_me.txt', icon: I + 'startmenu/textdoc.png', open: 'bio' },
				{ name: 'GitHub', icon: I + 'startmenu/mywebsite.png', url: LINKS.github },
				{ name: 'Discord', icon: I + 'startmenu/msn16.png', url: LINKS.discord },
				{ name: 'Minion Rush Revival', icon: I + 'startmenu/mywebsite.png', ie: '/minion-rush-revival/' },
				{ name: 'My Music', icon: I + 'startmenu/mymusic.png', open: 'winamp' }
			]
		},
		recycle: {
			title: 'Recycle Bin', icon: I + 'recycle_bin.png', addr: 'Recycle Bin',
			items: [
				{ name: 'totally_not_a_virus.exe', icon: I + 'startmenu/run.png', open: 'bsod' }
			]
		}
	};
	var ex = { cur: null, back: [], fwd: [] };

	function exTasks(key) {
		var place = FS[key];
		var html = '';
		if (key === 'recycle') {
			html += '<section><h3>Recycle Bin Tasks</h3><ul><li><a data-ex-act="empty"><img src="' + I + 'recycle_bin.png" alt="">Empty the Recycle Bin</a></li></ul></section>';
		} else {
			html += '<section><h3>System Tasks</h3><ul>' +
				'<li><a data-open="bio"><img src="' + I + 'startmenu/helpsupport.png" alt="">View system information</a></li>' +
				'<li><a data-open="controlpanel"><img src="' + I + 'startmenu/controlpanel.png" alt="">Change a setting</a></li></ul></section>';
		}
		var others = ['computer', 'documents', 'recycle'].filter(function (k) { return k !== key; });
		html += '<section><h3>Other Places</h3><ul>' + others.map(function (k) {
			return '<li><a data-ex-go="' + k + '"><img src="' + FS[k].icon + '" alt="">' + FS[k].title + '</a></li>';
		}).join('') + '<li><a data-open="bio"><img src="' + I + 'startmenu/textdoc.png" alt="">About Me</a></li></ul></section>';
		html += '<section><h3>Details</h3><div class="details"><b>' + place.title + '</b>' +
			(place.items.length ? place.items.length + ' object' + (place.items.length === 1 ? '' : 's') : 'This folder is empty.') + '</div></section>';
		return html;
	}

	function exGo(key, fromHistory) {
		if (!FS[key]) return;
		if (!fromHistory && ex.cur && ex.cur !== key) { ex.back.push(ex.cur); ex.fwd = []; }
		ex.cur = key;
		var place = FS[key];
		setTitle('explorer', place.title);
		$('#win-explorer .titlebar img').src = place.icon;
		var t = task('explorer');
		if (t) $('img', t).src = place.icon;
		$('#exAddr').value = place.addr;
		$('#exTasks').innerHTML = exTasks(key);
		var files = $('#exFiles');
		files.innerHTML = '';
		if (!place.items.length) files.innerHTML = '<p class="empty">This folder is empty.</p>';
		place.items.forEach(function (it) {
			var d = document.createElement('div');
			d.className = 'item';
			d.innerHTML = '<img src="' + it.icon + '" alt=""><span></span>';
			$('span', d).textContent = it.name;
			d._item = it;
			files.appendChild(d);
		});
	}

	function exActivate(it) {
		if (it.go) exGo(it.go);
		else if (it.open) run(it.open);
		else if (it.url) window.open(it.url, '_blank', 'noopener');
		else if (it.ie) { run('ie'); ieGo(it.ie); }
		else if (it.fn) it.fn();
	}

	function setupExplorer() {
		var files = $('#exFiles');
		files.addEventListener('click', function (e) {
			var d = e.target.closest('.item');
			$$('.item', files).forEach(function (x) { x.classList.toggle('selected', x === d); });
		});
		bindOpen(files, '.item', function (d) { exActivate(d._item); });
		$('#win-explorer').addEventListener('click', function (e) {
			var g = e.target.closest('[data-ex-go]');
			if (g) exGo(g.dataset.exGo);
			var a = e.target.closest('[data-ex-act="empty"]');
			if (a) {
				if (FS.recycle.items.length) { FS.recycle.items = []; exGo('recycle', true); }
			}
			var b = e.target.closest('[data-ex]');
			if (!b) return;
			if (b.dataset.ex === 'back' && ex.back.length) { ex.fwd.push(ex.cur); exGo(ex.back.pop(), true); }
			if (b.dataset.ex === 'fwd' && ex.fwd.length) { ex.back.push(ex.cur); exGo(ex.fwd.pop(), true); }
			if (b.dataset.ex === 'up' && FS[ex.cur].up) exGo(FS[ex.cur].up);
		});
	}

	/* ---------------------------------------------------------- Internet Explorer */
	var ie = { hist: [], idx: -1 };

	function ieHome() {
		return '<div class="ie-home">' +
			'<img src="xp/img/avatar-96.jpg" alt="">' +
			'<h1>.av</h1>' +
			'<p>Avery · she/her · Reverse engineer since 2024 · Game preservationist</p>' +
			'<form id="ieSearch"><input type="text" placeholder="Search the web" aria-label="Search the web"><button class="xpbtn" type="submit">Search</button></form>' +
			'<ul>' +
			'<li><a href="' + LINKS.github + '" target="_blank" rel="noopener">GitHub</a></li>' +
			'<li><a href="' + LINKS.discord + '" target="_blank" rel="noopener">Discord</a></li>' +
			'<li><a data-ie-go="/minion-rush-revival/">Minion Rush Revival</a></li>' +
			'</ul></div>';
	}

	function ieRender(url) {
		var view = $('#ieView');
		$('#ieAddr').value = url;
		if (url === 'about:home') {
			view.innerHTML = ieHome();
			$('#ieSearch').addEventListener('submit', function (e) {
				e.preventDefault();
				var q = $('#ieSearch input').value.trim();
				if (q) window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
			});
			return;
		}
		view.innerHTML = '<iframe title="page" referrerpolicy="no-referrer"></iframe>';
		$('iframe', view).src = url;
		if (!/^\//.test(url) && url.indexOf(location.origin) !== 0) {
			var note = document.createElement('div');
			note.className = 'ie-note';
			note.innerHTML = 'Page not showing? Some sites refuse to load inside other pages. <a target="_blank" rel="noopener">Open it in a new tab</a>';
			$('a', note).href = url;
			view.appendChild(note);
		}
	}

	function ieGo(input) {
		var url = String(input || '').trim();
		if (!url || url === 'about:home' || url === 'home') url = 'about:home';
		else if (url[0] === '/') { /* same-site path */ }
		else if (/^https?:\/\//i.test(url)) { /* full url */ }
		else if (/^[^\s]+\.[^\s]+$/.test(url)) url = 'https://' + url;
		else { window.open('https://www.google.com/search?q=' + encodeURIComponent(url), '_blank', 'noopener'); return; }
		ie.hist = ie.hist.slice(0, ie.idx + 1);
		ie.hist.push(url);
		ie.idx = ie.hist.length - 1;
		ieRender(url);
	}

	function setupIE() {
		$('#ieForm').addEventListener('submit', function (e) { e.preventDefault(); ieGo($('#ieAddr').value); });
		$('#win-ie').addEventListener('click', function (e) {
			var g = e.target.closest('[data-ie-go]');
			if (g) ieGo(g.dataset.ieGo);
			var b = e.target.closest('[data-ie]');
			if (!b) return;
			var a = b.dataset.ie;
			if (a === 'home') ieGo('about:home');
			if (a === 'back' && ie.idx > 0) ieRender(ie.hist[--ie.idx]);
			if (a === 'fwd' && ie.idx < ie.hist.length - 1) ieRender(ie.hist[++ie.idx]);
			if (a === 'refresh' && ie.idx >= 0) ieRender(ie.hist[ie.idx]);
		});
		ieGo('about:home');
	}

	/* ------------------------------------------------------------------ Winamp */
	var music = new Audio('xp/audio/Marching.m4a');
	music.preload = 'auto';
	music.loop = true;

	function fmt(t) {
		t = Math.floor(t || 0);
		return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
	}

	function waUpdate() {
		var d = music.duration || 0;
		$('#waTime').textContent = fmt(music.currentTime);
		$('#waThumb').style.left = (d ? Math.round(music.currentTime / d * 218) : 0) + 'px';
	}

	function waState() {
		$('#win-winamp').classList.toggle('playing', !music.paused);
	}

	function play() { music.play().catch(function () {}); }
	function stop() { music.pause(); music.currentTime = 0; waUpdate(); }

	function setupWinamp() {
		music.addEventListener('timeupdate', waUpdate);
		music.addEventListener('play', waState);
		music.addEventListener('pause', waState);
		music.addEventListener('loadedmetadata', function () { $('#waLen').textContent = fmt(music.duration); });
		$$('[data-wa]').forEach(function (b) {
			b.addEventListener('click', function () {
				var a = b.dataset.wa;
				if (a === 'play') play();
				if (a === 'pause') { if (music.paused) play(); else music.pause(); }
				if (a === 'stop') stop();
				if (a === 'prev' || a === 'next') { music.currentTime = 0; waUpdate(); }
			});
		});
		$('#waItem').addEventListener('dblclick', function () { music.currentTime = 0; play(); });
		var seek = $('#waSeek');
		function seekTo(e) {
			var r = seek.getBoundingClientRect();
			var p = Math.max(0, Math.min(1, (e.clientX - r.left - 14) / 218));
			if (music.duration) music.currentTime = p * music.duration;
			waUpdate();
		}
		seek.addEventListener('pointerdown', function (e) {
			seek.setPointerCapture(e.pointerId);
			seekTo(e);
			seek.onpointermove = seekTo;
		});
		seek.addEventListener('pointerup', function () { seek.onpointermove = null; });
	}

	/* ---------------------------------------------------------- command prompt */
	var cmdHist = [], cmdHistIdx = 0;

	function cmdPrint(text, html) {
		var d = document.createElement('div');
		if (html) d.innerHTML = text; else d.textContent = text;
		$('#cmdOut').appendChild(d);
	}

	function cmdBanner() {
		$('#cmdOut').innerHTML = '';
		cmdPrint('Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\nType HELP for a list of commands.\n ');
	}

	var CMDS = {
		help: function () {
			cmdPrint(
				'ABOUT       Who is .av\n' +
				'GITHUB      Opens GitHub\n' +
				'DISCORD     Opens the Discord server\n' +
				'DIR         Lists files\n' +
				'CLS         Clears the screen\n' +
				'ECHO        Displays a message\n' +
				'COLOR       Changes colors (e.g. COLOR 0A)\n' +
				'DATE, TIME  Shows the date/time\n' +
				'VER         Windows version\n' +
				'WINAMP      Plays music\n' +
				'WINMINE     Minesweeper\n' +
				'TETRIS      Tetris\n' +
				'IEXPLORE    Internet Explorer\n' +
				'SHUTDOWN    Turns off the computer\n' +
				'EXIT        Closes this window\n ');
		},
		about: function () {
			cmdPrint('Avery (.av) — she/her\nReverse engineer since 2024\nGame preservationist\n\nGitHub:  ' + LINKS.github + '\nDiscord: ' + LINKS.discord + '\n ');
		},
		whoami: function () { cmdPrint('xp\\.av\n '); },
		github: function () { window.open(LINKS.github, '_blank', 'noopener'); cmdPrint('Opening ' + LINKS.github + '\n '); },
		discord: function () { window.open(LINKS.discord, '_blank', 'noopener'); cmdPrint('Opening ' + LINKS.discord + '\n '); },
		cls: function () { $('#cmdOut').innerHTML = ''; },
		dir: function () {
			cmdPrint(' Volume in drive C has no label.\n Directory of C:\\Documents and Settings\\.av\n\n' +
				'09/30/2026  12:00 AM    <DIR>          My Documents\n' +
				'09/30/2026  12:00 AM    <DIR>          My Music\n' +
				'09/30/2026  12:00 AM               417 about_me.txt\n' +
				'09/30/2026  12:00 AM         2,945,159 Marching - Yeat.m4a\n' +
				'               2 File(s)      2,945,576 bytes\n               2 Dir(s)   1,337,000,000 bytes free\n ');
		},
		ver: function () { cmdPrint('\nMicrosoft Windows XP [Version 5.1.2600]\n '); },
		date: function () { cmdPrint('The current date is: ' + new Date().toLocaleDateString() + '\n '); },
		time: function () { cmdPrint('The current time is: ' + new Date().toLocaleTimeString() + '\n '); },
		echo: function (a) { cmdPrint((a || 'ECHO is on.') + '\n '); },
		color: function (a) {
			var pal = ['#000', '#000080', '#008000', '#008080', '#800000', '#800080', '#808000', '#c0c0c0', '#808080', '#00f', '#0f0', '#0ff', '#f00', '#f0f', '#ff0', '#fff'];
			var m = /^([0-9a-f])([0-9a-f])$/i.exec(a || '07');
			if (!m) return cmdPrint('Usage: COLOR [attr]  e.g. COLOR 0A\n ');
			$('#cmd').style.background = pal[parseInt(m[1], 16)];
			$('#cmd').style.color = pal[parseInt(m[2], 16)];
		},
		winamp: function () { run('winamp'); play(); },
		winmine: function () { run('mines'); },
		minesweeper: function () { run('mines'); },
		tetris: function () { run('tetris'); },
		iexplore: function (a) { run('ie'); if (a) ieGo(a); },
		explorer: function () { run('explorer:computer'); },
		shutdown: function () { turnOffDialog(); },
		format: function (a) { if (/^c:?$/i.test(a || '')) setTimeout(bsod, 800); else cmdPrint('Required parameter missing\n '); },
		exit: function () { close('cmd'); },
		ipconfig: function () {
			cmdPrint('\nWindows IP Configuration\n\nEthernet adapter Local Area Connection:\n\n        IP Address. . . . . . . . . . . . : 127.0.0.1\n        Subnet Mask . . . . . . . . . . . : 255.0.0.0\n        Default Gateway . . . . . . . . . : 127.0.0.1\n ');
		},
		cd: function () { cmdPrint('Access is denied.\n '); }
	};
	CMDS.whois = CMDS.about;
	CMDS.start = function (a) { if (a) execRun(a); };

	function cmdExec(line) {
		cmdPrint($('#cmdPrompt').textContent + line);
		var m = /^\s*(\S+)\s*(.*)$/.exec(line);
		if (!m) return;
		var name = m[1].toLowerCase().replace(/\.(exe|com)$/, '');
		var f = CMDS[name];
		if (f) f(m[2].trim());
		else cmdPrint("'" + m[1] + "' is not recognized as an internal or external command,\noperable program or batch file.\n ");
	}

	function setupCmd() {
		var inp = $('#cmdIn');
		inp.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') {
				var v = inp.value;
				inp.value = '';
				if (v.trim()) { cmdHist.push(v); cmdHistIdx = cmdHist.length; }
				cmdExec(v);
				var c = $('#cmd'); c.scrollTop = c.scrollHeight;
			} else if (e.key === 'ArrowUp' && cmdHistIdx > 0) {
				inp.value = cmdHist[--cmdHistIdx]; e.preventDefault();
			} else if (e.key === 'ArrowDown' && cmdHistIdx < cmdHist.length) {
				inp.value = cmdHist[++cmdHistIdx] || ''; e.preventDefault();
			}
		});
		$('#cmd').addEventListener('click', function () { if (!getSelection().toString()) inp.focus(); });
		cmdBanner();
	}

	/* --------------------------------------------------------------------- run */
	function execRun(v) {
		var s = v.trim().toLowerCase().replace(/\.exe$/, '');
		var map = {
			cmd: 'cmd', command: 'cmd', winamp: 'winamp', winmine: 'mines', minesweeper: 'mines', tetris: 'tetris',
			iexplore: 'ie', explorer: 'explorer:computer', notepad: 'bio', about: 'bio', control: 'controlpanel',
			wupdmgr: 'winupdate', 'shutdown': 'turnoff'
		};
		if (/^format\s+c:?$/.test(s)) return bsod();
		if (map[s]) return run(map[s]);
		if (/^(https?:\/\/|www\.)/.test(s) || /^[^\s]+\.(com|net|org|io|gg|dev|app)(\/|$)/.test(s)) { run('ie'); return ieGo(v.trim()); }
		msgBox(v.trim(), "Windows cannot find '" + v.trim() + "'. Make sure you typed the name correctly, and then try again. To search for a file, click the Start button, and then click Search.");
	}

	function setupRun() {
		$('#runForm').addEventListener('submit', function (e) {
			e.preventDefault();
			var v = $('#runIn').value;
			close('run');
			if (v.trim()) execRun(v);
		});
	}

	/* ------------------------------------------------------------ app registry */
	var apps = {
		tetris: { onOpen: function () {} },
		winamp: { onClose: function () { stop(); } },
		cmd: {
			onOpen: function () { cmdBanner(); setTimeout(function () { $('#cmdIn').focus(); }, 0); },
			onClose: function () { $('#cmd').style.background = ''; $('#cmd').style.color = ''; }
		},
		run: { onOpen: function () { setTimeout(function () { $('#runIn').select(); }, 0); } },
		explorer: {}
	};

	function run(what) {
		closeStart();
		var p = what.split(':');
		switch (p[0]) {
			case 'explorer': open('explorer'); exGo(p[1] || 'computer'); break;
			case 'bsod': bsod(); break;
			case 'desktop':
				$$('.window').forEach(function (w) {
					if (!w.classList.contains('closed')) { w.classList.add('minimized'); w.classList.remove('active'); }
				});
				$$('#tasks li').forEach(function (t) { t.classList.remove('active'); });
				Tetris.pause();
				break;
			case 'controlpanel': msgBox('Control Panel', 'Control Panel has been disabled by your administrator.\n\n(The administrator is .av, and she likes it the way it is.)'); break;
			case 'printers': msgBox('Printers and Faxes', 'No printers are installed.\n\nIt is 2026. Nobody has a printer.', 'info'); break;
			case 'winupdate': msgBox('Windows Update', 'Windows XP is no longer supported.\n\nSupport ended on April 8, 2014. You are on your own.', 'info'); break;
			case 'turnoff': turnOffDialog(); break;
			default: open(p[0]);
		}
	}

	// double-click with a mouse, single tap on touch
	function bindOpen(container, selector, fn) {
		container.addEventListener('dblclick', function (e) {
			var el = e.target.closest(selector);
			if (el) fn(el);
		});
		container.addEventListener('pointerup', function (e) {
			if (e.pointerType !== 'touch') return;
			var el = e.target.closest(selector);
			if (el) fn(el);
		});
	}

	/* -------------------------------------------------------------- start menu */
	function openStart() { $('#startmenu').classList.remove('hidden'); $('#startBtn').classList.add('pressed'); }
	function closeStart() {
		$('#startmenu').classList.add('hidden');
		$('#startBtn').classList.remove('pressed');
		$$('#startmenu .open').forEach(function (o) { o.classList.remove('open'); });
	}

	function setupStart() {
		$('#startBtn').addEventListener('click', function (e) {
			e.stopPropagation();
			if ($('#startmenu').classList.contains('hidden')) openStart(); else closeStart();
		});
		$('#startmenu').addEventListener('click', function (e) {
			e.stopPropagation();
			var sub = e.target.closest('.has-sub, .sm-all');
			var item = e.target.closest('[data-open]');
			if (item) return run(item.dataset.open);
			if (sub) sub.classList.toggle('open');
		});
		document.addEventListener('click', function (e) {
			if (!e.target.closest('#startmenu')) closeStart();
			if (!e.target.closest('.has-menu')) $$('.has-menu.open').forEach(function (m) { m.classList.remove('open'); });
		});
		$('#logoffBtn').addEventListener('click', function () { closeStart(); logOff(); });
		$('#shutdownBtn').addEventListener('click', function () { closeStart(); turnOffDialog(); });
		$$('.has-menu').forEach(function (m) {
			m.addEventListener('click', function (e) {
				if (e.target === m) m.classList.toggle('open');
				else if (e.target.closest('li[data-ms]')) m.classList.remove('open');
			});
		});
	}

	/* ------------------------------------------------------------------ clock */
	function tick() {
		var d = new Date(), h = d.getHours(), m = d.getMinutes();
		$('#clock').textContent = ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
		$('#clock').title = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	}

	/* ------------------------------------------------- login / logoff / shutdown */
	var session = 0;

	function show(id) { $('#' + id).classList.remove('hidden'); }
	function hide(id) { $('#' + id).classList.add('hidden'); }

	function resetDesktop() {
		stop();
		$$('.window').forEach(function (w) {
			if (w.id.indexOf('win-msg') === 0) { w.remove(); return; }
			w.classList.add('closed');
			w.classList.remove('active', 'maximized', 'minimized');
			delete w.dataset.placed;
		});
		$('#tasks').innerHTML = '';
		cascade = 0;
		closeStart();
	}

	function logIn() {
		var s = ++session;
		hide('login');
		show('welcome');
		// unlock the music element inside the click so it can autoplay later
		music.muted = true;
		music.play().then(function () { music.pause(); music.currentTime = 0; music.muted = false; })
			.catch(function () { music.muted = false; });
		sfx('startup');
		var started = false;
		function startMusic() {
			if (started || s !== session) return;
			started = true;
			music.currentTime = 0;
			play();
		}
		sounds.startup.onended = startMusic;
		setTimeout(startMusic, 5500);

		setTimeout(function () {
			if (s !== session) return;
			hide('welcome');
			show('desktop');
			var wa = win('winamp');
			wa.dataset.pos = 'right';
			open('winamp');
			var bio = win('bio');
			bio.dataset.pos = 'center';
			open('bio');
		}, 1800);
	}

	function saying(text, ms, then) {
		$('#sayingText').textContent = text;
		show('saying');
		setTimeout(function () { hide('saying'); then(); }, ms);
	}

	function toLogin() {
		session++;
		sounds.startup.pause();
		hide('desktop'); hide('bsod'); hide('safeoff'); hide('standby'); hide('turnoff');
		resetDesktop();
		show('login');
	}

	function logOff() {
		session++;
		stop();
		sfx('logoff');
		hide('desktop');
		saying('logging off...', 2200, toLogin);
	}

	function turnOffDialog() {
		closeStart();
		show('turnoff');
	}

	function shutDown(restart) {
		hide('turnoff');
		session++;
		stop();
		sfx('shutdown');
		hide('desktop');
		hide('login');
		saying('Windows is shutting down...', 3000, function () {
			resetDesktop();
			if (restart) toLogin();
			else show('safeoff');
		});
	}

	function bsod() {
		closeStart();
		session++;
		stop();
		sfx('critical');
		show('bsod');
		setTimeout(function () {
			function wake() {
				document.removeEventListener('keydown', wake);
				$('#bsod').removeEventListener('pointerdown', wake);
				toLogin();
			}
			document.addEventListener('keydown', wake);
			$('#bsod').addEventListener('pointerdown', wake);
		}, 700);
	}

	function setupSession() {
		$('#loginUser').addEventListener('click', logIn);
		$('#loginOff').addEventListener('click', turnOffDialog);
		$('#turnoff').addEventListener('click', function (e) {
			var b = e.target.closest('[data-to]');
			if (!b && e.target !== this) return;
			var a = b ? b.dataset.to : 'cancel';
			if (a === 'cancel') hide('turnoff');
			if (a === 'off') shutDown(false);
			if (a === 'restart') shutDown(true);
			if (a === 'standby') {
				hide('turnoff');
				var wasPlaying = !music.paused;
				music.pause();
				show('standby');
				$('#standby').onclick = function () { hide('standby'); if (wasPlaying) play(); };
			}
		});
		$('#safeoff').addEventListener('click', toLogin);
	}

	/* ----------------------------------------------------------------- desktop */
	function setupDesktop() {
		var icons = $('#icons');
		icons.addEventListener('click', function (e) {
			var li = e.target.closest('li');
			$$('li', icons).forEach(function (x) { x.classList.toggle('selected', x === li); });
		});
		$('#desktop').addEventListener('pointerdown', function (e) {
			if (!e.target.closest('#icons li')) $$('#icons li').forEach(function (x) { x.classList.remove('selected'); });
		});
		bindOpen(icons, 'li', function (li) { run(li.dataset.open); });

		// any other [data-open] element opens on a single click
		document.addEventListener('click', function (e) {
			var el = e.target.closest('[data-open]');
			if (!el || el.closest('#icons')) return;
			run(el.dataset.open);
		});

		document.addEventListener('keydown', function (e) {
			var t = win('tetris');
			if (t.classList.contains('active') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) Tetris.key(e);
			if (e.key === 'Escape') closeStart();
		});
		document.addEventListener('contextmenu', function (e) {
			if (!e.target.closest('input, .content, .cmd')) e.preventDefault();
		});
		window.addEventListener('resize', function () {
			var vw = window.innerWidth, vh = window.innerHeight - TASKBAR_H;
			$$('.window').forEach(function (w) {
				if (w.classList.contains('closed')) return;
				if (w.offsetLeft > vw - 60) w.style.left = Math.max(0, vw - w.offsetWidth) + 'px';
				if (w.offsetTop > vh - 30) w.style.top = Math.max(0, vh - w.offsetHeight) + 'px';
			});
		});
	}

	/* -------------------------------------------------------------------- boot */
	$$('.window').forEach(setupWindow);
	setupDesktop();
	setupStart();
	setupExplorer();
	setupIE();
	setupWinamp();
	setupCmd();
	setupRun();
	setupSession();
	Minesweeper.init();
	Tetris.init();
	tick();
	setInterval(tick, 5000);
	// bio window starts closed until login
	$$('.window').forEach(function (w) { w.classList.add('closed'); });
})();
