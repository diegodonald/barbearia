import { useEffect, useState } from "react";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useOperatingHours() {
  const [operatingHours, setOperatingHours] = useState<any>(null);
  const [exceptions, setExceptions] = useState<any[]>([]);

  useEffect(() => {
    // Listener para o documento global de horários
    const docRef = doc(db, "configuracoes", "operatingHours");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOperatingHours(docSnap.data());
      }
    });
    // Listener para as exceções (subcoleção)
    const exceptionsRef = collection(db, "configuracoes", "operatingHours", "exceptions");
    const unsubscribeExceptions = onSnapshot(exceptionsRef, (snapshot) => {
      const exs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setExceptions(exs);
    });
    return () => {
      unsubscribe();
      unsubscribeExceptions();
    };
  }, []);

  return { operatingHours, exceptions };
}