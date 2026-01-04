// Game list management
import { collection, query, where, orderBy, getDocs, doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { checkPendingInvitations } from './invitations.js';

let invitationUnsubscribe = null;

// Show game list screen
export function showGameListScreen() {
  $('#loginScreen').addClass('hidden');
  $('#newGameScreen').addClass('hidden');
  $('#gameScreen').addClass('hidden');
  $('#gameAccessDeniedScreen').addClass('hidden');
  $('#gameListScreen').removeClass('hidden');
  
  loadGames();
  setupInvitationListener();
}

// Setup real-time listener for invitations
function setupInvitationListener() {
  const user = getCurrentUser();
  if (!user || !user.email) return;
  
  // Unsubscribe from previous listener
  if (invitationUnsubscribe) {
    invitationUnsubscribe();
  }
  
  // Listen for new invitations
  const invitationsRef = collection(db, 'invitations');
  const q = query(
    invitationsRef,
    where('toEmail', '==', user.email),
    where('status', '==', 'pending')
  );
  
  invitationUnsubscribe = onSnapshot(q, (snapshot) => {
    // Refresh game list when invitations change
    loadGames();
  }, (error) => {
    console.error('Error listening to invitations:', error);
  });
}

// Load and display games
export async function loadGames() {
  const user = getCurrentUser();
  if (!user) return;
  
  const container = $('#gameListContainer');
  container.html('<div class="text-center text-gray-500 py-8">טוען משחקים...</div>');
  
  try {
    // Get games where user is player1 or player2
    const gamesRef = collection(db, 'games');
    const q = query(
      gamesRef,
      where('player1', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    
    const q2 = query(
      gamesRef,
      where('player2', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    
    // Get pending invitations
    const invitations = await checkPendingInvitations();
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q),
      getDocs(q2)
    ]);
    
    const games = [];
    snapshot1.forEach(doc => {
      games.push({ id: doc.id, ...doc.data() });
    });
    snapshot2.forEach(doc => {
      games.push({ id: doc.id, ...doc.data() });
    });
    
    // Remove duplicates and sort by updatedAt
    const uniqueGames = games.reduce((acc, game) => {
      if (!acc.find(g => g.id === game.id)) {
        acc.push(game);
      }
      return acc;
    }, []);
    
    // Filter out games that are waiting and don't have player2 (these might be declined)
    const activeGames = uniqueGames.filter(game => {
      // Keep games that are active or finished
      if (game.status === 'active' || game.status === 'finished') return true;
      // Keep waiting games that have player2
      if (game.status === 'waiting' && game.player2) return true;
      // Keep waiting games where user is player1 (they created it)
      if (game.status === 'waiting' && game.player1 === user.uid) return true;
      return false;
    });
    
    activeGames.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis() || 0;
      const bTime = b.updatedAt?.toMillis() || 0;
      return bTime - aTime;
    });
    
    displayGames(activeGames, invitations);
  } catch (error) {
    console.error('Error loading games:', error);
    
    // Check if it's an index building error
    if (error.code === 'failed-precondition' && error.message && error.message.includes('index')) {
      container.html(`
        <div class="text-center py-8">
          <div class="text-yellow-600 font-semibold mb-2">האינדקס עדיין נבנה</div>
          <div class="text-sm text-gray-600 mb-4">זה יכול לקחת כמה דקות. אנא נסה שוב בעוד רגע.</div>
          <button id="retryLoadGames" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            נסה שוב
          </button>
        </div>
      `);
      
      // Add retry button handler
      $('#retryLoadGames').on('click', () => {
        loadGames();
      });
    } else {
      container.html('<div class="text-center text-red-500 py-8">שגיאה בטעינת המשחקים</div>');
    }
  }
}

// Display games in the list
function displayGames(games, invitations = []) {
  const user = getCurrentUser();
  const container = $('#gameListContainer');
  
  let html = '';
  
  // Display pending invitations first
  if (invitations.length > 0) {
    invitations.forEach(invitation => {
      html += `
        <div class="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-3" data-invitation-id="${invitation.id}" data-game-id="${invitation.gameId}">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="text-sm font-semibold text-blue-900 mb-1">הזמנה חדשה</div>
              <div class="text-sm text-gray-700">${invitation.fromUserName || 'שחקן'} הזמין אותך למשחק</div>
            </div>
            <div class="flex gap-2">
              <button class="accept-invite-btn px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                אישור
              </button>
              <button class="decline-invite-btn px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                סירוב
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }
  
  if (games.length === 0 && invitations.length === 0) {
    html += '<div class="text-center text-gray-500 py-8">אין משחקים פעילים. צור משחק חדש כדי להתחיל!</div>';
    container.html(html);
    return;
  }
  
    const gamesHtml = games.map(game => {
    const isMyTurn = game.currentTurn === user.uid && game.status === 'active';
    const isWaiting = game.status === 'waiting';
    const isFinished = game.status === 'finished';
    const isPlayer1 = game.player1 === user.uid;
    
    // Get player names and scores
    const player1Name = game.player1Name || 'שחקן 1';
    const player2Name = game.player2Name || 'שחקן 2';
    const score1 = game.player1Score || 0;
    const score2 = game.player2Score || 0;
    
    // Determine which player is "me" and which is opponent
    const myName = game.player1 === user.uid ? player1Name : player2Name;
    const myScore = game.player1 === user.uid ? score1 : score2;
    const opponentName = game.player1 === user.uid ? player2Name : player1Name;
    const opponentScore = game.player1 === user.uid ? score2 : score1;
    
    // Status button
    let statusButton = '';
    if (isFinished) {
      statusButton = '<button class="px-3 py-1.5 bg-gray-200 rounded-lg text-gray-800 text-sm font-medium">סיום</button>';
    } else if (isWaiting) {
      statusButton = '<button class="px-3 py-1.5 bg-gray-200 rounded-lg text-gray-800 text-sm font-medium">מחכה</button>';
    } else if (isMyTurn) {
      statusButton = '<button class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium">תורך</button>';
    } else {
      statusButton = '<button class="px-3 py-1.5 bg-gray-200 rounded-lg text-gray-800 text-sm font-medium">מחכה</button>';
    }
    
    // Copy link button - show for waiting games (player1) or active games where it's not my turn
    let copyLinkButton = '';
    const showCopyLink = (isWaiting && isPlayer1) || (!isMyTurn && !isFinished && game.status === 'active');
    if (showCopyLink) {
      copyLinkButton = `<button class="copy-game-link-btn px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors" data-game-id="${game.id}">העתק לינק</button>`;
    }
    
    // Calculate time since last update
    let timeAgo = 'מהלך אחרון לפני זמן לא ידוע';
    if (game.updatedAt) {
      const lastUpdate = game.updatedAt.toMillis ? game.updatedAt.toMillis() : game.updatedAt;
      const now = Date.now();
      const diffMs = now - lastUpdate;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) {
        timeAgo = `מהלך אחרון לפני ${diffDays} ${diffDays === 1 ? 'יום' : 'ימים'}`;
      } else if (diffHours > 0) {
        timeAgo = `מהלך אחרון לפני ${diffHours} ${diffHours === 1 ? 'שעה' : 'שעות'}`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins > 0) {
          timeAgo = `מהלך אחרון לפני ${diffMins} ${diffMins === 1 ? 'דקה' : 'דקות'}`;
        } else {
          timeAgo = 'מהלך אחרון עכשיו';
        }
      }
    }
    
    return `
      <div class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors" data-game-id="${game.id}">
        <div class="flex items-center gap-3">
          ${statusButton}
          <div class="flex-1">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-gray-600">${myName} (${myScore})</span>
              <span class="text-gray-400">&lt;&gt;</span>
              <span class="text-gray-900 font-semibold">${opponentName} (${opponentScore})</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">${timeAgo}</div>
          </div>
          ${copyLinkButton}
        </div>
      </div>
    `;
  }).join('');
  
  html += gamesHtml;
  container.html(html);
  
  // Add click handlers for games - entire card is clickable
  $('[data-game-id]').not('[data-invitation-id]').on('click', function(e) {
    // Don't trigger if clicking the copy link button
    if ($(e.target).hasClass('copy-game-link-btn') || $(e.target).closest('.copy-game-link-btn').length) {
      return;
    }
    const gameId = $(this).data('game-id');
    if (window.openGame) {
      window.openGame(gameId);
    }
  });
  
  // Add click handlers for copy link buttons
  $('.copy-game-link-btn').on('click', function(e) {
    e.stopPropagation();
    const gameId = $(this).data('game-id');
    const link = `${window.location.origin}/game/${gameId}`;
    navigator.clipboard.writeText(link).then(() => {
      // Show temporary message
      const message = $('<div>').text('הלינק הועתק!').css({
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#4CAF50',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        zIndex: 10000,
        fontSize: '14px',
        fontWeight: 'bold'
      });
      $('body').append(message);
      setTimeout(() => message.fadeOut(() => message.remove()), 2000);
    }).catch(err => {
      console.error('Failed to copy link:', err);
      alert('שגיאה בהעתקת הלינק');
    });
  });
  
  // Add click handlers for invitation buttons
  $('.accept-invite-btn').on('click', async function(e) {
    e.stopPropagation();
    const invitationCard = $(this).closest('[data-invitation-id]');
    const invitationId = invitationCard.data('invitation-id');
    const gameId = invitationCard.data('game-id');
    
    try {
      $(this).prop('disabled', true).text('מאשר...');
      const { acceptInvitation } = await import('./invitations.js');
      const invitations = await checkPendingInvitations();
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (invitation) {
        await acceptInvitation(invitationId, invitation);
        refreshGameList();
        if (window.openGame) {
          window.openGame(gameId);
        }
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('שגיאה בקבלת ההזמנה');
      $(this).prop('disabled', false).text('אישור');
    }
  });
  
  $('.decline-invite-btn').on('click', async function(e) {
    e.stopPropagation();
    const invitationCard = $(this).closest('[data-invitation-id]');
    const invitationId = invitationCard.data('invitation-id');
    const gameId = invitationCard.data('game-id');
    
    try {
      $(this).prop('disabled', true).text('מסרב...');
      const { declineInvitation } = await import('./invitations.js');
      
      // Decline invitation
      await declineInvitation(invitationId);
      
      // Delete the game
      const gameRef = doc(db, 'games', gameId);
      await deleteDoc(gameRef);
      
      // Refresh game list
      refreshGameList();
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('שגיאה בסירוב להזמנה');
      $(this).prop('disabled', false).text('סירוב');
    }
  });
}

// Refresh game list (called from other modules)
export function refreshGameList() {
  loadGames();
}

// Cleanup game list listeners (called when leaving game list screen)
export function cleanupGameList() {
  if (invitationUnsubscribe) {
    invitationUnsubscribe();
    invitationUnsubscribe = null;
  }
}

