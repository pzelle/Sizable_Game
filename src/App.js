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

  // Current randomly drawn items
  const [currentCohort, setCurrentCohort] = useState('');
  const [currentSizable, setCurrentSizable] = useState('');

  // Sizers' estimates
  const [estimates, setEstimates] = useState({});

  // Target score to win
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
    const randomCohort = sampleGeographicCohorts[
      Math.floor(Math.random() * sampleGeographicCohorts.length)
    ];
    const randomSizable = sampleSizableItems[
      Math.floor(Math.random() * sampleSizableItems.length)
    ];

    // Remove any stray quotes from CSV lines
    setCurrentCohort(randomCohort.replace(/"/g, ''));
    setCurrentSizable(randomSizable.replace(/"/g, ''));
  };

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

  // If both sizers guess the same number => +1 point each
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

  // Judge votes for single winner
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

  // Track sizers' typed estimates
  const handleEstimateChange = (playerIndex, value) => {
    setEstimates({ ...estimates, [playerIndex]: value });
  };

  // Is there a champion?
  const champion = players.find((p) => p.score >= targetScore);

  // Start Game
  const handleStartGame = () => {
    setSetupError('');
    const trimmed = tempNames.map((n) => n.trim());
    if (trimmed.some((name) => !name)) {
      setSetupError('All players must have a non-empty, unique name.');
      return;
    }
    const lowerCased = trimmed.map((n) => n.toLowerCase());
    const uniqueSet = new Set(lowerCased);
    if (uniqueSet.size !== lowerCased.length) {
      setSetupError('All player names must be unique.');
      return;
    }
    const newPlayers = trimmed.map((name) => ({ name, score: 0 }));
    setPlayers(newPlayers);
    setStage('playing');
  };

  // If we're still at setup
  if (stage === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <motion.div
          className="bg-gray-700 bg-opacity-80 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="text-3xl font-bold mb-6 text-center">Sizeable Game Setup</h1>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Number of Players</label>
            <select
              value={numPlayers}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setNumPlayers(val);
                setTempNames([]);
              }}
              className="w-24 p-2 rounded border border-gray-300 bg-gray-50 text-gray-800"
            >
              {[...Array(8)].map((_, i) => {
                const val = i + 3; // options 3..10
                return (
                  <option key={val} value={val}>
                    {val}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Enter Player Names</h2>
            {[...Array(numPlayers)].map((_, i) => (
              <div key={i} className="mb-3">
                <label className="block text-sm mb-1">
                  Player {i + 1}
                </label>
                <input
                  type="text"
                  className="p-2 w-full rounded border border-gray-300 bg-gray-50 text-gray-800"
                  value={tempNames[i] || ''}
                  onChange={(e) => {
                    const arr = [...tempNames];
                    arr[i] = e.target.value;
                    setTempNames(arr);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Target Score</label>
            <select
              value={targetScore}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTargetScore(val);
              }}
              className="w-24 p-2 rounded border border-gray-300 bg-gray-50 text-gray-800"
            >
              {[...Array(8)].map((_, i) => {
                const val = i + 3; // options 3..10
                return (
                  <option key={val} value={val}>
                    {val}
                  </option>
                );
              })}
            </select>
          </div>

          {setupError && (
            <div className="text-red-400 font-semibold text-center mb-4">
              {setupError}
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={handleStartGame}
              className="bg-indigo-500 hover:bg-indigo-600 transition-colors duration-300 text-white px-5 py-2 rounded font-semibold"
            >
              Start Game
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // If there's a champion
  if (champion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <motion.div
          className="bg-gray-700 bg-opacity-80 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="text-3xl font-bold mb-6">We Have a Champion!</h1>
          <p className="text-xl mb-6">
            Congratulations <span className="font-semibold">{champion.name}</span>, you reached {champion.score} points!
          </p>
          <button
            onClick={() => {
              const resetPlayers = players.map((p) => ({ ...p, score: 0 }));
              setPlayers(resetPlayers);
              setCurrentSizers([0, 1]);
              setEstimates({});
              setStage('setup');
            }}
            className="bg-green-500 hover:bg-green-600 transition-colors duration-300 text-white px-5 py-2 rounded font-semibold"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Game in progress
  const [sizerA, sizerB] = currentSizers;
  const estimateA = estimates[sizerA] || '';
  const estimateB = estimates[sizerB] || '';
  const bothGuessedSame = estimateA && estimateB && estimateA === estimateB;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <motion.div
        className="bg-gray-700 bg-opacity-80 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h1 className="text-3xl font-bold mb-8 text-center">Sizeable Game</h1>

        {/* Scores */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Scores</h2>
          <div className="space-y-3">
            {players.map((player, idx) => (
              <div
                key={idx}
                className="bg-gray-800/80 rounded flex items-center justify-between px-4 py-2"
              >
                <span className="font-medium text-lg">{player.name}</span>
                <span className="bg-gray-900 px-4 py-1 rounded-lg font-semibold tracking-wide">
                  {player.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Question */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold mb-2">Current Question</h2>
          <p className="text-lg">
            <span className="font-bold">{currentSizable}</span> in{' '}
            <span className="font-bold">{currentCohort}</span>?
          </p>
          <p className="text-sm text-gray-300 mt-2">
            (All players should agree on the scope before proceeding.)
          </p>
        </div>

        {/* Sizers' Estimates */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Sizers' Estimates</h2>
          <div className="mb-4">
            <label className="block font-medium mb-1">
              {players[sizerA].name}'s Estimate
            </label>
            <input
              type="number"
              className="w-full p-2 rounded border border-gray-400 bg-gray-50 text-gray-800"
              placeholder="Enter a single, exact number"
              value={estimateA}
              onChange={(e) => handleEstimateChange(sizerA, e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block font-medium mb-1">
              {players[sizerB].name}'s Estimate
            </label>
            <input
              type="number"
              className="w-full p-2 rounded border border-gray-400 bg-gray-50 text-gray-800"
              placeholder="Enter a single, exact number"
              value={estimateB}
              onChange={(e) => handleEstimateChange(sizerB, e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-300">
            (Each Sizer has ~2 minutes to think and write their estimate, then reveal.)
          </p>
        </div>

        {/* Judges' Decision */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Judges' Decision</h2>
          <p className="text-gray-200 mb-6">
            Vote on the most plausible estimate or pick an alternative outcome:
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => handleVote(sizerA)}
              className="bg-blue-600 hover:bg-blue-700 transition-colors duration-300 text-white px-5 py-2 rounded font-medium"
            >
              Vote for {players[sizerA].name}
            </button>
            <button
              onClick={() => handleVote(sizerB)}
              className="bg-blue-600 hover:bg-blue-700 transition-colors duration-300 text-white px-5 py-2 rounded font-medium"
            >
              Vote for {players[sizerB].name}
            </button>
            <button
              onClick={handleNoPoints}
              className="bg-gray-600 hover:bg-gray-700 transition-colors duration-300 text-white px-5 py-2 rounded font-medium"
            >
              No Points
            </button>
            {bothGuessedSame && (
              <button
                onClick={handleTiePoints}
                className="bg-purple-600 hover:bg-purple-700 transition-colors duration-300 text-white px-5 py-2 rounded font-medium"
              >
                Both Correct (+1 each)
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
