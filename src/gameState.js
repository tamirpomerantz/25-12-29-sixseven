// Game state management and Firestore operations
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';

let currentGameId = null;
let gameUnsubscribe = null;
let gameStateListeners = [];

// Subscribe to game state changes
export function subscribeToGame(gameId, callback) {
  if (gameUnsubscribe) {
    gameUnsubscribe();
  }
  
  currentGameId = gameId;
  const gameRef = doc(db, 'games', gameId);
  
  gameUnsubscribe = onSnapshot(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      const gameData = { id: snapshot.id, ...snapshot.data() };
      callback(gameData);
      // Notify all listeners
      gameStateListeners.forEach(listener => listener(gameData));
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error listening to game:', error);
    callback(null);
  });
  
  return gameUnsubscribe;
}

// Unsubscribe from game updates
export function unsubscribeFromGame() {
  if (gameUnsubscribe) {
    gameUnsubscribe();
    gameUnsubscribe = null;
  }
  currentGameId = null;
}

// Get current game ID
export function getCurrentGameId() {
  return currentGameId;
}

// Update game state
export async function updateGameState(updates) {
  if (!currentGameId) {
    throw new Error('No game selected');
  }
  
  const gameRef = doc(db, 'games', currentGameId);
  await updateDoc(gameRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

// Update board
export async function updateBoard(board) {
  await updateGameState({ board });
}

// Update player letters
export async function updatePlayerLetters(player1Letters, player2Letters) {
  await updateGameState({
    player1Letters,
    player2Letters
  });
}

// Finish turn
export async function finishTurn(board, player1Letters, player2Letters, player1Score, player2Score, newCurrentTurn) {
  await updateGameState({
    board,
    player1Letters,
    player2Letters,
    player1Score,
    player2Score,
    currentTurn: newCurrentTurn,
    updatedAt: serverTimestamp()
  });
}

// Add game state change listener
export function onGameStateChange(callback) {
  gameStateListeners.push(callback);
  return () => {
    gameStateListeners = gameStateListeners.filter(l => l !== callback);
  };
}

