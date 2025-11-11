// Game state
const game = {
    score: 0,
    lives: 3,
    isRunning: false,
    isPaused: false,
    playerX: 0,
    playerSpeed: 8,
    objects: [],
    spawnInterval: null,
    gameLoop: null,
    difficulty: 1
};

// Audio context for sound effects and music
let audioContext = null;
let musicGainNode = null;
let isMusicPlaying = false;
let musicTimeoutId = null;

// Initialize audio context (requires user interaction)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        musicGainNode = audioContext.createGain();
        musicGainNode.gain.setValueAtTime(0.15, audioContext.currentTime); // Lower volume for background
        musicGainNode.connect(audioContext.destination);
    }
}

// 8-bit background music - simple upbeat melody
function playBackgroundMusic() {
    if (!audioContext || !musicGainNode) return;

    isMusicPlaying = true;

    // Simple melody pattern (frequencies in Hz)
    const melody = [
        { note: 523.25, duration: 0.2 },  // C5
        { note: 659.25, duration: 0.2 },  // E5
        { note: 783.99, duration: 0.2 },  // G5
        { note: 659.25, duration: 0.2 },  // E5
        { note: 698.46, duration: 0.2 },  // F5
        { note: 783.99, duration: 0.2 },  // G5
        { note: 880.00, duration: 0.2 },  // A5
        { note: 783.99, duration: 0.2 },  // G5
    ];

    let startTime = audioContext.currentTime;

    melody.forEach((tone, index) => {
        const noteStartTime = startTime + (index * 0.25);

        const oscillator = audioContext.createOscillator();
        oscillator.type = 'square'; // 8-bit sound
        oscillator.frequency.setValueAtTime(tone.note, noteStartTime);

        const noteGain = audioContext.createGain();
        noteGain.gain.setValueAtTime(0, noteStartTime);
        noteGain.gain.linearRampToValueAtTime(1, noteStartTime + 0.01);
        noteGain.gain.setValueAtTime(1, noteStartTime + tone.duration - 0.05);
        noteGain.gain.linearRampToValueAtTime(0, noteStartTime + tone.duration);

        oscillator.connect(noteGain);
        noteGain.connect(musicGainNode);

        oscillator.start(noteStartTime);
        oscillator.stop(noteStartTime + tone.duration);
    });

    // Loop the music
    const totalDuration = melody.length * 0.25 * 1000; // Convert to milliseconds
    musicTimeoutId = setTimeout(() => {
        if (isMusicPlaying && game.isRunning && !game.isPaused) {
            playBackgroundMusic();
        }
    }, totalDuration);
}

// Stop background music
function stopBackgroundMusic() {
    isMusicPlaying = false;
    if (musicTimeoutId) {
        clearTimeout(musicTimeoutId);
        musicTimeoutId = null;
    }
}

// Play happy sound for collecting stars (8-bit power-up sound)
function playHappySound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 8-bit style rising tone
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
}

// Play sad sound for getting hit by bombs (8-bit explosion sound)
function playSadSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Create oscillator for explosion effect
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 8-bit style descending tone (explosion)
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    // Volume envelope
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
}

// DOM elements
const gameArea = document.getElementById('gameArea');
const player = document.getElementById('player');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

// Initialize player position
function initPlayer() {
    const gameWidth = gameArea.offsetWidth;
    game.playerX = (gameWidth - player.offsetWidth) / 2;
    player.style.left = game.playerX + 'px';
}

// Keyboard controls
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Prevent default scrolling for arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Move player
function movePlayer() {
    if (!game.isRunning || game.isPaused) return;

    const gameWidth = gameArea.offsetWidth;
    const playerWidth = player.offsetWidth;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        game.playerX = Math.max(0, game.playerX - game.playerSpeed);
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        game.playerX = Math.min(gameWidth - playerWidth, game.playerX + game.playerSpeed);
    }

    player.style.left = game.playerX + 'px';
}

// Spawn falling object
function spawnObject() {
    if (!game.isRunning || game.isPaused) return;

    const gameWidth = gameArea.offsetWidth;
    const isGood = Math.random() > 0.4; // 60% chance of good object

    const obj = document.createElement('div');
    obj.className = `falling-object ${isGood ? 'good-object' : 'bad-object'}`;
    obj.style.left = Math.random() * (gameWidth - 40) + 'px';
    obj.style.top = '-40px';

    obj.dataset.isGood = isGood;
    obj.dataset.y = -40;
    obj.dataset.speed = 2 + Math.random() * game.difficulty;

    gameArea.appendChild(obj);
    game.objects.push(obj);
}

// Check collision
function checkCollision(obj) {
    const objRect = obj.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();

    return !(objRect.right < playerRect.left ||
             objRect.left > playerRect.right ||
             objRect.bottom < playerRect.top ||
             objRect.top > playerRect.bottom);
}

// Update falling objects
function updateObjects() {
    if (!game.isRunning || game.isPaused) return;

    const gameHeight = gameArea.offsetHeight;

    game.objects.forEach((obj, index) => {
        if (!obj.parentElement) {
            game.objects.splice(index, 1);
            return;
        }

        let y = parseFloat(obj.dataset.y);
        const speed = parseFloat(obj.dataset.speed);

        y += speed;
        obj.dataset.y = y;
        obj.style.top = y + 'px';

        // Check collision with player
        if (checkCollision(obj)) {
            const isGood = obj.dataset.isGood === 'true';

            if (isGood) {
                game.score += 10;
                scoreEl.textContent = game.score;

                // Play happy sound
                playHappySound();

                // Increase difficulty every 50 points
                if (game.score % 50 === 0) {
                    game.difficulty += 0.5;
                }
            } else {
                game.lives--;
                livesEl.textContent = game.lives;

                // Play sad sound
                playSadSound();

                // Add shake effect
                player.style.animation = 'shake 0.3s';
                setTimeout(() => {
                    player.style.animation = '';
                }, 300);

                if (game.lives <= 0) {
                    gameOver();
                }
            }

            obj.remove();
            game.objects.splice(index, 1);
        }
        // Remove if off screen
        else if (y > gameHeight) {
            obj.remove();
            game.objects.splice(index, 1);
        }
    });
}

// Main game loop
function gameLoopFn() {
    if (!game.isRunning || game.isPaused) return;

    movePlayer();
    updateObjects();

    game.gameLoop = requestAnimationFrame(gameLoopFn);
}

// Start game
function startGame() {
    if (game.isRunning) return;

    // Initialize audio context (requires user interaction)
    initAudio();

    game.isRunning = true;
    game.isPaused = false;
    game.score = 0;
    game.lives = 3;
    game.difficulty = 1;

    scoreEl.textContent = game.score;
    livesEl.textContent = game.lives;

    // Clear existing objects
    game.objects.forEach(obj => obj.remove());
    game.objects = [];

    // Remove game over screen if exists
    const gameOverEl = document.querySelector('.game-over');
    if (gameOverEl) gameOverEl.remove();

    startBtn.disabled = true;
    pauseBtn.disabled = false;

    initPlayer();

    // Start spawning objects
    game.spawnInterval = setInterval(spawnObject, 1000);

    // Start background music
    playBackgroundMusic();

    // Start game loop
    gameLoopFn();
}

// Pause game
function pauseGame() {
    if (!game.isRunning) return;

    game.isPaused = !game.isPaused;
    pauseBtn.textContent = game.isPaused ? 'Resume' : 'Pause';

    if (game.isPaused) {
        stopBackgroundMusic();
    } else {
        playBackgroundMusic();
        gameLoopFn();
    }
}

// Restart game
function restartGame() {
    // Stop current game
    game.isRunning = false;
    game.isPaused = false;

    clearInterval(game.spawnInterval);
    cancelAnimationFrame(game.gameLoop);
    stopBackgroundMusic();

    // Clear objects
    game.objects.forEach(obj => obj.remove());
    game.objects = [];

    // Remove game over screen
    const gameOverEl = document.querySelector('.game-over');
    if (gameOverEl) gameOverEl.remove();

    // Reset buttons
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';

    // Reset stats display
    game.score = 0;
    game.lives = 3;
    scoreEl.textContent = game.score;
    livesEl.textContent = game.lives;

    initPlayer();
}

// Game over
function gameOver() {
    game.isRunning = false;
    clearInterval(game.spawnInterval);
    cancelAnimationFrame(game.gameLoop);
    stopBackgroundMusic();

    const gameOverDiv = document.createElement('div');
    gameOverDiv.className = 'game-over';
    gameOverDiv.innerHTML = `
        <h2>Game Over!</h2>
        <p>Final Score: ${game.score}</p>
        <p>Click Restart to play again</p>
    `;

    gameArea.appendChild(gameOverDiv);

    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// Add shake animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(-50%); }
        25% { transform: translateX(calc(-50% - 10px)); }
        75% { transform: translateX(calc(-50% + 10px)); }
    }
`;
document.head.appendChild(style);

// Event listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
restartBtn.addEventListener('click', restartGame);

// Initialize on load
window.addEventListener('load', initPlayer);
window.addEventListener('resize', () => {
    if (!game.isRunning) {
        initPlayer();
    }
});
