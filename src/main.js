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
let letters = []; // Will be generated based on date
let board = Array(7).fill(null).map(() => Array(7).fill(null));
let letterStock = [];
let scores = [];
let dictionary = new Set();

// Seeded random number generator
function seededRandom(seed) {
    let value = seed;
    return function() {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

// Generate letters based on date and distribution
function generateLettersForDate() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // getMonth() returns 0-11
    const year = today.getFullYear();
    
    // Create seed from date
    const seed = day * 10000 + month * 100 + (year % 100);
    const random = seededRandom(seed);
    
    // Build cumulative distribution
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
    
    // Select 12 letters
    const selectedLetters = [];
    for (let i = 0; i < 12; i++) {
        const rand = random();
        // Find which letter this random value corresponds to
        let selected = cumulative[cumulative.length - 1].letter; // Default to last letter
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

// Initialize game
$(document).ready(function() {
    // Generate letters based on today's date
    letters = generateLettersForDate();
    letterStock = [...letters];
    
    loadDictionary();
    initializeBoard();
    initializeLetterStock();
});

// Load dictionary from file
async function loadDictionary() {
    try {
        const response = await fetch('public/dictionary.txt');
        const text = await response.text();
        const words = text.split('\n').map(word => word.trim()).filter(word => word.length > 0);
        words.forEach(word => dictionary.add(word));
        console.log(`Loaded ${dictionary.size} words from dictionary`);
    } catch (error) {
        console.error('Error loading dictionary:', error);
    }
}

// Initialize 7x7 game board
function initializeBoard() {
    const gameBoard = $('#gameBoard');
    gameBoard.empty();
    
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
            const cell = $('<div>')
                .addClass('grid-cell')
                .attr('data-row', row)
                .attr('data-col', col);
            gameBoard.append(cell);
        }
    }
    
    // Make grid cells droppable
    $('.grid-cell').droppable({
        accept: '.letter-tile',
        tolerance: 'pointer',
        drop: function(event, ui) {
            handleDrop($(this), ui.draggable);
        }
    });
}

// Initialize letter stock (2 rows of 6)
function initializeLetterStock() {
    const letterStockContainer = $('#letterStock');
    letterStockContainer.empty();
    
    letterStock.forEach((letter, index) => {
        const tile = $('<div>')
            .addClass('letter-tile')
            .text(letter)
            .attr('data-letter', letter)
            .attr('data-index', index)
            .css('background-color', getLetterColor(letter));
        
        letterStockContainer.append(tile);
    });
    
    // Make letter tiles draggable
    $('.letter-tile').draggable({
        revert: 'invalid',
        cursor: 'move',
        helper: function() {
            // Return the actual element, not a clone
            return $(this);
        },
        start: function(event, ui) {
            // Store original position and make it invisible in stock
            const $tile = $(this);
            if ($tile.parent().hasClass('letter-stock')) {
                $tile.css('opacity', '0.5');
            }
        },
        stop: function(event, ui) {
            // If revert happened, restore opacity
            if ($(this).parent().hasClass('letter-stock')) {
                $(this).css('opacity', '1');
            }
        }
    });
}

// Get color for letter tile (same color for all)
function getLetterColor(letter) {
    return '#4ECDC4'; // Same color for all letters
}

// Handle drop event
function handleDrop(cell, draggable) {
    const letter = draggable.attr('data-letter');
    const row = parseInt(cell.attr('data-row'));
    const col = parseInt(cell.attr('data-col'));
    
    // Check if cell already has a letter
    const existingTile = cell.find('.letter-tile');
    if (existingTile.length > 0) {
        // Swap letters
        const existingLetter = existingTile.attr('data-letter');
        
        // Remove existing tile from board
        existingTile.remove();
        board[row][col] = null;
        
        // Check if draggable is from stock or board
        const isFromStock = draggable.parent().hasClass('letter-stock');
        
        if (isFromStock) {
            // Remove from stock array
            const stockIndex = letterStock.indexOf(letter);
            if (stockIndex > -1) {
                letterStock.splice(stockIndex, 1);
            }
            
            // Add placeholder to maintain position in stock
            const placeholder = $('<div>')
                .addClass('letter-placeholder')
                .css({
                    width: '100%',
                    height: '100%',
                    minHeight: '40px',
                    visibility: 'hidden'
                });
            draggable.after(placeholder);
            
            // Move actual tile to board
            draggable.detach().css({
                position: 'relative',
                top: 'auto',
                left: 'auto',
                margin: '0',
                opacity: '1'
            });
            draggable.attr('data-row', row).attr('data-col', col);
            cell.append(draggable);
            board[row][col] = letter;
            
            // Make tile draggable for repositioning
            draggable.draggable({
                revert: 'invalid',
                cursor: 'move',
                helper: function() {
                    return $(this);
                }
            });
            
            // Place existing letter back in stock (maintain position)
            const existingTile = $('<div>')
                .addClass('letter-tile')
                .text(existingLetter)
                .attr('data-letter', existingLetter)
                .css('background-color', getLetterColor(existingLetter));
            placeholder.before(existingTile);
            placeholder.remove();
            
            // Make existing tile draggable
            existingTile.draggable({
                revert: 'invalid',
                cursor: 'move',
                helper: function() {
                    return $(this);
                },
                start: function(event, ui) {
                    if ($(this).parent().hasClass('letter-stock')) {
                        $(this).css('opacity', '0.5');
                    }
                },
                stop: function(event, ui) {
                    if ($(this).parent().hasClass('letter-stock')) {
                        $(this).css('opacity', '1');
                    }
                }
            });
        } else {
            // Moving from board to board - swap
            const oldRow = parseInt(draggable.attr('data-row'));
            const oldCol = parseInt(draggable.attr('data-col'));
            
            if (oldRow !== undefined && oldCol !== undefined) {
                board[oldRow][oldCol] = null;
            }
            
            // Move draggable to new cell
            draggable.detach().css({
                position: 'relative',
                top: 'auto',
                left: 'auto',
                margin: '0'
            });
            draggable.attr('data-row', row).attr('data-col', col);
            cell.append(draggable);
            board[row][col] = letter;
            
            // Place existing letter in old cell
            const oldCell = $(`.grid-cell[data-row="${oldRow}"][data-col="${oldCol}"]`);
            const oldTile = $('<div>')
                .addClass('letter-tile')
                .text(existingLetter)
                .attr('data-letter', existingLetter)
                .attr('data-row', oldRow)
                .attr('data-col', oldCol)
                .css('background-color', getLetterColor(existingLetter));
            oldCell.append(oldTile);
            board[oldRow][oldCol] = existingLetter;
            oldTile.draggable({
                revert: 'invalid',
                cursor: 'move',
                helper: function() {
                    return $(this);
                }
            });
        }
        
        return;
    }
    
    // Check if letter is from stock
    const isFromStock = draggable.parent().hasClass('letter-stock');
    
    if (isFromStock) {
        // Remove from stock array
        const stockIndex = letterStock.indexOf(letter);
        if (stockIndex > -1) {
            letterStock.splice(stockIndex, 1);
        }
        
        // Add placeholder to maintain position in stock
        const placeholder = $('<div>')
            .addClass('letter-placeholder')
            .css({
                width: '100%',
                height: '100%',
                minHeight: '40px',
                visibility: 'hidden'
            });
        draggable.after(placeholder);
        
        // Move actual tile (not clone) to board
        draggable.detach().css({
            position: 'relative',
            top: 'auto',
            left: 'auto',
            margin: '0',
            opacity: '1'
        });
        
        draggable.attr('data-row', row).attr('data-col', col);
        cell.append(draggable);
        board[row][col] = letter;
        
        // Make tile draggable for repositioning
        draggable.draggable({
            revert: 'invalid',
            cursor: 'move',
            helper: function() {
                return $(this);
            }
        });
    } else {
        // Moving from board to board
        const oldRow = parseInt(draggable.attr('data-row'));
        const oldCol = parseInt(draggable.attr('data-col'));
        
        if (oldRow !== undefined && oldCol !== undefined) {
            board[oldRow][oldCol] = null;
        }
        
        draggable.detach().css({
            position: 'relative',
            top: 'auto',
            left: 'auto',
            margin: '0'
        });
        
        draggable.attr('data-row', row).attr('data-col', col);
        cell.append(draggable);
        board[row][col] = letter;
    }
}

// Convert final letters to their sofit forms
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

// Extract all words from board
function extractWords() {
    const words = [];
    
    // Extract horizontal words (read right to left for Hebrew)
    for (let row = 0; row < 7; row++) {
        let currentWord = '';
        for (let col = 7; col >= 0; col--) {
            if (board[row][col]) {
                currentWord += board[row][col];
            } else {
                if (currentWord.length >= 2) {
                    // Reverse for dictionary lookup (Hebrew RTL)
                    let word = currentWord.split('').reverse().join('');
                    // Convert final letter to sofit form
                    word = convertFinalLetter(word);
                    words.push(word);
                }
                currentWord = '';
            }
        }
        if (currentWord.length >= 2) {
            let word = currentWord.split('').reverse().join('');
            // Convert final letter to sofit form
            word = convertFinalLetter(word);
            words.push(word);
        }
    }
    
    // Extract vertical words (top to bottom)
    for (let col = 0; col < 7; col++) {
        let currentWord = '';
        for (let row = 0; row < 7; row++) {
            if (board[row][col]) {
                currentWord += board[row][col];
            } else {
                if (currentWord.length >= 2) {
                    // Convert final letter to sofit form
                    let word = convertFinalLetter(currentWord);
                    words.push(word);
                }
                currentWord = '';
            }
        }
        if (currentWord.length >= 2) {
            // Convert final letter to sofit form
            let word = convertFinalLetter(currentWord);
            words.push(word);
        }
    }
    
    return words;
}

// Calculate score for a word
function calculateScore(wordLength) {
    if (wordLength < 2) return 0;
    return (wordLength - 1) * 2;
}

// Validate words and calculate score
function validateAndScore() {
    const words = extractWords();
    scores = [];
    let totalScore = 0;
    const validWords = [];
    const allWordsWithStatus = [];
    
    words.forEach(word => {
        if (dictionary.has(word)) {
            const score = calculateScore(word.length);
            scores.push(score);
            totalScore += score;
            validWords.push(word);
            allWordsWithStatus.push({ word, valid: true, score });
        } else {
            allWordsWithStatus.push({ word, valid: false, score: 0 });
        }
    });
    
    return { totalScore, validWords, scores, allWordsWithStatus };
}

// Finish button handler
$('#finishBtn').on('click', function() {
    if (dictionary.size === 0) {
        alert('מילון עדיין נטען...');
        return;
    }
    
    const result = validateAndScore();
    
    // Remove letter stock
    $('#letterStock').remove();
    
    // Remove finish button
    $('#finishBtn').remove();
    
    // Disable all letter movement
    $('.letter-tile').draggable('disable');
    $('.grid-cell').droppable('disable');
    
    // Create dialog with all words
    let dialogHtml = '<div class="results-dialog">';
    dialogHtml += '<h2>תוצאות המשחק</h2>';
    dialogHtml += '<div class="words-list">';
    
    if (result.allWordsWithStatus.length === 0) {
        dialogHtml += '<p>לא נמצאו מילים</p>';
    } else {
        result.allWordsWithStatus.forEach(item => {
            if (item.valid) {
                dialogHtml += `<div class="word-item valid">✓ ${item.word} - ${item.score} נקודות</div>`;
            } else {
                dialogHtml += `<div class="word-item invalid">✗ ${item.word}</div>`;
            }
        });
    }
    
    dialogHtml += '</div>';
    dialogHtml += `<div class="total-score">סה"כ: ${result.totalScore} נקודות</div>`;
    dialogHtml += '<button class="close-dialog-btn">סגור</button>';
    dialogHtml += '</div>';
    
    // Create overlay
    const overlay = $('<div>').addClass('dialog-overlay');
    const dialog = $(dialogHtml);
    overlay.append(dialog);
    $('body').append(overlay);
    
    // Close dialog handlers
    $('.close-dialog-btn').on('click', function() {
        overlay.remove();
    });
    
    overlay.on('click', function(e) {
        if (e.target === overlay[0]) {
            overlay.remove();
        }
    });
    
    // Prevent closing when clicking inside dialog
    dialog.on('click', function(e) {
        e.stopPropagation();
    });
    
    // Update score display
    const scoreDisplay = $('#scoreDisplay');
    scoreDisplay.html(`<p><strong>סה"כ: ${result.totalScore} נקודות</strong></p>`);
});

