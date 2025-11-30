// --- Configuration ---
const wireTypes = [
    { color: '#ff0000', symbol: '■' },
    { color: '#1111ff', symbol: '▲' },
    { color: '#ffe100', symbol: '★' },
    { color: '#ff00ff', symbol: '●' },
    { color: '#00ff00', symbol: '♦' },
    { color: '#ff6600', symbol: '✚' },
    { color: '#00ffff', symbol: '▼' },
    { color: '#ffffff', symbol: '♠' }
];

// --- State ---
let currentLevel = 1;
let highScore = 1;
let activeWire = null;
let connections = [];
let isDragging = false;
let startSocket = null;
let isTransitioning = false;

// --- DOM Elements (will be assigned in initApp) ---
let leftCol, rightCol, svgCanvas, overlay, levelDisplay, highScoreDisplay, yearDisplay;

// --- Initialization ---
function initApp() {
    leftCol = document.getElementById('left-col');
    rightCol = document.getElementById('right-col');
    svgCanvas = document.getElementById('wire-canvas');
    overlay = document.getElementById('overlay');
    levelDisplay = document.getElementById('level-indicator');
    highScoreDisplay = document.getElementById('high-score');
    yearDisplay = document.getElementById('year');

    yearDisplay.textContent = new Date().getFullYear();
    const storedScore = localStorage.getItem('wiringHighScore');
    if (storedScore) highScore = parseInt(storedScore, 10);
    highScoreDisplay.textContent = highScore;
    initGame();
}

function initGame() {
    leftCol.innerHTML = '';
    rightCol.innerHTML = '';
    svgCanvas.innerHTML = '';
    connections = [];
    overlay.style.display = 'none';
    levelDisplay.textContent = currentLevel;
    isTransitioning = false;

    const wireCount = Math.min(wireTypes.length, 3 + Math.floor(currentLevel / 2));
    const shuffledTypes = [...wireTypes].sort(() => Math.random() - 0.5);
    const levelWires = shuffledTypes.slice(0, wireCount);

    levelWires.forEach(type => createSocket(leftCol, type, 'left'));

    const rightWires = [...levelWires].sort(() => Math.random() - 0.5);
    rightWires.forEach(type => createSocket(rightCol, type, 'right'));
}

function createSocket(container, type, side) {
    const containerDiv = document.createElement('div');
    containerDiv.className = 'socket-container';

    const socket = document.createElement('div');
    socket.classList.add('socket');
    socket.dataset.color = type.color;
    socket.dataset.side = side;

    const wireBase = document.createElement('div');
    wireBase.className = 'wire-base';
    wireBase.style.backgroundColor = type.color;

    if (['#ffe100', '#00ffff', '#ffffff', '#00ff00'].includes(type.color)) {
        wireBase.style.color = 'black';
    } else {
        wireBase.style.color = 'white';
    }
    wireBase.textContent = type.symbol;

    socket.appendChild(wireBase);
    containerDiv.appendChild(socket);
    container.appendChild(containerDiv);

    if (side === 'left') {
        socket.addEventListener('mousedown', handleDragStart);
        socket.addEventListener('touchstart', handleDragStart, {passive: false});
    } else {
        socket.addEventListener('mouseup', handleDragEnd);
        socket.addEventListener('touchend', handleDragEnd, {passive: false});
    }
}

// --- Interaction Logic ---
function handleDragStart(e) {
    if (isTransitioning) return;
    const target = e.target.closest('.socket');
    if (!target || target.dataset.connected === 'true') return;

    e.preventDefault();
    isDragging = true;
    startSocket = target;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', startSocket.dataset.color);
    path.setAttribute('stroke-width', '14');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.5))';
    path.style.pointerEvents = 'none';

    svgCanvas.appendChild(path);
    activeWire = path;

    updateWire(e);

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, {passive: false});
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
}

function handleDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    updateWire(e);
}

function updateWire(e) {
    if (!startSocket || !activeWire) return;
    const startRect = startSocket.getBoundingClientRect();
    const boardRect = document.getElementById('game-board').getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2 - boardRect.left;
    const startY = startRect.top + startRect.height / 2 - boardRect.top;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const mouseX = clientX - boardRect.left;
    const mouseY = clientY - boardRect.top;
    const controlOffset = Math.abs(mouseX - startX) * 0.5;
    const d = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${mouseX - controlOffset} ${mouseY}, ${mouseX} ${mouseY}`;
    activeWire.setAttribute('d', d);
}

function handleDragEnd(e) {
    if (!isDragging || !startSocket) return;

    let target = e.target;
    if (e.changedTouches) {
        const touch = e.changedTouches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY);
    }
    if (target) target = target.closest('.socket');

    if (target &&
        target.classList.contains('socket') &&
        target.dataset.side === 'right' &&
        target.dataset.color === startSocket.dataset.color &&
        target.dataset.connected !== 'true') {

        snapWireToTarget(target);
        startSocket.dataset.connected = 'true';
        target.dataset.connected = 'true';
        startSocket.style.opacity = '1';
        startSocket.style.cursor = 'default';
        target.style.cursor = 'default';

        connections.push(activeWire);
        checkWin();
    } else {
        if(activeWire) activeWire.remove();
    }
    cleanUpDrag();
}

function snapWireToTarget(targetSocket) {
    const startRect = startSocket.getBoundingClientRect();
    const targetRect = targetSocket.getBoundingClientRect();
    const boardRect = document.getElementById('game-board').getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2 - boardRect.left;
    const startY = startRect.top + startRect.height / 2 - boardRect.top;
    const endX = targetRect.left + targetRect.width / 2 - boardRect.left;
    const endY = targetRect.top + targetRect.height / 2 - boardRect.top;
    const dist = Math.abs(endX - startX);
    const controlOffset = dist * 0.5;
    const d = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    activeWire.setAttribute('d', d);
}

function stopDrag(e) {
    setTimeout(() => {
        if (isDragging) {
            if (activeWire && !connections.includes(activeWire)) activeWire.remove();
            cleanUpDrag();
        }
    }, 10);
}

function cleanUpDrag() {
    isDragging = false;
    startSocket = null;
    activeWire = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

function checkWin() {
    const totalWires = document.querySelectorAll('.column-left .socket').length;
    if (connections.length === totalWires) {
        isTransitioning = true;
        setTimeout(() => {
            overlay.style.display = 'flex';
            setTimeout(() => {
                nextLevel();
            }, 1500);
        }, 300);
    }
}

function nextLevel() {
    currentLevel++;
    if (currentLevel > highScore) {
        highScore = currentLevel;
        localStorage.setItem('wiringHighScore', highScore);
        highScoreDisplay.textContent = highScore;
    }
    initGame();
}

// --- UI Functions ---
function triggerHome() {
    window.location.href = '../index.html';
}

function triggerReset() {
    currentLevel = 1;
    initGame();
}

// Expose UI functions to global scope so inline onclick handlers still work
window.triggerHome = triggerHome;
window.triggerReset = triggerReset;

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
