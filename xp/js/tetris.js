/* Tetris */
(function () {
	'use strict';
	var W = 10, H = 20, S = 20;
	var SHAPES = {
		I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
		J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
		L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
		O: [[1, 1], [1, 1]],
		S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
		T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
		Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
	};
	var COLORS = { I: '#00c8ff', J: '#2150e8', L: '#ff9a00', O: '#ffd500', S: '#29c22b', T: '#a53be0', Z: '#ec2b2b' };
	var LINE_SCORE = [0, 40, 100, 300, 1200];

	var ctx, nctx, board, piece, next, bag = [];
	var score, lines, lvl, dropMs, acc, last, running = false, paused = false, gameOver = false, raf;
	var elScore, elLines, elLevel, startBtn;

	function takeFromBag() {
		if (!bag.length) {
			bag = Object.keys(SHAPES);
			for (var i = bag.length - 1; i > 0; i--) {
				var j = Math.floor(Math.random() * (i + 1));
				var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
			}
		}
		var k = bag.pop();
		return { k: k, m: SHAPES[k].map(function (r) { return r.slice(); }), x: 0, y: 0 };
	}

	function spawn() {
		piece = next || takeFromBag();
		next = takeFromBag();
		piece.x = Math.floor((W - piece.m[0].length) / 2);
		piece.y = piece.k === 'I' ? -1 : 0;
		if (collides(piece.m, piece.x, piece.y)) end();
		drawNext();
	}

	function collides(m, px, py) {
		for (var y = 0; y < m.length; y++)
			for (var x = 0; x < m[y].length; x++) {
				if (!m[y][x]) continue;
				var bx = px + x, by = py + y;
				if (bx < 0 || bx >= W || by >= H) return true;
				if (by >= 0 && board[by][bx]) return true;
			}
		return false;
	}

	function rotate() {
		var m = piece.m, n = m.length;
		var r = m.map(function (row, y) { return row.map(function (_, x) { return m[n - 1 - x][y]; }); });
		var kicks = [0, -1, 1, -2, 2];
		for (var i = 0; i < kicks.length; i++) {
			if (!collides(r, piece.x + kicks[i], piece.y)) { piece.m = r; piece.x += kicks[i]; return; }
		}
	}

	function move(dx) { if (!collides(piece.m, piece.x + dx, piece.y)) piece.x += dx; }

	function softDrop() {
		if (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; score += 1; return true; }
		lock();
		return false;
	}

	function hardDrop() {
		var n = 0;
		while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; n++; }
		score += n * 2;
		lock();
	}

	function lock() {
		piece.m.forEach(function (row, y) {
			row.forEach(function (v, x) {
				if (v && piece.y + y >= 0) board[piece.y + y][piece.x + x] = piece.k;
			});
		});
		var cleared = 0;
		for (var y = H - 1; y >= 0; y--) {
			if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(new Array(W).fill(null)); cleared++; y++; }
		}
		lines += cleared;
		score += LINE_SCORE[cleared] * lvl;
		lvl = Math.floor(lines / 10) + 1;
		dropMs = Math.max(80, 800 - (lvl - 1) * 70);
		spawn();
		stats();
	}

	function stats() {
		elScore.textContent = score;
		elLines.textContent = lines;
		elLevel.textContent = lvl;
	}

	function cell(c, x, y, color, size) {
		c.fillStyle = color;
		c.fillRect(x * size, y * size, size, size);
		c.fillStyle = 'rgba(255,255,255,.45)';
		c.fillRect(x * size, y * size, size, 2);
		c.fillRect(x * size, y * size, 2, size);
		c.fillStyle = 'rgba(0,0,0,.35)';
		c.fillRect(x * size, y * size + size - 2, size, 2);
		c.fillRect(x * size + size - 2, y * size, 2, size);
	}

	function draw() {
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, W * S, H * S);
		for (var y = 0; y < H; y++)
			for (var x = 0; x < W; x++)
				if (board[y][x]) cell(ctx, x, y, COLORS[board[y][x]], S);
		if (piece && !gameOver) {
			var gy = piece.y;
			while (!collides(piece.m, piece.x, gy + 1)) gy++;
			piece.m.forEach(function (row, y) {
				row.forEach(function (v, x) {
					if (!v) return;
					ctx.strokeStyle = 'rgba(255,255,255,.25)';
					ctx.strokeRect((piece.x + x) * S + .5, (gy + y) * S + .5, S - 1, S - 1);
					if (piece.y + y >= 0) cell(ctx, piece.x + x, piece.y + y, COLORS[piece.k], S);
				});
			});
		}
		if (!running || paused || gameOver) {
			ctx.fillStyle = 'rgba(0,0,0,.6)';
			ctx.fillRect(0, 0, W * S, H * S);
			ctx.fillStyle = '#fff';
			ctx.font = 'bold 18px Tahoma, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(gameOver ? 'GAME OVER' : paused ? 'PAUSED' : 'TETRIS', W * S / 2, H * S / 2 - 6);
			ctx.font = '11px Tahoma, sans-serif';
			ctx.fillText(paused ? 'Press P to resume' : 'Press Start', W * S / 2, H * S / 2 + 14);
		}
	}

	function drawNext() {
		nctx.fillStyle = '#fff';
		nctx.fillRect(0, 0, 80, 80);
		if (!next) return;
		var m = next.m, s = 16;
		var ox = (80 - m[0].length * s) / 2, oy = (80 - m.length * s) / 2;
		nctx.save();
		nctx.translate(ox, oy);
		m.forEach(function (row, y) { row.forEach(function (v, x) { if (v) cell(nctx, x, y, COLORS[next.k], s); }); });
		nctx.restore();
	}

	function loop(t) {
		if (!running || paused || gameOver) return;
		acc += t - last; last = t;
		if (acc > dropMs) { acc = 0; if (!collides(piece.m, piece.x, piece.y + 1)) piece.y++; else lock(); }
		draw();
		raf = requestAnimationFrame(loop);
	}

	function start() {
		board = [];
		for (var y = 0; y < H; y++) board.push(new Array(W).fill(null));
		score = 0; lines = 0; lvl = 1; dropMs = 800; acc = 0;
		next = null; bag = [];
		gameOver = false; paused = false; running = true;
		spawn();
		stats();
		startBtn.textContent = 'Restart';
		last = performance.now();
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(loop);
	}

	function end() {
		gameOver = true;
		running = false;
		startBtn.textContent = 'Start';
		draw();
	}

	function setPaused(p) {
		if (!running || gameOver || paused === p) return;
		paused = p;
		if (!p) { last = performance.now(); raf = requestAnimationFrame(loop); }
		draw();
	}

	function act(a) {
		if (!running || paused || gameOver) return;
		if (a === 'left') move(-1);
		else if (a === 'right') move(1);
		else if (a === 'rotate') rotate();
		else if (a === 'down') softDrop();
		else if (a === 'drop') hardDrop();
		stats();
		draw();
	}

	function key(e) {
		var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop' };
		if (e.key === 'p' || e.key === 'P') { setPaused(!paused); e.preventDefault(); return; }
		if (map[e.key]) { act(map[e.key]); e.preventDefault(); }
	}

	function init() {
		var canvas = document.getElementById('tCanvas');
		if (!canvas) return;
		ctx = canvas.getContext('2d');
		nctx = document.getElementById('tNext').getContext('2d');
		elScore = document.getElementById('tScore');
		elLines = document.getElementById('tLines');
		elLevel = document.getElementById('tLevel');
		startBtn = document.getElementById('tStart');
		startBtn.addEventListener('click', function () { start(); startBtn.blur(); });
		document.querySelectorAll('[data-t]').forEach(function (b) {
			b.addEventListener('pointerdown', function (e) { e.preventDefault(); act(b.dataset.t); });
		});
		board = [];
		for (var y = 0; y < H; y++) board.push(new Array(W).fill(null));
		drawNext();
		draw();
	}

	window.Tetris = { init: init, key: key, pause: function () { setPaused(true); } };
})();
