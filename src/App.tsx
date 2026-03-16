import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/ui/button';
import { Coins, LogOut, PlusCircle, UserCircle, Home, Shield } from 'lucide-react';

// Pages
import Feed from './pages/Feed';
import CreateBet from './pages/CreateBet';
import BetDetails from './pages/BetDetails';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create new user profile
            const isDefaultAdmin = currentUser.email === 'ompingle005@gmail.com';
            const newUser = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Anonymous User',
              email: currentUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'user',
              points: 1000, // Starting points
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newUser);
            setPoints(1000);
            setUserRole(isDefaultAdmin ? 'admin' : 'user');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time listener for user points
  useEffect(() => {
    if (!user) {
      setPoints(0);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribePoints = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPoints(data.points || 0);
        setUserRole(data.role || (user.email === 'ompingle005@gmail.com' ? 'admin' : 'user'));
      }
    });
    return () => unsubscribePoints();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleBuyPoints = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(1000)
      });
    } catch (error) {
      console.error('Error adding points:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 p-4 rounded-full">
              <Coins className="w-12 h-12 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Campus Bets</h1>
          <p className="text-gray-500 mb-8">Predict campus events, challenge friends, and climb the leaderboard.</p>
          <Button onClick={handleLogin} className="w-full text-lg py-6">
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {/* Navbar */}
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <Link to="/" className="flex items-center gap-2">
                    <Coins className="w-8 h-8 text-indigo-600" />
                    <span className="text-xl font-bold text-gray-900 hidden sm:block">Campus Bets</span>
                  </Link>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">{points}</span>
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={handleBuyPoints} className="hidden sm:flex border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    Buy Points
                  </Button>
                  
                  <Link to="/create">
                    <Button variant="ghost" size="icon" className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
                      <PlusCircle className="w-5 h-5" />
                    </Button>
                  </Link>
                  
                  <Link to="/profile">
                    <Button variant="ghost" size="icon" className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
                      <UserCircle className="w-5 h-5" />
                    </Button>
                  </Link>

                  {userRole === 'admin' && (
                    <Link to="/admin">
                      <Button variant="ghost" size="icon" className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
                        <Shield className="w-5 h-5" />
                      </Button>
                    </Link>
                  )}
                  
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="text-gray-600 hover:text-red-600 hover:bg-red-50">
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/create" element={<CreateBet />} />
              <Route path="/bet/:id" element={<BetDetails userPoints={points} />} />
              <Route path="/profile" element={<Profile />} />
              {userRole === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          
          {/* Mobile Bottom Nav (Optional, but good for mobile-first) */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 pb-safe">
            <Link to="/" className="flex flex-col items-center text-gray-500 hover:text-indigo-600">
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">Feed</span>
            </Link>
            <Link to="/create" className="flex flex-col items-center text-gray-500 hover:text-indigo-600">
              <PlusCircle className="w-6 h-6" />
              <span className="text-xs mt-1">Create</span>
            </Link>
            <Link to="/profile" className="flex flex-col items-center text-gray-500 hover:text-indigo-600">
              <UserCircle className="w-6 h-6" />
              <span className="text-xs mt-1">Profile</span>
            </Link>
            {userRole === 'admin' && (
              <Link to="/admin" className="flex flex-col items-center text-gray-500 hover:text-indigo-600">
                <Shield className="w-6 h-6" />
                <span className="text-xs mt-1">Admin</span>
              </Link>
            )}
          </div>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
