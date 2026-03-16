import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, updateDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Coins, AlertCircle, CheckCircle2, Users } from 'lucide-react';

export default function BetDetails({ userPoints }: { userPoints: number }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bet, setBet] = useState<any>(null);
  const [wagers, setWagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wagerAmount, setWagerAmount] = useState<number>(10);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [placingWager, setPlacingWager] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmWinner, setConfirmWinner] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const betRef = doc(db, 'bets', id);
    const unsubscribeBet = onSnapshot(betRef, (doc) => {
      if (doc.exists()) {
        setBet({ id: doc.id, ...doc.data() });
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `bets/${id}`);
    });

    const wagersQuery = query(collection(db, 'wagers'), where('betId', '==', id));
    const unsubscribeWagers = onSnapshot(wagersQuery, (snapshot) => {
      setWagers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wagers');
    });

    return () => {
      unsubscribeBet();
      unsubscribeWagers();
    };
  }, [id, navigate]);

  const handlePlaceWager = async () => {
    setError('');
    if (!selectedOption) {
      setError('Please select an option.');
      return;
    }
    if (wagerAmount <= 0 || wagerAmount > userPoints) {
      setError('Invalid wager amount. Check your balance.');
      return;
    }

    setPlacingWager(true);
    try {
      const batch = writeBatch(db);

      // 1. Create wager
      const newWagerRef = doc(collection(db, 'wagers'));
      batch.set(newWagerRef, {
        betId: id,
        userId: auth.currentUser!.uid,
        userName: auth.currentUser!.displayName || 'Anonymous',
        option: selectedOption,
        amount: wagerAmount,
        createdAt: serverTimestamp()
      });

      // 2. Update bet total pool
      const betRef = doc(db, 'bets', id!);
      batch.update(betRef, {
        totalPool: increment(wagerAmount)
      });

      // 3. Deduct points from user
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      batch.update(userRef, {
        points: increment(-wagerAmount)
      });

      await batch.commit();

      setSelectedOption('');
      setWagerAmount(10);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'wagers/bets/users');
      setError('Failed to place wager.');
    } finally {
      setPlacingWager(false);
    }
  };

  const handleResolveBet = async (winningOption: string) => {
    setResolving(true);
    try {
      const batch = writeBatch(db);
      const betRef = doc(db, 'bets', id!);
      batch.update(betRef, {
        status: 'resolved',
        winningOption: winningOption
      });

      // Distribute winnings
      const winningWagers = wagers.filter(w => w.option === winningOption);
      const totalWinningAmount = winningWagers.reduce((sum, w) => sum + w.amount, 0);
      
      if (totalWinningAmount > 0) {
        for (const wager of winningWagers) {
          const userShare = Math.floor((wager.amount / totalWinningAmount) * bet.totalPool);
          if (userShare > 0) {
            const userRef = doc(db, 'users', wager.userId);
            batch.update(userRef, {
              points: increment(userShare)
            });
          }
        }
      }
      
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bets/${id}`);
      setError('Failed to resolve bet.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!bet) return null;

  const isCreator = auth.currentUser?.uid === bet.creatorId;
  const deadlineDate = bet.deadline?.toDate ? bet.deadline.toDate() : new Date(bet.deadline);
  const deadlinePassed = isPast(deadlineDate);
  const isApproved = bet.approvalStatus === 'approved';
  const canWager = bet.status === 'open' && !deadlinePassed && isApproved;
  const userWagers = wagers.filter(w => w.userId === auth.currentUser?.uid);
  const totalUserWagered = userWagers.reduce((sum, w) => sum + w.amount, 0);

  // Calculate odds/distribution
  const optionTotals = bet.options.reduce((acc: any, opt: string) => {
    acc[opt] = wagers.filter(w => w.option === opt).reduce((sum, w) => sum + w.amount, 0);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!isApproved && (
        <div className={`p-4 rounded-lg border ${
          bet.approvalStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-orange-50 border-orange-200 text-orange-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-5 h-5" />
            {bet.approvalStatus === 'rejected' ? 'Bet Rejected' : 'Pending Approval'}
          </div>
          <p className="text-sm mt-1">
            {bet.approvalStatus === 'rejected' 
              ? 'This bet has been rejected by an administrator and cannot accept wagers.' 
              : 'This bet is currently pending approval from an administrator. Wagers cannot be placed until it is approved.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
          <CardHeader>
            <div className="flex justify-between items-start mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                bet.status === 'open' && !deadlinePassed ? 'bg-green-100 text-green-800' :
                bet.status === 'resolved' ? 'bg-indigo-100 text-indigo-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {bet.status === 'resolved' ? 'RESOLVED' : deadlinePassed ? 'CLOSED' : 'OPEN'}
              </span>
              <span className="text-sm text-gray-500">
                Created by <span className="font-medium text-gray-900">{bet.creatorName}</span>
              </span>
            </div>
            <CardTitle className="text-2xl">{bet.title}</CardTitle>
            <CardDescription className="text-base mt-2 whitespace-pre-wrap">
              {bet.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center mb-6">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Pool</p>
                <div className="flex items-center gap-1.5 text-2xl font-bold text-indigo-600">
                  <Coins className="w-6 h-6" />
                  {bet.totalPool}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 font-medium">Deadline</p>
                <p className="text-lg font-semibold text-gray-900">
                  {deadlineDate.toLocaleString()}
                </p>
                {isCreator && bet.status === 'open' && !deadlinePassed && (
                  confirmClose ? (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="text-xs h-7"
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'bets', id!), { status: 'closed' });
                            setConfirmClose(false);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        Yes
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-7"
                        onClick={() => setConfirmClose(false)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 text-xs h-7 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmClose(true)}
                    >
                      Close Betting Early
                    </Button>
                  )
                )}
              </div>
            </div>

            {bet.status === 'resolved' && (
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-6 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-indigo-900">Bet Resolved</h4>
                  <p className="text-indigo-800 mt-1">
                    Winning Option: <span className="font-bold">{bet.winningOption}</span>
                  </p>
                </div>
              </div>
            )}

            <h3 className="text-lg font-semibold mb-3">Options & Distribution</h3>
            <div className="space-y-3">
              {bet.options.map((opt: string) => {
                const amount = optionTotals[opt] || 0;
                const percentage = bet.totalPool > 0 ? Math.round((amount / bet.totalPool) * 100) : 0;
                const multiplier = amount > 0 ? (bet.totalPool / amount).toFixed(2) : '0.00';
                const isWinner = bet.status === 'resolved' && bet.winningOption === opt;
                
                return (
                  <div key={opt} className={`p-3 rounded-lg border ${isWinner ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900 flex items-center gap-2">
                        {opt}
                        {isWinner && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      </span>
                      <span className="text-sm font-semibold text-gray-600">
                        {amount} pts ({percentage}%) {amount > 0 && <span className="text-indigo-600 ml-1">{multiplier}x</span>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${isWinner ? 'bg-indigo-600' : 'bg-gray-400'}`} 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    
                    {isCreator && bet.status !== 'resolved' && (
                      confirmWinner === opt ? (
                        <div className="mt-3 flex flex-col gap-2">
                          <span className="text-sm text-indigo-700 font-medium text-center">Confirm {opt} as winner?</span>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => {
                                handleResolveBet(opt);
                                setConfirmWinner(null);
                              }}
                              disabled={resolving}
                            >
                              Yes
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              onClick={() => setConfirmWinner(null)}
                              disabled={resolving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-3 w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={() => setConfirmWinner(opt)}
                          disabled={resolving}
                        >
                          Mark as Winner
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Recent Wagers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wagers.length === 0 ? (
              <p className="text-gray-500 text-sm">No wagers placed yet.</p>
            ) : (
              <div className="space-y-3">
                {wagers.slice(0, 10).map((wager) => (
                  <div key={wager.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{wager.userName}</p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(wager.createdAt?.toDate ? wager.createdAt.toDate() : new Date(wager.createdAt || Date.now()), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gray-900">{wager.option}</p>
                      <p className="text-xs font-medium text-indigo-600 flex items-center justify-end gap-1">
                        <Coins className="w-3 h-3" /> {wager.amount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {canWager && (
          <Card className="border-indigo-100 shadow-md">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-50">
              <CardTitle className="text-lg">Place a Wager</CardTitle>
              <CardDescription>Predict the outcome and win points.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Select Option</label>
                  <div className="space-y-2">
                    {bet.options.map((opt: string) => (
                      <label 
                        key={opt} 
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedOption === opt ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="option" 
                          value={opt}
                          checked={selectedOption === opt}
                          onChange={(e) => setSelectedOption(e.target.value)}
                          className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="ml-3 font-medium text-sm text-gray-900">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 flex justify-between">
                    <span>Wager Amount</span>
                    <span className="text-gray-500">Balance: {userPoints}</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Coins className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input 
                      type="number" 
                      min="1" 
                      max={userPoints}
                      value={wagerAmount}
                      onChange={(e) => setWagerAmount(parseInt(e.target.value) || 0)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handlePlaceWager}
                  disabled={placingWager || !selectedOption || wagerAmount <= 0 || wagerAmount > userPoints}
                >
                  {placingWager ? 'Placing...' : 'Place Wager'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {totalUserWagered > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Wagers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userWagers.map((wager) => {
                  const isWinner = bet.status === 'resolved' && bet.winningOption === wager.option;
                  const isLoser = bet.status === 'resolved' && bet.winningOption !== wager.option;
                  
                  return (
                    <div key={wager.id} className={`p-3 rounded-lg border ${
                      isWinner ? 'border-green-200 bg-green-50' : 
                      isLoser ? 'border-red-100 bg-red-50' : 
                      'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-gray-900">{wager.option}</span>
                        <span className="font-semibold text-sm flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {wager.amount}
                        </span>
                      </div>
                      {isWinner && (
                        <p className="text-xs text-green-700 font-medium mt-1">
                          You won! Payout: {Math.floor((wager.amount / optionTotals[wager.option]) * bet.totalPool)} pts
                        </p>
                      )}
                      {isLoser && (
                        <p className="text-xs text-red-600 font-medium mt-1">Better luck next time.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
