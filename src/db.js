import Firebase from 'firebase'
const config = {
  apiKey: "AIzaSyBkFBWkNnh96arwX0PoUdE4O5yrvCFvGZs",
  authDomain: "quicklink-71368.firebaseapp.com",
  databaseURL: "https://quicklink-71368.firebaseio.com",
  projectId: "quicklink-71368",
  storageBucket: "quicklink-71368.appspot.com",
  messagingSenderId: "418863703438",
  appId: "1:418863703438:web:2844ffdee8543b7b"
};
const app = Firebase.initializeApp(config)
export const db = app.database()
export const storage = app.storage()