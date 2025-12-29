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
let letterStock = []; // Array of tile IDs
let scores = [];
let dictionary = new Set();
let tileIdCounter = 0; // Counter for unique tile IDs
let tileData = {}; // Map of tileId -> {letter, element}

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
    // letterStock will be populated in initializeLetterStock with tile IDs
    
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

// Find the closest grid cell to the dragged element
function findClosestCell(dragX, dragY) {
    let closestCell = null;
    let minDistance = Infinity;
    
    $('.grid-cell').each(function() {
        const $cell = $(this);
        const cellOffset = $cell.offset();
        const cellWidth = $cell.outerWidth();
        const cellHeight = $cell.outerHeight();
        
        // Calculate center of cell
        const cellCenterX = cellOffset.left + cellWidth / 2;
        const cellCenterY = cellOffset.top + cellHeight / 2;
        
        // Calculate distance from drag position to cell center
        const distance = Math.sqrt(
            Math.pow(dragX - cellCenterX, 2) + 
            Math.pow(dragY - cellCenterY, 2)
        );
        
        // Check if drag position is within cell bounds (with some tolerance)
        const tolerance = Math.max(cellWidth, cellHeight) * 0.8;
        if (distance < tolerance && distance < minDistance) {
            minDistance = distance;
            closestCell = $cell;
        }
    });
    
    return closestCell;
}

// Helper function to make elements draggable with touch support
function makeDraggable($element) {
    let closestCell = null;
    
    $element.draggable({
        revert: 'invalid',
        cursor: 'move',
        distance: 10, // Require small movement to start drag (distinguish from sortable)
        delay: 0, // No delay for touch
        scroll: false, // Prevent page scrolling during drag
        helper: function() {
            return $(this);
        },
        start: function(event, ui) {
            const $tile = $(this);
            const isInStock = $tile.parent().hasClass('letter-stock');
            
            // Store if we started from stock
            if (isInStock) {
                $tile.data('was-in-stock', true);
                $tile.parent().sortable('disable');
            }
            
            // Prevent default touch behaviors
            if (event.originalEvent && event.originalEvent.touches) {
                event.originalEvent.preventDefault();
            }
            
            if (isInStock) {
                $tile.css('opacity', '0.5');
            }
            // Prevent body scroll during drag
            $('body').css('overflow', 'hidden');
            // Add visual feedback
            $tile.addClass('dragging');
            // Clear any existing highlights
            $('.grid-cell').removeClass('ui-droppable-hover');
            closestCell = null;
        },
        drag: function(event, ui) {
            // Prevent default touch behaviors during drag
            if (event.originalEvent && event.originalEvent.touches) {
                event.originalEvent.preventDefault();
            }
            
            const $tile = $(this);
            const isInStock = $tile.parent().hasClass('letter-stock');
            
            // If dragging from stock and still within stock area, cancel draggable and let sortable handle it
            if (isInStock) {
                const $letterStock = $('#letterStock');
                const stockOffset = $letterStock.offset();
                const stockWidth = $letterStock.outerWidth();
                const stockHeight = $letterStock.outerHeight();
                
                const pageX = event.pageX || (event.originalEvent.touches && event.originalEvent.touches[0].pageX);
                const pageY = event.pageY || (event.originalEvent.touches && event.originalEvent.touches[0].pageY);
                
                const isOverStock = pageX >= stockOffset.left && 
                                   pageX <= stockOffset.left + stockWidth &&
                                   pageY >= stockOffset.top && 
                                   pageY <= stockOffset.top + stockHeight;
                
                // If still over stock, this should be handled by sortable, not draggable
                // But we'll let it continue and handle in stop
            }
            
            // Calculate position of dragged element
            const dragX = ui.position.left + ui.helper.outerWidth() / 2;
            const dragY = ui.position.top + ui.helper.outerHeight() / 2;
            
            // Convert to page coordinates
            const $helper = ui.helper;
            const helperOffset = $helper.offset();
            const pageX = helperOffset.left + $helper.outerWidth() / 2;
            const pageY = helperOffset.top + $helper.outerHeight() / 2;
            
            // Check if over letter stock
            const $letterStock = $('#letterStock');
            const stockOffset = $letterStock.offset();
            const stockWidth = $letterStock.outerWidth();
            const stockHeight = $letterStock.outerHeight();
            const isOverStock = pageX >= stockOffset.left && 
                               pageX <= stockOffset.left + stockWidth &&
                               pageY >= stockOffset.top && 
                               pageY <= stockOffset.top + stockHeight;
            
            if (isOverStock) {
                // Highlight stock instead of cells
                if (closestCell) {
                    closestCell.removeClass('ui-droppable-hover');
                    closestCell = null;
                }
                $letterStock.addClass('ui-droppable-hover');
            } else {
                // Remove stock highlight
                $letterStock.removeClass('ui-droppable-hover');
                
                // Find closest cell
                const newClosestCell = findClosestCell(pageX, pageY);
                
                // Update highlight
                if (newClosestCell !== closestCell) {
                    // Remove highlight from previous cell
                    if (closestCell) {
                        closestCell.removeClass('ui-droppable-hover');
                    }
                    // Add highlight to new closest cell
                    if (newClosestCell) {
                        newClosestCell.addClass('ui-droppable-hover');
                    }
                    closestCell = newClosestCell;
                }
            }
        },
        stop: function(event, ui) {
            const $tile = $(this);
            const wasInStock = $tile.data('was-in-stock') || $tile.parent().hasClass('letter-stock');
            const $letterStock = $('#letterStock');
            
            // Check if dropped back into stock
            const stockOffset = $letterStock.offset();
            const stockWidth = $letterStock.outerWidth();
            const stockHeight = $letterStock.outerHeight();
            const pageX = event.pageX || (event.originalEvent.touches && event.originalEvent.touches[0].pageX);
            const pageY = event.pageY || (event.originalEvent.touches && event.originalEvent.touches[0].pageY);
            const isOverStock = pageX >= stockOffset.left && 
                               pageX <= stockOffset.left + stockWidth &&
                               pageY >= stockOffset.top && 
                               pageY <= stockOffset.top + stockHeight;
            
            // If was in stock and dropped back in stock, rebuild to ensure grid positioning
            if (wasInStock && isOverStock && !$tile.parent().hasClass('grid-cell')) {
                // Re-enable sortable
                $letterStock.sortable('enable');
                // Rebuild stock to ensure proper grid positioning
                rebuildLetterStock();
                // Clear drag data
                $tile.removeData('was-in-stock');
                $tile.removeData('drag-start-pos');
                return;
            }
            
            // Re-enable sortable if we were dragging from stock
            if (wasInStock) {
                $letterStock.sortable('enable');
            }
            
            // Remove highlight from closest cell
            if (closestCell) {
                closestCell.removeClass('ui-droppable-hover');
                closestCell = null;
            }
            // Clear all highlights
            $('.grid-cell').removeClass('ui-droppable-hover');
            $('#letterStock').removeClass('ui-droppable-hover');
            // Restore body scroll
            $('body').css('overflow', '');
            // Remove visual feedback
            $tile.removeClass('dragging');
            // Clear drag data
            $tile.removeData('was-in-stock');
            $tile.removeData('drag-start-pos');
            // If revert happened, restore opacity
            if (wasInStock && $tile.parent().hasClass('letter-stock')) {
                $tile.css('opacity', '1');
            }
        }
    });
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
    
    // Make grid cells droppable (touch-optimized)
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
    letterStock = []; // Reset stock array
    tileData = {}; // Reset tile data
    tileIdCounter = 0; // Reset counter
    
    letters.forEach((letter) => {
        const { tile, tileId } = createLetterTile(letter);
        letterStock.push(tileId);
        letterStockContainer.append(tile);
    });
    
    // Make letter stock sortable to maintain order and 2-row grid
    letterStockContainer.sortable({
        items: '.letter-tile',
        tolerance: 'pointer',
        cursor: 'move',
        distance: 5, // Small distance to prevent accidental sorting
        delay: 50, // Small delay to distinguish from drag-to-board
        containment: 'parent',
        grid: [48, 48], // Snap to grid (48px tiles)
        forcePlaceholderSize: true,
        placeholder: 'letter-tile-placeholder',
        start: function(event, ui) {
            // When starting to sort, temporarily disable draggable to prevent conflicts
            ui.item.draggable('disable');
        },
        stop: function(event, ui) {
            // Re-enable draggable after sorting
            ui.item.draggable('enable');
        },
        update: function(event, ui) {
            // Update letterStock array to match new order (using tile IDs)
            letterStock = [];
            letterStockContainer.find('.letter-tile').each(function() {
                const tileId = $(this).attr('data-tile-id');
                if (tileId) {
                    letterStock.push(tileId);
                }
            });
        }
    });
    
    // Make letter stock droppable (so letters can be dragged back from board)
    letterStockContainer.droppable({
        accept: '.letter-tile',
        tolerance: 'pointer',
        drop: function(event, ui) {
            handleDropToStock($(this), ui.draggable);
        }
    });
    
    // Make letter tiles draggable (touch-optimized) - for dragging to board
    makeDraggable($('.letter-tile'));
}

// Get color for letter tile (same color for all)
function getLetterColor(letter) {
    return '#333333'; // Same color for all letters
}

// Create a letter tile with unique ID
function createLetterTile(letter) {
    const tileId = `tile-${tileIdCounter++}`;
    const tile = $('<div>')
        .addClass('letter-tile')
        .text(letter)
        .attr('data-letter', letter)
        .attr('data-tile-id', tileId)
        .css('background-color', getLetterColor(letter));
    
    // Store tile data
    tileData[tileId] = {
        letter: letter,
        element: tile
    };
    
    return { tile, tileId };
}

// Rebuild letter stock display to maintain 2-row grid
function rebuildLetterStock() {
    const letterStockContainer = $('#letterStock');
    letterStockContainer.empty();
    
    // Recreate all tiles in order from letterStock array (which contains tile IDs)
    letterStock.forEach((tileId) => {
        const tileInfo = tileData[tileId];
        if (tileInfo) {
            // Recreate the tile element
            const tile = $('<div>')
                .addClass('letter-tile')
                .text(tileInfo.letter)
                .attr('data-letter', tileInfo.letter)
                .attr('data-tile-id', tileId)
                .css('background-color', getLetterColor(tileInfo.letter));
            
            // Update tile data
            tileData[tileId].element = tile;
            letterStockContainer.append(tile);
        }
    });
    
    // Re-initialize sortable to maintain order and 2-row grid
    letterStockContainer.sortable({
        items: '.letter-tile',
        tolerance: 'pointer',
        cursor: 'move',
        distance: 5,
        delay: 50,
        containment: 'parent',
        grid: [48, 48], // Snap to grid (48px tiles)
        forcePlaceholderSize: true,
        placeholder: 'letter-tile-placeholder',
        start: function(event, ui) {
            // When starting to sort, temporarily disable draggable to prevent conflicts
            ui.item.draggable('disable');
        },
        stop: function(event, ui) {
            // Re-enable draggable after sorting
            ui.item.draggable('enable');
        },
        update: function(event, ui) {
            // Update letterStock array to match new order (using tile IDs)
            letterStock = [];
            letterStockContainer.find('.letter-tile').each(function() {
                const tileId = $(this).attr('data-tile-id');
                if (tileId) {
                    letterStock.push(tileId);
                }
            });
        }
    });
    
    // Re-initialize droppable on stock container
    letterStockContainer.droppable({
        accept: '.letter-tile',
        tolerance: 'pointer',
        drop: function(event, ui) {
            handleDropToStock($(this), ui.draggable);
        }
    });
    
    // Make all letter tiles draggable again (for dragging to board)
    makeDraggable($('.letter-tile'));
}

// Handle drop to letter stock
function handleDropToStock(stockContainer, draggable) {
    const tileId = draggable.attr('data-tile-id');
    
    if (!tileId || !tileData[tileId]) {
        return; // Invalid tile
    }
    
    // Check if tile is already in stock DOM (shouldn't happen, but safety check)
    if (draggable.parent().hasClass('letter-stock')) {
        return; // Already in stock
    }
    
    // Remove from board if it was on the board
    const oldRow = parseInt(draggable.attr('data-row'));
    const oldCol = parseInt(draggable.attr('data-col'));
    if (oldRow !== undefined && oldCol !== undefined) {
        board[oldRow][oldCol] = null;
        draggable.removeAttr('data-row').removeAttr('data-col');
    }
    
    // Remove the dragged tile from DOM before rebuilding to prevent duplicates
    draggable.detach();
    
    // Check if tile ID is already in stock array - if not, add it
    // This prevents duplicates in the array
    const tileIndex = letterStock.indexOf(tileId);
    if (tileIndex === -1) {
        letterStock.push(tileId);
    }
    // If tile already exists in array, don't add it again (prevents duplicates)
    
    // Rebuild the entire stock to maintain proper 2-row grid
    // This will recreate all tiles from the letterStock array
    rebuildLetterStock();
}

// Handle drop event
function handleDrop(cell, draggable) {
    const tileId = draggable.attr('data-tile-id');
    const letter = draggable.attr('data-letter');
    
    if (!tileId || !tileData[tileId]) {
        return; // Invalid tile
    }
    
    const row = parseInt(cell.attr('data-row'));
    const col = parseInt(cell.attr('data-col'));
    
    // Check if dropping on the same cell (prevent duplication)
    const draggableRow = parseInt(draggable.attr('data-row'));
    const draggableCol = parseInt(draggable.attr('data-col'));
    if (draggableRow !== undefined && draggableCol !== undefined && 
        draggableRow === row && draggableCol === col) {
        // Dropping on the same cell - do nothing
        return;
    }
    
    // Check if cell already has a letter
    const existingTile = cell.find('.letter-tile');
    if (existingTile.length > 0) {
        // Swap letters
        const existingTileId = existingTile.attr('data-tile-id');
        const existingLetter = existingTile.attr('data-letter');
        
        // Remove existing tile from board
        existingTile.remove();
        board[row][col] = null;
        
        // Check if draggable is from stock or board
        const isFromStock = draggable.parent().hasClass('letter-stock');
        
        if (isFromStock) {
            // Remove from stock array (using tile ID)
            const stockIndex = letterStock.indexOf(tileId);
            if (stockIndex > -1) {
                letterStock.splice(stockIndex, 1);
            }
            
            // Add placeholder to maintain position in stock
            const placeholder = $('<div>')
                .addClass('letter-placeholder')
                .css({
                    width: '100%',
                    height: '100%',
                    minHeight: '48px',
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
            board[row][col] = tileId; // Store tile ID in board
            
            // Make tile draggable for repositioning
            makeDraggable(draggable);
            
            // Place existing letter back in stock (maintain position)
            // Use existing tile's ID if it exists, otherwise create new one
            if (existingTileId && tileData[existingTileId]) {
                const existingTileElement = $('<div>')
                    .addClass('letter-tile')
                    .text(existingLetter)
                    .attr('data-letter', existingLetter)
                    .attr('data-tile-id', existingTileId)
                    .css('background-color', getLetterColor(existingLetter));
                tileData[existingTileId].element = existingTileElement;
                placeholder.before(existingTileElement);
                placeholder.remove();
                
                // Add back to stock array if not already there
                if (letterStock.indexOf(existingTileId) === -1) {
                    letterStock.push(existingTileId);
                }
                
                // Make existing tile draggable
                makeDraggable(existingTileElement);
            }
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
            board[row][col] = tileId; // Store tile ID in board
            
            // Place existing letter in old cell
            const oldCell = $(`.grid-cell[data-row="${oldRow}"][data-col="${oldCol}"]`);
            if (existingTileId && tileData[existingTileId]) {
                const oldTile = $('<div>')
                    .addClass('letter-tile')
                    .text(existingLetter)
                    .attr('data-letter', existingLetter)
                    .attr('data-tile-id', existingTileId)
                    .attr('data-row', oldRow)
                    .attr('data-col', oldCol)
                    .css('background-color', getLetterColor(existingLetter));
                tileData[existingTileId].element = oldTile;
                oldCell.append(oldTile);
                board[oldRow][oldCol] = existingTileId; // Store tile ID
                makeDraggable(oldTile);
            }
        }
        
        return;
    }
    
    // Check if letter is from stock
    const isFromStock = draggable.parent().hasClass('letter-stock');
    
    if (isFromStock) {
        // Remove from stock array (using tile ID)
        const stockIndex = letterStock.indexOf(tileId);
        if (stockIndex > -1) {
            letterStock.splice(stockIndex, 1);
        }
        
        // Add placeholder to maintain position in stock
        const placeholder = $('<div>')
            .addClass('letter-placeholder')
                .css({
                    width: '100%',
                    height: '100%',
                    minHeight: '48px',
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
        board[row][col] = tileId; // Store tile ID in board
        
        // Make tile draggable for repositioning
        makeDraggable(draggable);
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
        board[row][col] = tileId; // Store tile ID in board
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
            const tileId = board[row][col];
            if (tileId && tileData[tileId]) {
                currentWord += tileData[tileId].letter;
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
            const tileId = board[row][col];
            if (tileId && tileData[tileId]) {
                currentWord += tileData[tileId].letter;
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

