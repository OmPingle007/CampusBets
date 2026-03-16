import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Link } from 'react-router';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Coins, UserCircle, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Profile() {
  const [userBets, setUserBets] = useState<any[]>([]);
  const [userWagers, setUserWagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const betsQuery = query(
      collection(db, 'bets'), 
      where('creatorId', '==', auth.currentUser.uid)
    );
    
    const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setUserBets(betsData.sort((a, b) => (b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime()) - (a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime())));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    const wagersQuery = query(
      collection(db, 'wagers'), 
      where('userId', '==', auth.currentUser.uid)
    );
    
    const unsubscribeWagers = onSnapshot(wagersQuery, (snapshot) => {
      const wagersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setUserWagers(wagersData.sort((a, b) => (b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime()) - (a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime())));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wagers');
    });

    return () => {
      unsubscribeBets();
      unsubscribeWagers();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="Profile" className="w-20 h-20 rounded-full border-4 border-white/20" />
            ) : (
              <UserCircle className="w-20 h-20 text-white/80" />
            )}
            <div>
              <h1 className="text-3xl font-bold">{auth.currentUser?.displayName}</h1>
              <p className="text-indigo-100">{auth.currentUser?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Your Created Bets
            </CardTitle>
            <CardDescription>Bets you have hosted for others.</CardDescription>
          </CardHeader>
          <CardContent>
            {userBets.length === 0 ? (
              <p className="text-gray-500 text-sm">You haven't created any bets yet.</p>
            ) : (
              <div className="space-y-4">
                {userBets.map(bet => (
                  <Link key={bet.id} to={`/bet/${bet.id}`} className="block p-4 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{bet.title}</h3>
                      <div className="flex items-center gap-2">
                        {(bet.approvalStatus === 'pending' || bet.approvalStatus === 'rejected') && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            bet.approvalStatus === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bet.approvalStatus.toUpperCase()}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          bet.status === 'open' ? 'bg-green-100 text-green-800' :
                          bet.status === 'resolved' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bet.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>{formatDistanceToNow(bet.createdAt?.toDate ? bet.createdAt.toDate() : new Date(bet.createdAt || Date.now()), { addSuffix: true })}</span>
                      <span className="flex items-center gap-1 font-medium text-indigo-600">
                        <Coins className="w-3 h-3" /> {bet.totalPool}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-600" />
              Your Wagers
            </CardTitle>
            <CardDescription>Your betting history.</CardDescription>
          </CardHeader>
          <CardContent>
            {userWagers.length === 0 ? (
              <p className="text-gray-500 text-sm">You haven't placed any wagers yet.</p>
            ) : (
              <div className="space-y-4">
                {userWagers.map(wager => (
                  <Link key={wager.id} to={`/bet/${wager.betId}`} className="block p-4 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">Option: {wager.option}</h3>
                      <span className="flex items-center gap-1 font-bold text-indigo-600">
                        <Coins className="w-4 h-4" /> {wager.amount}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDistanceToNow(wager.createdAt?.toDate ? wager.createdAt.toDate() : new Date(wager.createdAt || Date.now()), { addSuffix: true })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
