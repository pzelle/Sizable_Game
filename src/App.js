import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Publicly available Google Sheets CSV links
const GEO_URL =
  'https://docs.google.com/spreadsheets/d/1zeW6OCKSnpCKt6o1VRGZ2yR3mTCH1OmPY7m_zHVURHI/export?format=csv&gid=768712458';
const SIZABLE_URL =
  'https://docs.google.com/spreadsheets/d/1zeW6OCKSnpCKt6o1VRGZ2yR3mTCH1OmPY7m_zHVURHI/export?format=csv&gid=0';

function App() {
  // Stage: 'setup' or 'playing'
  const [stage, setStage] = useState('setup');
  const [numPlayers, setNumPlayers] = useState(4);
  const [tempNames, setTempNames] = useState([]);
  const [setupError, setSetupError] = useState('');
  const [players, setPlayers] = useState([]);

  const [sampleGeographicCohorts, setSampleGeographicCohorts] = useState([]);
  const [sampleSizableItems, setSampleSizableItems] = useState([]);

  // Indices of current sizers
  const [currentSizers, setCurrentSizers] = useState([0, 1]);

  // Current randomly drawn items (string)
  const [currentCohort, setCurrentCohort] = useState('');
  const [currentSizable, setCurrentSizable] = useState('');

  // Sizer estimates
  const [estimates, setEstimates] = useState({});

  // Score to win
  const [targetScore, setTargetScore] = useState(5);

  // Fetch geographic cohorts
  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n')
          .map((line) => line.trim())
          .filter((line) => line);
        setSampleGeographicCohorts(lines);
      })
      .catch((err) => console.error('Error fetching geographic cohorts:', err));
  }, []);

  // Fetch sizable items
  useEffect(() => {
    fetch(SIZABLE_URL)
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n')
          .map((line) => line.trim())
          .filter((line) => line);
        setSampleSizableItems(lines);
      })
      .catch((err) => console.error('Error fetching sizable items:', err));
  }, []);

  // Randomly select new cards
  const drawNewCards = () => {
    if (!sampleGeographicCohorts.length || !sampleSizableItems.length) {
      setCurrentCohort('Still loading...');
      setCurrentSizable('Still loading...');
      return;
    }
    // Random pick
    const randomCohort = sampleGeographicCohorts[
      Math.floor(Math.random() * sampleGeographicCohorts.length)
    ];
    const randomSizable = sampleSizableItems[
      Math.floor(Math.random() * sampleSizableItems.length)
    ];

    // Remove any extra quotes from CSV lines
    const cohortNoQuotes = randomCohort.replace(/"/g, '');
    const sizableNoQuotes = randomSizable.replace(/"/g, '');

    setCurrentCohort(cohortNoQuotes);
    setCurrentSizable(sizableNoQuotes);
  };

  // Start drawing cards once we're playing
  useEffect(() => {
    if (stage === 'playing') {
      drawNewCards();
      setCurrentSizers([0, 1]);
    }
  }, [stage, sampleGeographicCohorts, sampleSizableItems]);

  // Round-robin logic
  const nextRound = (winnerIndex, loserIndex) => {
    let newSizerIndex = (loserIndex + 1) % players.length;
    while (newSizerIndex === winnerIndex) {
      newSizerIndex = (newSizerIndex + 1) % players.length;
    }
    setCurrentSizers([winnerIndex, newSizerIndex]);
    setEstimates({});
    drawNewCards();
  };

  // If both sizers guessed the same number
  const handleTiePoints = () => {
    const [sizerA, sizerB] = currentSizers;
    const updatedPlayers = players.map((p, idx) => {
      if (idx === sizerA || idx === sizerB) {
        return { ...p, score: p.score + 1 };
      }
      return p;
    });
    setPlayers(updatedPlayers);
    nextRound(sizerA, sizerB);
  };

  // Judge votes for a single winner
  const handleVote = (winnerIndex) => {
    const updatedPlayers = players.map((p, idx) => {
      if (idx === winnerIndex) {
        return { ...p, score: p.score + 1 };
      }
      return p;
    });
    setPlayers(updatedPlayers);

    const [sizerA, sizerB] = currentSizers;
    const loserIndex = winnerIndex === sizerA ? sizerB : sizerA;
    nextRound(winnerIndex, loserIndex);
  };

  // No points
  const handleNoPoints = () => {
    const [sizerA, sizerB] = currentSizers;
    nextRound(sizerA, sizerB);
  };

  // Sizers' estimates
  const handleEstimateChange = (playerIndex, value) => {
    setEstimates({ ...estimates, [playerIndex]: value });
  };

  // Check if a champion
  const champion = players.find((p) => p.score >= targetScore);

  // Start the game
  const handleStartGame = () => {
    setSetupError('');
    const trimmedNames = tempNames.map((n) => n.trim());
    if (trimmedNames.some((name) => !name)) {
      setSetupError('All players must have a non-empty, unique name.');
      return;
    }
    const lowerCased = trimmedNames.map((n) => n.toLowerCase());
    const uniqueSet = new Set(lowerCased);
    if (uniqueSet.size !== lowerCased.length) {
      setSetupError('All player names must be unique.');
      return;
    }
    const newPlayers = trimmedNames.map((name) => ({ name, score: 0 }));
    setPlayers(newPlayers);
    setStage('playing');
  };

  // If we're still at setup screen
  if (stage === 'setup') {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center font-[Arial]">
        <motion.div
          className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold mb-4 text-center">Sizeable Game Setup</h1>

          <div className="mb-4">
            <label className="block font-semibold mb-2">How many players?</label>
            <input
              type="number"
              min="3"
              max="20"
              value={numPlayers}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 3 && val <= 20) {
                  setNumPlayers(val);
                  setTempNames([]);
                }
              }}
              className="border border-black rounded p-2 w-24"
            />
          </div>

          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Enter Player Names</h2>
            {[...Array(numPlayers)].map((_, i) => (
              <div key={i} className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Player {i + 1} Name:
                </label>
                <input
                  type="text"
                  className="border border-black rounded p-2 w-full"
                  value={tempNames[i] || ''}
                  onChange={(e) => {
                    const newArr = [...tempNames];
                    newArr[i] = e.target.value;
                    setTempNames(newArr);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Target Score to Win</label>
            <input
              type="number"
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="border border-black rounded p-2 w-24"
            />
          </div>

          {setupError && (
            <div className="mb-4 text-red-600 font-semibold text-center">{setupError}</div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleStartGame}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Start Game
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // At game screen
  const [sizerA, sizerB] = currentSizers;
  const estimateA = estimates[sizerA] || '';
  const estimateB = estimates[sizerB] || '';
  const bothGuessedSame = estimateA && estimateB && estimateA === estimateB;

  // If someone won
  if (champion) {
    return (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center font-[Arial]">
        <motion.div
          className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold mb-4">We Have a Champion!</h1>
          <p className="text-xl mb-6">
            Congratulations {champion.name}, you reached {champion.score} points!
          </p>
          <button
            onClick={() => {
              const resetPlayers = players.map((p) => ({ ...p, score: 0 }));
              setPlayers(resetPlayers);
              setCurrentSizers([0, 1]);
              setEstimates({});
              setStage('setup');
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Active game screen
  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center font-[Arial]">
      <motion.div
        className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-3xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold mb-4 text-center">Sizeable Game</h1>

        {/* Scores */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Scores</h2>
          <ul className="flex flex-col gap-2">
            {players.map((player, idx) => (
              <li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span className="mr-4">{player.name}</span>
                <div className="border border-black rounded px-3 py-1 text-center">
                  {player.score}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Current Question */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Current Question</h2>
          <p className="text-lg mb-2">
            <span className="font-bold">{currentSizable}</span> in{' '}
            <span className="font-bold">{currentCohort}</span>?
          </p>
          <p className="text-sm text-gray-600">
            (All players should agree on the scope of the question before proceeding.)
          </p>
        </div>

        {/* Sizers' Estimates */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Sizers' Estimates</h2>
          <div className="mb-4">
            <label className="block font-semibold mb-2">
              {players[sizerA].name}&apos;s Estimate
            </label>
            <input
              type="number"
              className="border border-black rounded p-2 w-full"
              placeholder="Enter your single, exact numerical estimate"
              value={estimateA}
              onChange={(e) => handleEstimateChange(sizerA, e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-2">
              {players[sizerB].name}&apos;s Estimate
            </label>
            <input
              type="number"
              className="border border-black rounded p-2 w-full"
              placeholder="Enter your single, exact numerical estimate"
              value={estimateB}
              onChange={(e) => handleEstimateChange(sizerB, e.target.value)}
            />
          </div>
          <p className="text-gray-600 text-sm">
            (Each Sizer has ~2 minutes to think and write their estimate, then reveal.)
          </p>
        </div>

        {/* Judges' Decision */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Judges&apos; Decision</h2>
          <p className="mb-4">
            Judges, vote on which estimate seems more plausible, or pick an alternate outcome:
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => handleVote(sizerA)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Vote for {players[sizerA].name}
            </button>
            <button
              onClick={() => handleVote(sizerB)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Vote for {players[sizerB].name}
            </button>
            <button
              onClick={handleNoPoints}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              No Points (Both fail)
            </button>
            {bothGuessedSame && (
              <button
                onClick={handleTiePoints}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
              >
                Both Correct (1 point each)
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
