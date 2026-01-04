// Main game logic for multiplayer infinite grid crossword game
import { onAuthStateChange, signOutUser, showLoginScreen, getCurrentUser } from './auth.js';
import { showGameListScreen, loadGames } from './gameList.js';
import { createGameAndInvite, checkPendingInvitations, acceptInvitation } from './invitations.js';
import { subscribeToGame, unsubscribeFromGame, updateBoard, finishTurn, getCurrentGameId, updateGameState } from './gameState.js';

// Letter distribution percentages
const letterDistribution = {
    "י": 15.4836,
    "ו": 10.3197,
    "נ": 10.1562,
    "מ": 8.5153,
    "ת": 8.4439,
    "ה": 6.6506,
    "כ": 6.4263,
    "ר": 4.2524,
    "ש": 3.4131,
    "ל": 2.9258,
    "ב": 2.7679,
    "פ": 2.4766,
    "ק": 2.406,
    "ח": 2.3625,
    "ע": 2.3024,
    "א": 2.2773,
    "ד": 2.044,
    "ס": 1.6438,
    "ט": 1.4591,
    "צ": 1.399,
    "ג": 1.1855,
    "ז": 1.0892
};

// Game state
let dictionary = new Set();
let board = Array(10).fill(null).map(() => Array(10).fill(null)); // Fixed 10x10 board
let boardAtTurnStart = null; // Board state at the start of current turn
let tempTiles = new Set(); // Set of coordinates (row,col) that are TEMP tiles
let currentPlayerLetters = []; // Current player's letters
let tileIdCounter = 0;
let tileData = {}; // Map of tileId -> {letter, x, y, element}
let currentGame = null;
let isMyTurn = false;
let cellSize = 48; // Size of each grid cell in pixels

// Random number generator
function random() {
    return Math.random();
}

// Generate random letters based on distribution
function generateRandomLetters(count) {
    const letters = Object.keys(letterDistribution);
    const cumulative = [];
    let sum = 0;
    
    letters.forEach(letter => {
        sum += letterDistribution[letter];
        cumulative.push({ letter, threshold: sum });
    });
    
    // Normalize to 100%
    const total = cumulative[cumulative.length - 1].threshold;
    cumulative.forEach(item => {
        item.threshold = item.threshold / total;
    });
    
    // Select letters
    const selectedLetters = [];
    for (let i = 0; i < count; i++) {
        const rand = random();
        let selected = cumulative[cumulative.length - 1].letter;
        for (let j = 0; j < cumulative.length; j++) {
            if (rand <= cumulative[j].threshold) {
                selected = cumulative[j].letter;
                break;
            }
        }
        selectedLetters.push(selected);
    }
    
    return selectedLetters;
}

// Load dictionary
async function loadDictionary() {
    try {
        // In Vite, files from public/ are copied to root of dist/, so use '/dictionary.txt'
        const response = await fetch('/dictionary.txt');
        if (!response.ok) {
            throw new Error(`Failed to load dictionary: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        console.log(`Dictionary file loaded, length: ${text.length} characters`);
        const words = text.split('\n').map(word => word.trim()).filter(word => word.length > 0);
        console.log(`Parsed ${words.length} words from dictionary file`);
        words.forEach(word => dictionary.add(word));
        console.log(`Loaded ${dictionary.size} unique words from dictionary`);
    } catch (error) {
        console.error('Error loading dictionary:', error);
    }
}

// Initialize fixed 10x10 board
function initializeBoard() {
    const gameBoard = $('#gameBoard');
    gameBoard.empty();
    
    // Create 10x10 grid
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const cell = $('<div>')
                .addClass('grid-cell')
                .attr('data-row', row)
                .attr('data-col', col);
            
            // Add letter if exists
            if (board[row][col]) {
                // Check if this tile is TEMP (placed in current turn)
                const coordKey = `${row},${col}`;
                const isTemp = tempTiles.has(coordKey);
                const tile = createTile(board[row][col], row, col, isTemp);
                cell.append(tile);
            }
            
            gameBoard.append(cell);
        }
    }
    
    // Make cells droppable
    $('.grid-cell').droppable({
        accept: '.letter-tile',
        tolerance: 'pointer',
        drop: function(event, ui) {
            handleDrop($(this), ui.draggable);
        }
    });
}

// Create a tile
function createTile(letter, row, col, isTemp = false) {
    const tileId = `tile-${tileIdCounter++}`;
    const tile = $('<div>')
        .addClass('letter-tile')
        .text(letter)
        .attr('data-letter', letter)
        .attr('data-tile-id', tileId)
        .attr('data-row', row)
        .attr('data-col', col);
    
    // Mark as TEMP if it's a new tile placed in current turn
    if (isTemp) {
        tile.attr('data-temp', 'true');
    }
    
    tileData[tileId] = {
        letter,
        row,
        col,
        element: tile,
        isTemp
    };
    
    // Only make draggable if it's TEMP or from stock
    if (isTemp) {
        makeDraggable(tile);
    }
    
    return tile;
}

// Make element draggable (only for TEMP tiles or stock tiles)
function makeDraggable($element) {
    $element.draggable({
        revert: 'invalid',
        cursor: 'move',
        distance: 10,
        scroll: false,
        start: function() {
            // Only allow dragging if it's TEMP or from stock
            const isTemp = $(this).attr('data-temp') === 'true';
            const isFromStock = $(this).parent().hasClass('letter-stock');
            
            if (!isTemp && !isFromStock) {
                return false; // Prevent dragging locked tiles
            }
            
            $(this).css('opacity', '0.5');
            $('body').css('overflow', 'hidden');
        },
        stop: function() {
            $(this).css('opacity', '1');
            $('body').css('overflow', '');
        }
    });
}

// Handle drop on board
function handleDrop(cell, draggable) {
    if (!isMyTurn) return;
    
    const tileId = draggable.attr('data-tile-id');
    const letter = draggable.attr('data-letter');
    const row = parseInt(cell.attr('data-row'));
    const col = parseInt(cell.attr('data-col'));
    
    // Check if cell already has a letter
    if (board[row][col]) {
        // Swap or return
        return;
    }
    
    // Check if from stock
    const isFromStock = draggable.parent().hasClass('letter-stock');
    
    if (isFromStock) {
        // Remove from stock
        const index = currentPlayerLetters.indexOf(letter);
        if (index > -1) {
            currentPlayerLetters.splice(index, 1);
        }
        draggable.detach();
        
        // Place on board as TEMP tile (new tile in current turn)
        board[row][col] = letter;
        const coordKey = `${row},${col}`;
        tempTiles.add(coordKey); // Mark as TEMP
        const tile = createTile(letter, row, col, true); // true = isTemp
        cell.append(tile);
        
        // Update tile data
        if (tileId && tileData[tileId]) {
            tileData[tileId].row = row;
            tileData[tileId].col = col;
            tileData[tileId].isTemp = true;
        }
        
        // Don't save to Firestore here - only save at end of turn
        updateLetterStock();
    } else {
        // Moving TEMP tile on board - only allow if it's TEMP
        const isTemp = draggable.attr('data-temp') === 'true';
        if (!isTemp) {
            return; // Don't allow moving locked tiles
        }
        
        const oldRow = parseInt(draggable.attr('data-row'));
        const oldCol = parseInt(draggable.attr('data-col'));
        
        if (oldRow === row && oldCol === col) return; // Same cell
        
        // Remove from old position
        board[oldRow][oldCol] = null;
        const oldCoordKey = `${oldRow},${oldCol}`;
        tempTiles.delete(oldCoordKey); // Remove from TEMP set
        
        draggable.detach();
        
        // Place on new position (keep TEMP status)
        board[row][col] = letter;
        const newCoordKey = `${row},${col}`;
        tempTiles.add(newCoordKey); // Add to TEMP set
        draggable.attr('data-row', row).attr('data-col', col);
        // Ensure data-temp="true" attribute is preserved
        if (!draggable.attr('data-temp')) {
            draggable.attr('data-temp', 'true');
        }
        cell.append(draggable);
        
        if (tileId && tileData[tileId]) {
            tileData[tileId].row = row;
            tileData[tileId].col = col;
            tileData[tileId].isTemp = true;
        }
        
        // Don't save to Firestore here - only save at end of turn
    }
    
    // Re-render board
    renderBoard();
}

// Convert board array to Firestore map format
function boardToMap(boardArray) {
    const boardMap = {};
    const size = boardArray.length;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (boardArray[r] && boardArray[r][c]) {
                boardMap[`${r},${c}`] = boardArray[r][c];
            }
        }
    }
    return boardMap;
}

// Save board state to Firestore
async function saveBoardState() {
    try {
        const boardMap = boardToMap(board);
        await updateBoard(boardMap);
    } catch (error) {
        console.error('Error saving board:', error);
    }
}

// Update letter stock display
function updateLetterStock() {
    const stock = $('#letterStock');
    stock.empty();
    
    // Remove any inline styles - CSS handles the layout
    stock.css({
        display: '',
        gridTemplateColumns: '',
        gap: '',
        maxWidth: '',
        margin: ''
    });
    
    currentPlayerLetters.forEach((letter, index) => {
        const tile = $('<div>')
            .addClass('letter-tile')
            .text(letter)
            .attr('data-letter', letter);
            // CSS is handled by .letter-tile class in style.css
        
        makeDraggable(tile);
        stock.append(tile);
    });
    
    // Make stock droppable
    stock.droppable({
        accept: '.letter-tile',
        tolerance: 'pointer',
        drop: function(event, ui) {
            handleDropToStock($(this), ui.draggable);
        }
    });
}

// Handle drop to stock
function handleDropToStock(stock, draggable) {
    if (!isMyTurn) return;
    
    // Only allow returning TEMP tiles to stock
    const isTemp = draggable.attr('data-temp') === 'true';
    if (!isTemp) {
        return; // Don't allow returning locked tiles
    }
    
    const letter = draggable.attr('data-letter');
    const row = parseInt(draggable.attr('data-row'));
    const col = parseInt(draggable.attr('data-col'));
    
    // Remove from board
    board[row][col] = null;
    const coordKey = `${row},${col}`;
    tempTiles.delete(coordKey); // Remove from TEMP set
    draggable.remove();
    
    // Add back to letters
    currentPlayerLetters.push(letter);
    
    // Don't save to Firestore here - only save at end of turn
    updateLetterStock();
    renderBoard();
}

// Save board state at the start of current turn
function saveBoardAtTurnStart() {
    // Deep copy the board array
    boardAtTurnStart = board.map(row => row ? [...row] : null);
}

// Render board (recreate grid)
function renderBoard() {
    initializeBoard();
}

// Convert final letters to sofit forms
function convertFinalLetter(word) {
    if (word.length === 0) return word;
    
    const finalLetterMap = {
        'כ': 'ך',
        'נ': 'ן',
        'מ': 'ם',
        'פ': 'ף',
        'צ': 'ץ'
    };
    
    const lastChar = word[word.length - 1];
    if (finalLetterMap[lastChar]) {
        return word.slice(0, -1) + finalLetterMap[lastChar];
    }
    
    return word;
}

// Extract words from a board array
function extractWordsFromBoard(boardArray) {
    const words = [];
    
    // Extract horizontal words (right to left for Hebrew)
    for (let row = 0; row < 10; row++) {
        let currentWord = '';
        for (let col = 9; col >= 0; col--) {
            if (boardArray[row] && boardArray[row][col]) {
                currentWord += boardArray[row][col];
            } else {
                if (currentWord.length >= 2) {
                    // Reverse for dictionary lookup (Hebrew RTL)
                    let reversedWord = currentWord.split('').reverse().join('');
                    reversedWord = convertFinalLetter(reversedWord);
                    words.push(reversedWord);
                }
                currentWord = '';
            }
        }
        if (currentWord.length >= 2) {
            let reversedWord = currentWord.split('').reverse().join('');
            reversedWord = convertFinalLetter(reversedWord);
            words.push(reversedWord);
        }
    }
    
    // Extract vertical words (top to bottom)
    for (let col = 0; col < 10; col++) {
        let currentWord = '';
        for (let row = 0; row < 10; row++) {
            if (boardArray[row] && boardArray[row][col]) {
                currentWord += boardArray[row][col];
            } else {
                if (currentWord.length >= 2) {
                    let word = convertFinalLetter(currentWord);
                    words.push(word);
                }
                currentWord = '';
            }
        }
        if (currentWord.length >= 2) {
            let word = convertFinalLetter(currentWord);
            words.push(word);
        }
    }
    
    return words;
}

// Extract words from current board
function extractWords() {
    return extractWordsFromBoard(board);
}

// Calculate score
function calculateScore(wordLength) {
    if (wordLength < 2) return 0;
    return (wordLength - 1) * 2;
}

// Validate and score only new words (not present at turn start)
function validateAndScore() {
    // Get words from current board
    const currentWords = extractWordsFromBoard(board);
    
    // Get words from board at turn start (if exists)
    const oldWords = boardAtTurnStart ? extractWordsFromBoard(boardAtTurnStart) : [];
    
    // Create sets for comparison
    const oldWordsSet = new Set(oldWords);
    
    // Find new words (words that exist now but didn't exist at turn start)
    const newWords = currentWords.filter(word => !oldWordsSet.has(word));
    
    // Validate and score only new words
    let totalScore = 0;
    const validWords = [];
    const invalidWords = [];
    const allNewWords = []; // All new words with their status
    
    // Use Set to avoid duplicate words
    const seenWords = new Set();
    
    newWords.forEach(word => {
        if (!seenWords.has(word)) {
            seenWords.add(word);
            if (dictionary.has(word)) {
                const score = calculateScore(word.length);
                totalScore += score;
                validWords.push({ word, score });
                allNewWords.push({ word, isValid: true, score });
            } else {
                invalidWords.push(word);
                allNewWords.push({ word, isValid: false });
            }
        }
    });
    
    return { totalScore, validWords, invalidWords, allNewWords };
}

// Finish turn
async function finishTurnHandler() {
    if (!isMyTurn || !currentGame) return;
    
    if (dictionary.size === 0) {
        alert('מילון עדיין נטען...');
        return;
    }
    
    const result = validateAndScore();
    
    // Check if there are invalid words (not in dictionary)
    if (result.invalidWords && result.invalidWords.length > 0) {
        showInvalidWordsDialog(result);
        return;
    }
    
    const user = getCurrentUser();
    
    // Update scores
    let player1Score = currentGame.player1Score || 0;
    let player2Score = currentGame.player2Score || 0;
    
    if (currentGame.player1 === user.uid) {
        player1Score += result.totalScore;
    } else {
        player2Score += result.totalScore;
    }
    
    // Keep unused letters and add new ones to reach 8
    const unusedCount = currentPlayerLetters.length;
    const needed = 8 - unusedCount;
    const newLetters = generateRandomLetters(needed);
    const updatedLetters = [...currentPlayerLetters, ...newLetters];
    
    // Update player letters
    let player1Letters = currentGame.player1Letters || [];
    let player2Letters = currentGame.player2Letters || [];
    
    if (currentGame.player1 === user.uid) {
        player1Letters = updatedLetters;
    } else {
        player2Letters = updatedLetters;
    }
    
    // Switch turn
    const newCurrentTurn = currentGame.player1 === user.uid ? 
        currentGame.player2 : currentGame.player1;
    
    // Lock all TEMP tiles before saving (remove data-temp attribute and clear TEMP set)
    $('.letter-tile[data-temp="true"]').each(function() {
        $(this).removeAttr('data-temp');
        const tileId = $(this).attr('data-tile-id');
        if (tileId && tileData[tileId]) {
            tileData[tileId].isTemp = false;
        }
    });
    tempTiles.clear(); // Clear all TEMP tiles - they're now locked
    
    // Save to Firestore
    try {
        const boardMap = boardToMap(board);
        await finishTurn(
            boardMap,
            player1Letters,
            player2Letters,
            player1Score,
            player2Score,
            newCurrentTurn
        );
        
        // Re-render board to show locked tiles (without draggable)
        renderBoard();
        
        // Show results
        showTurnResults(result);
    } catch (error) {
        console.error('Error finishing turn:', error);
        alert('שגיאה בשמירת התור');
    }
}

// Show invalid words dialog (prevents finishing turn)
function showInvalidWordsDialog(result) {
    let dialogHtml = '<div class="results-dialog">';
    dialogHtml += '<h2>לא ניתן לסיים את התור</h2>';
    dialogHtml += '<p style="margin-bottom: 15px; color: #DD4425; font-weight: 700;">יש מילים לא מוכרות במילון:</p>';
    dialogHtml += '<div class="words-list">';
    
    // Show all new words with ✓ or ✗
    result.allNewWords.forEach(item => {
        if (item.isValid) {
            dialogHtml += `<div class="word-item valid">✓ ${item.word} - ${item.score} נקודות</div>`;
        } else {
            dialogHtml += `<div class="word-item invalid">✗ ${item.word} - לא במילון</div>`;
        }
    });
    
    dialogHtml += '</div>';
    dialogHtml += '<p style="margin-top: 15px; color: #666; text-align: center;">אנא תקן את המילים המסומנות ב-✗ לפני סיום התור</p>';
    dialogHtml += '<button class="close-dialog-btn">סגור</button>';
    dialogHtml += '</div>';
    
    const overlay = $('<div>').addClass('dialog-overlay');
    const dialog = $(dialogHtml);
    overlay.append(dialog);
    $('body').append(overlay);
    
    $('.close-dialog-btn').on('click', function() {
        overlay.remove();
    });
}

// Show turn results
function showTurnResults(result) {
    let dialogHtml = '<div class="results-dialog">';
    dialogHtml += '<h2>תוצאות התור</h2>';
    dialogHtml += '<div class="words-list">';
    
    if (result.validWords.length === 0) {
        dialogHtml += '<p>לא נמצאו מילים תקניות</p>';
    } else {
        result.validWords.forEach(item => {
            dialogHtml += `<div class="word-item valid">✓ ${item.word} - ${item.score} נקודות</div>`;
        });
    }
    
    dialogHtml += '</div>';
    dialogHtml += `<div class="total-score">סה"כ: ${result.totalScore} נקודות</div>`;
    dialogHtml += '<button class="close-dialog-btn">סגור</button>';
    dialogHtml += '</div>';
    
    const overlay = $('<div>').addClass('dialog-overlay');
    const dialog = $(dialogHtml);
    overlay.append(dialog);
    $('body').append(overlay);
    
    $('.close-dialog-btn').on('click', function() {
        overlay.remove();
    });
}

// Open game
window.openGame = function(gameId) {
    $('#gameListScreen').addClass('hidden');
    $('#gameScreen').removeClass('hidden');
    
    // Subscribe to game updates
    subscribeToGame(gameId, (gameData) => {
        if (!gameData) {
            alert('המשחק לא נמצא');
            showGameListScreen();
            return;
        }
        
        currentGame = gameData;
        const user = getCurrentUser();
        
        // Update title with player names and scores
        const player1Name = gameData.player1Name || 'שחקן 1';
        const player2Name = gameData.player2Name || 'שחקן 2';
        const score1 = gameData.player1Score || 0;
        const score2 = gameData.player2Score || 0;
        
        // Determine which is "me" and which is opponent
        const myName = gameData.player1 === user.uid ? player1Name : player2Name;
        const myScore = gameData.player1 === user.uid ? score1 : score2;
        const opponentName = gameData.player1 === user.uid ? player2Name : player1Name;
        const opponentScore = gameData.player1 === user.uid ? score2 : score1;
        
        // Format: "Tamir (6) <> Adi (12)"
        const titleHtml = `
            <div class="text-sm">
                <span class="font-bold text-gray-800">${myName}</span>
                <span class="text-gray-500 font-normal">(${myScore})</span>
                <span class="text-gray-400 mx-1">&lt;&gt;</span>
                <span class="font-bold text-gray-900">${opponentName}</span>
                <span class="text-gray-500 font-normal">(${opponentScore})</span>
            </div>
        `;
        $('#gameTitle').html(titleHtml);
        
        // Check if it's my turn (before updating)
        const wasMyTurn = isMyTurn;
        isMyTurn = gameData.currentTurn === user.uid && gameData.status === 'active';
        
        // Update turn indicator banner
        if (gameData.status === 'waiting') {
            $('#turnIndicatorBanner').text('ממתין לשחקן שני').show();
        } else if (isMyTurn) {
            // Hide the banner when it's my turn - only show the finish turn button
            $('#turnIndicatorBanner').hide();
        } else {
            $('#turnIndicatorBanner').text('ממתין ליריב').show();
        }
        
        // Convert board from coordinate map to 10x10 array
        board = Array(10).fill(null).map(() => Array(10).fill(null));
        if (gameData.board) {
            // If board is a coordinate map, convert it
            if (typeof gameData.board === 'object' && !Array.isArray(gameData.board)) {
                Object.keys(gameData.board).forEach(key => {
                    const [row, col] = key.split(',').map(Number);
                    if (row >= 0 && row < 10 && col >= 0 && col < 10) {
                        board[row][col] = gameData.board[key];
                    }
                });
            } else if (Array.isArray(gameData.board)) {
                // Already an array
                board = gameData.board;
            }
        }
        
        // Save board state at turn start if it's my turn
        if (isMyTurn && !wasMyTurn) {
            // Turn just switched to me - save current board state and clear TEMP tiles
            tempTiles.clear(); // Clear any old TEMP tiles
            saveBoardAtTurnStart();
        } else if (isMyTurn && boardAtTurnStart === null) {
            // Already my turn but board state not saved (e.g., just opened game)
            tempTiles.clear(); // Clear any old TEMP tiles
            saveBoardAtTurnStart();
        } else if (!isMyTurn) {
            // Not my turn - clear saved state and TEMP tiles
            boardAtTurnStart = null;
            tempTiles.clear();
        }
        
        renderBoard();
        
        // Update letters
        if (gameData.player1 === user.uid) {
            currentPlayerLetters = [...(gameData.player1Letters || [])];
        } else if (gameData.player2 === user.uid) {
            currentPlayerLetters = [...(gameData.player2Letters || [])];
        }
        
        // Initialize letters if empty and it's my turn
        if (currentPlayerLetters.length === 0 && isMyTurn && gameData.status === 'active') {
            currentPlayerLetters = generateRandomLetters(8);
            // Save to Firestore
            const player1Letters = gameData.player1 === user.uid ? 
                currentPlayerLetters : (gameData.player1Letters || []);
            const player2Letters = gameData.player2 === user.uid ? 
                currentPlayerLetters : (gameData.player2Letters || []);
            
            // Update player letters in Firestore
            updateGameState({
                player1Letters,
                player2Letters
            });
        }
        
        // Show/hide letters and finish button based on turn
        if (isMyTurn && gameData.status === 'active') {
            $('#letterStockContainer').removeClass('hidden');
            $('#finishTurnContainer').removeClass('hidden');
            updateLetterStock();
        } else {
            $('#letterStockContainer').addClass('hidden');
            $('#finishTurnContainer').addClass('hidden');
        }
    });
};

// Initialize app
// Wait for jQuery to be available
function initApp() {
    if (typeof $ === 'undefined') {
        // jQuery not loaded yet, wait a bit and try again
        setTimeout(initApp, 50);
        return;
    }
    
    $(document).ready(async function() {
        console.log('Document ready, initializing app...');
        
        // Load dictionary
        await loadDictionary();
        
        // Show login screen initially if not authenticated (before auth state listener)
        const initialUser = getCurrentUser();
        if (!initialUser) {
            console.log('No initial user, showing login screen');
            showLoginScreen();
        }
    
    // Set up event handlers
    $('#logoutBtn').on('click', async () => {
        $('#userMenu').addClass('hidden');
        await signOutUser();
    });
    
    // Toggle user menu
    $('#userNameBtn').on('click', function(e) {
        e.stopPropagation();
        $('#userMenu').toggleClass('hidden');
    });
    
    // Close menu when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#userNameBtn, #userMenu').length) {
            $('#userMenu').addClass('hidden');
        }
    });
    
    $('#newGameBtn').on('click', () => {
        $('#gameListScreen').addClass('hidden');
        $('#newGameScreen').removeClass('hidden');
    });
    
    $('#backToGamesBtn').on('click', () => {
        $('#newGameScreen').addClass('hidden');
        showGameListScreen();
    });
    
    $('#backToGamesFromGameBtn').on('click', async () => {
        unsubscribeFromGame();
        $('#gameScreen').addClass('hidden');
        const { cleanupGameList } = await import('./gameList.js');
        cleanupGameList();
        showGameListScreen();
    });
    
    $('#sendInviteBtn').on('click', async () => {
        const email = $('#inviteEmail').val().trim();
        if (!email) {
            alert('אנא הזן כתובת אימייל');
            return;
        }
        
        try {
            $('#sendInviteBtn').prop('disabled', true).text('שולח...');
            await createGameAndInvite(email);
            alert('הזמנה נשלחה בהצלחה!');
            $('#newGameScreen').addClass('hidden');
            showGameListScreen();
        } catch (error) {
            console.error('Error creating game:', error);
            alert('שגיאה ביצירת המשחק');
        } finally {
            $('#sendInviteBtn').prop('disabled', false).text('שלח הזמנה');
        }
    });
    
    $('#finishTurnBtn').on('click', finishTurnHandler);
    
    // Check for pending invitations on login
    onAuthStateChange(async (user) => {
        if (user) {
            // Show only first word of display name
            const fullName = user.displayName || 'משתמש';
            const firstName = fullName.split(' ')[0];
            $('#userDisplayName').text(firstName);
            
            // Show game list immediately - don't block on invitation check
            showGameListScreen();
            
            // Invitations will be shown in the game list, no need to check here
        } else {
            showLoginScreen();
        }
    });
    });
}

// Start initialization
initApp();
