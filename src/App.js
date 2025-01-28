import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Publicly available Google Sheets CSV links
const GEO_URL =
  'https://docs.google.com/spreadsheets/d/1zeW6OCKSnpCKt6o1VRGZ2yR3mTCH1OmPY7m_zHVURHI/export?format=csv&gid=768712458';
const SIZABLE_URL =
  'https://docs.google.com/spreadsheets/d/1zeW6OCKSnpCKt6o1VRGZ2yR3mTCH1OmPY7m_zHVURHI/export?format=csv&gid=0';

// WARNING: This front-end approach exposes your API key in the browser bundle.
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || '';

function App() {
  // Stage: 'setup' or 'playing'
  const [stage, setStage] = useState('setup');

  // For setup
  const [numPlayers, setNumPlayers] = useState(3); // default to 3
  const [tempNames, setTempNames] = useState([]);
  const [setupError, setSetupError] = useState('');

  // After setup, store the real players array
  const [players, setPlayers] = useState([]);

  // Fetch data arrays
  const [sampleGeographicCohorts, setSampleGeographicCohorts] = useState([]);
  const [sampleSizableItems, setSampleSizableItems] = useState([]);

  // Indices of current Sizers
  const [currentSizers, setCurrentSizers] = useState([0, 1]);

  // Current question
  const [currentCohort, setCurrentCohort] = useState('');
  const [currentSizable, setCurrentSizable] = useState('');

  // Each Sizer's estimate
  const [estimates, setEstimates] = useState({});

  // Target Score (dropdown from 3 to 10)
  const [targetScore, setTargetScore] = useState(3);

  // ChatGPT state
  const [aiAnswer, setAiAnswer] = useState('');

  // Fetch geographic cohorts once
  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.text())
      .then((text) => {
        const lines = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line);
        setSampleGeographicCohorts(lines);
      })
      .catch((err) => console.error('Error fetching geographic cohorts:', err));
  }, []);

  // Fetch sizable items once
  useEffect(() => {
    fetch(SIZABLE_URL)
      .then((res) => res.text())
      .then((text) => {
        const lines = text
          .split('\n')
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
    ].replace(/"/g, '');
    const randomSizable = sampleSizableItems[
      Math.floor(Math.random() * sampleSizableItems.length)
    ].replace(/"/g, '');

    setCurrentCohort(randomCohort);
    setCurrentSizable(randomSizable);
  };

  // When we move to 'playing'
  useEffect(() => {
    if (stage === 'playing') {
      drawNewCards();
      setCurrentSizers([0, 1]);
    }
    // eslint-disable-next-line
  }, [stage, sampleGeographicCohorts, sampleSizableItems]);

  // Round-robin logic
  const nextRound = (winnerIndex, loserIndex) => {
    let newSizerIndex = (loserIndex + 1) % players.length;
    while (newSizerIndex === winnerIndex) {
      newSizerIndex = (newSizerIndex + 1) % players.length;
    }
    setCurrentSizers([winnerIndex, newSizerIndex]);
    setEstimates({});
    setAiAnswer(''); // clear AI each round
    drawNewCards();
  };

  // If both guess same
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

  // Single winner
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

  // Sizer inputs
  const handleEstimateChange = (playerIndex, value) => {
    setEstimates({ ...estimates, [playerIndex]: value });
  };

  // *** ChatGPT integration ***
  const handleAskAi = async () => {
    try {
      if (!OPENAI_API_KEY) {
        alert('No OpenAI API key found. Set REACT_APP_OPENAI_API_KEY in environment.');
        return;
      }

      // Construct question
      const question = `${currentSizable} in ${currentCohort}?`;
      const userPrompt =
        `Answer the following question as simply as possible, giving me a single number. Use any data built into your model or on the internet. It is okay to make guesses or assumptions in order to get to a specific number.\n\n${question}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || 'No response from AI.';
      setAiAnswer(aiText.trim());
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      setAiAnswer(`Error: ${error.message}`);
    }
  };

  // *** Check for champion once. *** 
  const champion = players.find((p) => p.score >= targetScore);

  // *** Setup Screen ***
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
              {Array.from({ length: 8 }, (_, i) => i + 3).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Enter Player Names</h2>
            {[...Array(numPlayers)].map((_, i) => (
              <div key={i} className="mb-3">
                <label className="block text-sm mb-1">Player {i + 1}</label>
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
              onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
              className="w-24 p-2 rounded border border-gray-300 bg-gray-50 text-gray-800"
            >
              {Array.from({ length: 8 }, (_, i) => i + 3).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
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

  // *** If we do have a champion ***
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

  // *** Otherwise, we're in the main game ***
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
          <h2 className="text-2xl font-semibold mb-4">Sizers&apos; Estimates</h2>
          <div className="mb-4">
            <label className="block font-medium mb-1">
              {players[sizerA].name}&apos;s Estimate
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
              {players[sizerB].name}&apos;s Estimate
            </label>
            <input
              type="number"
              className="w-full p-2 rounded border border-gray-400 bg-gray-50 text-gray-800"
              placeholder="Enter a single, exact number"
 
