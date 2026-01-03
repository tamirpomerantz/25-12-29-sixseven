// Authentication module
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.js';

// Current user state
let currentUser = null;
let authStateListeners = [];

// Listen to auth state changes
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Create or update user profile
    await createOrUpdateUserProfile(user);
  }
  // Notify all listeners
  authStateListeners.forEach(listener => listener(user));
});

// Create or update user profile in Firestore
async function createOrUpdateUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  const userData = {
    displayName: user.displayName || 'משתמש',
    email: user.email,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp()
  };
  
  if (!userSnap.exists()) {
    // New user - add createdAt
    userData.createdAt = serverTimestamp();
  }
  
  await setDoc(userRef, userData, { merge: true });
}

// Sign in with Google
export async function signInWithGoogle() {
  try {
    // Use popup - COOP warnings are non-critical and don't prevent sign-in
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    // COOP warnings are logged but don't prevent sign-in from working
    if (error.code === 'auth/popup-closed-by-user') {
      // User closed the popup - this is fine, just return
      console.log('User closed popup');
      return null;
    }
    console.error('Error signing in:', error);
    throw error;
  }
}

// Sign out
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Subscribe to auth state changes
export function onAuthStateChange(callback) {
  authStateListeners.push(callback);
  // Immediately call with current state
  if (currentUser !== null) {
    callback(currentUser);
  }
  // Return unsubscribe function
  return () => {
    authStateListeners = authStateListeners.filter(l => l !== callback);
  };
}

// Show login screen
export function showLoginScreen() {
  // Hide all other screens
  $('.screen').addClass('hidden');
  // Show login screen
  $('#loginScreen').removeClass('hidden');
  
  // Add sign in button to login screen
  $('#loginScreen').html(`
    <div class="bg-white min-h-screen flex items-center justify-center">
      <div class="text-center p-8 bg-gray-50 rounded-lg shadow-md">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">ברוכים הבאים למשחק התשבץ העברי!</h1>
        <button id="signInBtn" class="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 ml-2">
          התחבר עם Google
        </button>
      </div>
    </div>
  `);
  
  // Set up click handler
  $('#signInBtn').on('click', async () => {
    try {
      $('#signInBtn').prop('disabled', true).text('מתחבר...');
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      alert('שגיאה בהתחברות. נסה שוב.');
      $('#signInBtn').prop('disabled', false).html(`
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 ml-2">
        התחבר עם Google
      `);
    }
  });
}

