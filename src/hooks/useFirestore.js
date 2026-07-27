import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

/**
 * Real-time listener for a user-scoped collection.
 * Stable — won't re-subscribe unless user or collectionName changes.
 */
export function useCollection(collectionName, extraOrderBy = null) {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const ref = collection(db, collectionName);
    const constraints = [where('userId', '==', user.uid)];
    if (extraOrderBy) constraints.push(orderBy(extraOrderBy, 'desc'));

    const q = query(ref, ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [user, collectionName, extraOrderBy]);

  return { docs, loading };
}

export function useAdd(collectionName) {
  const { user } = useAuth();
  return useCallback(
    (data) =>
      addDoc(collection(db, collectionName), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp(),
      }),
    [user, collectionName]
  );
}

export function useUpdate(collectionName) {
  return useCallback(
    (id, data) => updateDoc(doc(db, collectionName, id), data),
    [collectionName]
  );
}

export function useDelete(collectionName) {
  return useCallback(
    (id) => deleteDoc(doc(db, collectionName, id)),
    [collectionName]
  );
}
