/* Minesweeper — classic rules, XP sprites */
(function () {
	'use strict';
	var IMG = 'xp/img/minesweeper/';
	var LEVELS = {
		beginner: { w: 9, h: 9, mines: 10 },
		intermediate: { w: 16, h: 16, mines: 40 },
		expert: { w: 30, h: 16, mines: 99 }
	};

	var grid, face, minesEl, timeEl;
	var level = 'beginner';
	var cfg, cells, started, over, flags, opened, timer, seconds;

	function src(name) { return IMG + name + '.gif'; }

	function digits(el, n) {
		n = Math.max(-99, Math.min(999, n));
		var s = n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
		el.innerHTML = '';
		for (var i = 0; i < 3; i++) {
			var img = document.createElement('img');
			img.src = src('time' + s[i]);
			img.alt = '';
			el.appendChild(img);
		}
	}

	function newGame(lvl) {
		if (lvl) level = lvl;
		cfg = LEVELS[level];
		clearInterval(timer);
		started = false; over = false; flags = 0; opened = 0; seconds = 0;
		face.style.backgroundImage = 'url(' + src('facesmile') + ')';
		digits(minesEl, cfg.mines);
		digits(timeEl, 0);
		grid.style.gridTemplateColumns = 'repeat(' + cfg.w + ', 16px)';
		grid.innerHTML = '';
		cells = [];
		for (var y = 0; y < cfg.h; y++) {
			for (var x = 0; x < cfg.w; x++) {
				var img = document.createElement('img');
				img.src = src('blank');
				img.alt = '';
				img.dataset.i = cells.length;
				grid.appendChild(img);
				cells.push({ x: x, y: y, mine: false, open: false, flag: 0, n: 0, el: img });
			}
		}
		document.querySelectorAll('[data-ms]').forEach(function (li) {
			li.classList.toggle('check', li.dataset.ms === level);
		});
	}

	function at(x, y) {
		if (x < 0 || y < 0 || x >= cfg.w || y >= cfg.h) return null;
		return cells[y * cfg.w + x];
	}

	function around(c) {
		var out = [];
		for (var dy = -1; dy <= 1; dy++)
			for (var dx = -1; dx <= 1; dx++)
				if (dx || dy) { var n = at(c.x + dx, c.y + dy); if (n) out.push(n); }
		return out;
	}

	// Mines are placed on the first click so it can never be a mine
	function plant(safe) {
		var pool = cells.filter(function (c) { return c !== safe && around(safe).indexOf(c) < 0; });
		if (pool.length < cfg.mines) pool = cells.filter(function (c) { return c !== safe; });
		for (var i = 0; i < cfg.mines; i++) {
			var j = i + Math.floor(Math.random() * (pool.length - i));
			var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
			pool[i].mine = true;
		}
		cells.forEach(function (c) {
			c.n = around(c).filter(function (n) { return n.mine; }).length;
		});
		started = true;
		timer = setInterval(function () {
			if (seconds < 999) digits(timeEl, ++seconds);
		}, 1000);
	}

	function reveal(c) {
		if (c.open || c.flag === 1) return;
		if (!started) plant(c);
		if (c.mine) return lose(c);
		var stack = [c];
		while (stack.length) {
			var cur = stack.pop();
			if (cur.open || cur.flag === 1) continue;
			cur.open = true; opened++;
			cur.el.src = src('open' + cur.n);
			if (cur.n === 0) around(cur).forEach(function (n) { if (!n.open) stack.push(n); });
		}
		if (opened === cfg.w * cfg.h - cfg.mines) win();
	}

	function chord(c) {
		if (!c.open || !c.n) return;
		var f = around(c).filter(function (n) { return n.flag === 1; }).length;
		if (f === c.n) around(c).forEach(reveal);
	}

	function toggleFlag(c) {
		if (c.open) return;
		c.flag = (c.flag + 1) % 3;
		if (c.flag === 1) flags++;
		if (c.flag === 2) flags--;
		c.el.src = src(['blank', 'bombflagged', 'bombquestion'][c.flag]);
		digits(minesEl, cfg.mines - flags);
	}

	function lose(hit) {
		over = true;
		clearInterval(timer);
		face.style.backgroundImage = 'url(' + src('facedead') + ')';
		cells.forEach(function (c) {
			if (c.mine && c.flag !== 1) c.el.src = src('bombrevealed');
			if (!c.mine && c.flag === 1) c.el.src = src('bombmisflagged');
		});
		hit.el.src = src('bombdeath');
	}

	function win() {
		over = true;
		clearInterval(timer);
		face.style.backgroundImage = 'url(' + src('facewin') + ')';
		cells.forEach(function (c) { if (c.mine) c.el.src = src('bombflagged'); });
		digits(minesEl, 0);
	}

	function cellFrom(e) {
		var i = e.target.dataset && e.target.dataset.i;
		return i === undefined ? null : cells[+i];
	}

	function init() {
		grid = document.getElementById('msGrid');
		face = document.getElementById('msFace');
		minesEl = document.getElementById('msMines');
		timeEl = document.getElementById('msTime');
		if (!grid) return;

		var pressTimer = null, longPressed = false;

		grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
		grid.addEventListener('pointerdown', function (e) {
			var c = cellFrom(e);
			if (!c || over) return;
			if (e.button === 2) { toggleFlag(c); return; }
			face.style.backgroundImage = 'url(' + src('faceooh') + ')';
			if (e.pointerType === 'touch') {
				longPressed = false;
				pressTimer = setTimeout(function () { longPressed = true; toggleFlag(c); }, 400);
			}
		});
		grid.addEventListener('pointerup', function (e) {
			clearTimeout(pressTimer);
			var c = cellFrom(e);
			if (over) return;
			face.style.backgroundImage = 'url(' + src('facesmile') + ')';
			if (!c || e.button === 2 || longPressed) return;
			if (c.open) chord(c); else reveal(c);
		});
		grid.addEventListener('pointerleave', function () {
			clearTimeout(pressTimer);
			if (!over) face.style.backgroundImage = 'url(' + src('facesmile') + ')';
		});
		face.addEventListener('click', function () { newGame(); });

		document.querySelectorAll('[data-ms]').forEach(function (li) {
			li.addEventListener('click', function () {
				var v = li.dataset.ms;
				newGame(v === 'new' ? null : v);
			});
		});
		newGame();
	}

	window.Minesweeper = { init: init, newGame: newGame };
})();
