import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc
} from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA4PfUq-mZuhTigs176jp4pqWqA6_98LsY",
  authDomain: "mymangalist-d76ad.firebaseapp.com",
  projectId: "mymangalist-d76ad",
  storageBucket: "mymangalist-d76ad.firebasestorage.app",
  messagingSenderId: "658088308670",
  appId: "1:658088308670:web:7de341fab5c2e508ccd3ef"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cloneDocument() {
  const collectionName = "collections"; // coleção principal
  const oldDocId = "yofukashi";       // documento existente
  const newDocId = "cancoes-da-noite";      // novo documento

  try {
    console.log('Conectando ao Firebase...');

    // Pega o documento antigo
    const oldDocRef = doc(db, collectionName, oldDocId);
    const oldDocSnap = await getDoc(oldDocRef);

    if (!oldDocSnap.exists()) {
      console.log(`O documento ${oldDocId} não existe.`);
      return false;
    }

    const docData = oldDocSnap.data();

    // Cria o novo documento
    const newDocRef = doc(db, collectionName, newDocId);
    await setDoc(newDocRef, docData);

    console.log(`✅ Documento ${oldDocId} clonado para ${newDocId} com sucesso!`);
    return true;

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return false;
  }
}

// Executar
cloneDocument()
  .then(success => {
    if (success) {
      console.log('\n🎉 Processo concluído com sucesso!');
    } else {
      console.log('\n💥 Processo concluído com erros.');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erro inesperado:', error);
    process.exit(1);
  });
