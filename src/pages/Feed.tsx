import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Link } from 'react-router';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Clock, Users, Coins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Feed() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'bets'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBets(betsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Active Bets</h1>
      </div>

      {bets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">No active bets found.</p>
          <Link to="/create" className="text-indigo-600 font-medium hover:underline">
            Be the first to create one!
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bets.map((bet) => (
            <Link key={bet.id} to={`/bet/${bet.id}`} className="block group">
              <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-indigo-200">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      bet.status === 'open' ? 'bg-green-100 text-green-800' :
                      bet.status === 'closed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {bet.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(bet.createdAt?.toDate ? bet.createdAt.toDate() : new Date(bet.createdAt || Date.now()), { addSuffix: true })}
                    </span>
                  </div>
                  <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {bet.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {bet.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {bet.options.slice(0, 3).map((opt: string, i: number) => (
                      <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                        {opt}
                      </span>
                    ))}
                    {bet.options.length > 3 && (
                      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs font-medium">
                        +{bet.options.length - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between items-center text-sm text-gray-500 border-t border-gray-100 mt-4 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{bet.creatorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-600">
                    <Coins className="w-4 h-4" />
                    <span>{bet.totalPool}</span>
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
