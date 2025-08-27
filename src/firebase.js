
import { getFirestore } from "firebase/firestore";

// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

const firebaseConfig = {

  apiKey: "AIzaSyA4PfUq-mZuhTigs176jp4pqWqA6_98LsY",

  authDomain: "mymangalist-d76ad.firebaseapp.com",

  projectId: "mymangalist-d76ad",

  storageBucket: "mymangalist-d76ad.firebasestorage.app",

  messagingSenderId: "658088308670",

  appId: "1:658088308670:web:7de341fab5c2e508ccd3ef"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);