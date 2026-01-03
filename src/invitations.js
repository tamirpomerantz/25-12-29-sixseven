// Invitation management
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { refreshGameList } from './gameList.js';

// Create a new game and send invitation
export async function createGameAndInvite(opponentEmail) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
    try {
        // Create game document
        const gameData = {
            player1: user.uid,
            player1Name: user.displayName || 'שחקן 1',
            player2: null,
            player2Name: null,
            currentTurn: user.uid,
            board: {},
            player1Letters: [],
            player2Letters: [],
            player1Score: 0,
            player2Score: 0,
            status: 'waiting',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const gameRef = await addDoc(collection(db, 'games'), gameData);
        const gameId = gameRef.id;
    
    // Create invitation
    const invitationData = {
      fromUser: user.uid,
      fromUserName: user.displayName || 'שחקן',
      toEmail: opponentEmail,
      gameId: gameId,
      status: 'pending',
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'invitations'), invitationData);
    
    // Note: In a production app, you'd want to send an email notification
    // This could be done via Firebase Cloud Functions
    
    return gameId;
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
}

// Check for pending invitations for current user
export async function checkPendingInvitations(retryCount = 0) {
  const user = getCurrentUser();
  
  if (!user || !user.email) {
    // If no email yet, wait a bit and retry (auth might still be initializing)
    if (retryCount < 3 && user) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return checkPendingInvitations(retryCount + 1);
    }
    return [];
  }
  
  try {
    const invitationsRef = collection(db, 'invitations');
    const q = query(
      invitationsRef,
      where('toEmail', '==', user.email),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    const invitations = [];
    snapshot.forEach(doc => {
      invitations.push({ id: doc.id, ...doc.data() });
    });
    
    return invitations;
  } catch (error) {
    // If permission error and we haven't retried too much, wait and retry
    if ((error.code === 'permission-denied' || error.code === 'permissions-denied') && retryCount < 5) {
      console.log(`Permission denied (attempt ${retryCount + 1}/5), retrying after auth propagation...`);
      // Increase wait time with each retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return checkPendingInvitations(retryCount + 1);
    }
    console.error('Error checking invitations:', error);
    // Don't block the app - just return empty array
    return [];
  }
}

// Accept an invitation
export async function acceptInvitation(invitationId, invitationData) {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  try {
    // Update invitation status
    const invitationRef = doc(db, 'invitations', invitationId);
    await updateDoc(invitationRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
    
    // Update game with player2
    const gameRef = doc(db, 'games', invitationData.gameId);
    await updateDoc(gameRef, {
      player2: user.uid,
      player2Name: user.displayName || 'שחקן 2',
      status: 'active',
      updatedAt: serverTimestamp()
    });
    
    // Refresh game list
    refreshGameList();
    
    return invitationData.gameId;
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error;
  }
}

// Decline an invitation
export async function declineInvitation(invitationId) {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    await updateDoc(invitationRef, {
      status: 'declined',
      declinedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    throw error;
  }
}

