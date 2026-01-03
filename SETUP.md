# Setup Instructions

## Firebase Configuration

1. Go to Firebase Console (https://console.firebase.google.com/)
2. Select your project (bonus-fce33)
3. Go to Project Settings > General
4. Scroll down to "Your apps" and find your Web app, or create a new one
5. Copy the Firebase configuration object
6. Open `src/firebase.js` and replace the placeholder values:
   - `YOUR_API_KEY`
   - `YOUR_AUTH_DOMAIN`
   - `YOUR_STORAGE_BUCKET`
   - `YOUR_MESSAGING_SENDER_ID`
   - `YOUR_APP_ID`

## Firebase Authentication Setup

1. In Firebase Console, go to Authentication
2. Enable "Google" as a sign-in provider
3. Add your domain to authorized domains if needed

## Firestore Setup

1. In Firebase Console, go to Firestore Database
2. Create database (if not already created)
3. Start in test mode (rules will be applied from `firestore.rules`)
4. Deploy the rules: `firebase deploy --only firestore:rules`

## Firestore Indexes

The game list queries require composite indexes. Firebase will prompt you to create them when you first run the queries, or you can create them manually:

1. Go to Firestore > Indexes
2. Create index for collection `games`:
   - Fields: `player1` (Ascending), `updatedAt` (Descending)
3. Create index for collection `games`:
   - Fields: `player2` (Ascending), `updatedAt` (Descending)

## Installation

```bash
npm install
```

## Development

For local development, you can use Firebase Emulator Suite or deploy to Firebase Hosting.

## Deployment

```bash
firebase deploy
```

This will deploy:
- Firestore rules
- Hosting (the web app)

## Notes

- The game uses ES modules, so make sure your server supports them
- For production, consider using a bundler like Vite or Webpack
- Make sure the `public/dictionary.txt` file is accessible

