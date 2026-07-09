import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type BuyerProfile = {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'buyer';
};

type AuthContextValue = {
  user: User | null;
  profile: BuyerProfile | null;
  loading: boolean;
  signUp: (values: { fullName: string; email: string; phone: string; password: string }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const profileRef = doc(db, 'buyers', currentUser.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setProfile({ uid: currentUser.uid, ...profileSnap.data() } as BuyerProfile);
      } else {
        const fallbackProfile: BuyerProfile = {
          uid: currentUser.uid,
          fullName: currentUser.displayName || 'FashionDrop Buyer',
          email: currentUser.email || '',
          phone: currentUser.phoneNumber || '',
          role: 'buyer',
        };
        await setDoc(profileRef, { ...fallbackProfile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setProfile(fallbackProfile);
      }
      setLoading(false);
    });
  }, []);

  async function signUp(values: { fullName: string; email: string; phone: string; password: string }) {
    const credential = await createUserWithEmailAndPassword(auth, values.email, values.password);
    await updateProfile(credential.user, { displayName: values.fullName });
    const buyerProfile: BuyerProfile = {
      uid: credential.user.uid,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      role: 'buyer',
    };
    await setDoc(doc(db, 'buyers', credential.user.uid), {
      ...buyerProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setProfile(buyerProfile);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const profileRef = doc(db, 'buyers', credential.user.uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid: credential.user.uid,
        fullName: credential.user.displayName || 'FashionDrop Buyer',
        email: credential.user.email || '',
        phone: credential.user.phoneNumber || '',
        role: 'buyer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  async function logOut() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({ user, profile, loading, signUp, signIn, signInWithGoogle, logOut }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
