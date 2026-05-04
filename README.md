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

### 2. Login Firebase di Server/Remote (PASTIKAN INI DILAKUKAN)

Jika Anda menggunakan SSH atau server yang tidak memiliki browser, gunakan perintah ini untuk login:

1. **Jalankan Login Headless**:
   ```bash
   firebase login --no-localhost
   ```
2. **Buka Link di Browser PC**: Copy Link yang muncul di terminal, buka di browser PC Anda, lalu login.
3. **Copy Authorization Code**: Setelah sukses, kodenya akan muncul di browser. Copy dan Paste ke terminal server.

### 3. Cara Install Firebase (Local/Server)

Setelah login sukses:

1. **Inisialisasi Project**:
   ```bash
   firebase init firestore
   ```
   *   Pilih: `Use an existing project`.
   *   Pilih: Project Firebase Anda.
   *   Jika ditanya `What file should be used for Firestore Rules?`, tekan ENTER saja (karena sudah ada file `firestore.rules`).
   *   Jika ditanya `File firestore.rules already exists. Overwrite?`, pilih **N** (No) agar aturan yang sudah saya buat tidak hilang.

2. **Deploy Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### 4. Mengatasi Error "unauthorized-domain" saat Login

Jika muncul error `auth/unauthorized-domain` saat klik "Lanjutkan dengan Google":

1.  Buka **Firebase Console** -> **Authentication** -> **Settings**.
2.  Pilih **Authorized domains**.
3.  Klik **Add domain**.
4.  Masukkan IP server Anda atau domain yang digunakan (contoh: `192.168.1.100` atau `danmalab`).
5.  Simpan dan coba login kembali.

### 5. Aktifkan Akun Lokal (Email & Password)

Untuk menggunakan fitur login dengan email/password (Akun Lokal):

1.  Buka **Firebase Console** -> **Authentication** -> **Sign-in method**.
2.  Klik **Add new provider**.
3.  Pilih **Email/Password**.
4.  Klik **Enable** dan **Save**.
5.  Sekarang Anda bisa mendaftar dan login langsung dari aplikasi.

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
