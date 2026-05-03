# Local Installation Guide

This project is a React application built with Vite, using Firebase for authentication and database.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm**: Usually comes with Node.js.

## Installation Steps

1. **Download or Clone the Repository**:
   Download the source code to your local machine.

2. **Install Dependencies**:
   Open your terminal in the project root directory and run:
   ```bash
   npm install
   ```

3. **Configure Firebase**:
   - The application relies on `firebase-applet-config.json` in the root directory for its configuration.
   - If you are running this project independently, you should create a project on the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Authentication** (Google Provider) and **Firestore Database**.
   - Copy your Web App configuration and update `firebase-applet-config.json` with your project's details.

4. **Set Up Environment Variables**:
   - Copy `.env.example` to `.env`.
   - Update `GEMINI_API_KEY` if you plan to use AI features.

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   The app will typically be available at `http://localhost:3000`.

### ganti Port (Changing the Port)

Jika port 3000 sudah digunakan, Anda bisa menggantinya dengan mengatur variabel `PORT` di file `.env`:

**Di file `.env`:**
```env
PORT=3001
```

Atau melalui terminal:
- **Mac/Linux**: `PORT=3001 npm run dev`
- **Windows**: `set PORT=3001 && npm run dev`

## Cara Install Firebase (Local)

Untuk menggunakan Firebase di komputer lokal:

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login ke Firebase**:
   ```bash
   firebase login
   ```

3. **Inisialisasi Project**:
   Hubungkan folder local dengan project Firebase Anda:
   ```bash
   firebase init firestore
   ```
   Pilih "Use an existing project" dan cari project Anda.

4. **Deploy Security Rules**:
   Gunakan file `firestore.rules` yang sudah ada:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Scripts

- `npm run dev`: Starts the development server (Express + Vite).
- `npm run build`: Builds the production-ready static files in the `dist` directory.
- `npm run start`: Runs the production server serving the built files.
- `npm run lint`: Checks for TypeScript errors.

## Firebase Security Rules

Before deploying or using the app, ensure you deploy the `firestore.rules` to your Firebase project to secure your data.
You can do this using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```
