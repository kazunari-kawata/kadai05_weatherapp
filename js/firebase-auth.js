// firebase-auth.js
import { firebaseConfig, app, auth, db } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    push,
    set,
    onValue,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 認証関連関数
function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

function loginAnonymously() {
    return signInAnonymously(auth);
}

function logout() {
    return signOut(auth);
}

function watchAuthState(callback) {
    onAuthStateChanged(auth, callback);
}

export {
    app,
    db,
    auth,
    loginWithGoogle,
    loginAnonymously,
    logout,
    watchAuthState,
    ref,
    push,
    set,
    onValue,
};
