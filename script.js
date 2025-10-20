document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scheduleForm');
    const resultMessage = document.getElementById('resultMessage');
    const scheduleContainer = document.querySelector('.schedule-container');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // 1. Get User Input
        const numPlayers = parseInt(document.getElementById('numPlayers').value);
        const numCourts = parseInt(document.getElementById('numCourts').value);
        const numRounds = parseInt(document.getElementById('numRounds').value);

        // Clear previous results
        scheduleContainer.innerHTML = '';
        
        // Input Validation
        if (numPlayers < 4 || numCourts < 1) {
            resultMessage.innerHTML = `<p style="color:red;">Please enter at least 4 players and 1 court.</p>`;
            return;
        }
        if (numCourts * 4 > numPlayers) {
             resultMessage.innerHTML = `<p style="color:red;">The number of courts (${numCourts}) can't accommodate all ${numPlayers} players without excessive byes (need at least ${Math.ceil(numPlayers / 4)} courts).</p>`;
             return;
        }

        // 2. Generate and Display Schedule
        const result = matchUp(numPlayers, numRounds, numCourts, "N");
        displaySchedule(result.schedule, result.stats, resultMessage, scheduleContainer, numCourts, numPlayers);
    });
});

// --- CORE SCHEDULING HEURISTIC FUNCTIONS ---

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Generates all unique quartets [P1, P2, P3, P4] from a pool of players (indices).
 * P1 & P2 are team A, P3 & P4 are team B.
 * Ensures P1 < P2, P3 < P4, and canonical ordering for the teams themselves.
 */
function generateQuartets(pool) {
    const quartets = [];
    // Ensure the pool is sorted for canonical pairing
    pool.sort((a, b) => a - b); 

    for (let i = 0; i < pool.length; i++) {
        let p1 = pool[i];
        for (let j = i + 1; j < pool.length; j++) {
            let p2 = pool[j];
            // Team A is (P1, P2) where P1 < P2

            let remaining = pool.filter(p => p !== p1 && p !== p2);
            if (remaining.length < 2) continue;

            for (let k = 0; k < remaining.length; k++) {
                let p3 = remaining[k];
                for (let l = k + 1; l < remaining.length; l++) {
                    let p4 = remaining[l];
                    
                    // Team B is (P3, P4) where P3 < P4
                    // Canonical ordering: Min index of Team A must be less than Min index of Team B
                    // This prevents [1,2,3,4] vs [3,4,1,2] matches
                    const minA = Math.min(p1, p2);
                    const minB = Math.min(p3, p4);

                    if (minA < minB) {
                         // Final quartet format: [P1, P2, P3, P4] (indices)
                         quartets.push([p1, p2, p3, p4]); 
                    }
                }
            }
        }
    }
    return quartets;
}

/**
 * Generates an optimized, highly-constrained doubles schedule using a greedy heuristic.
 * The core challenge is the simultaneous satisfaction of:
 * 1. NO Repeated Partners (Hard Constraint)
 * 2. Minimized Repeated Opponents (Soft Constraint)
 * 3. Minimized Court Imbalance (Soft Constraint)
 */
function matchUp(N, numRounds, numCourts, rand = "N") {
    rand = rand.trim().toUpperCase();
    
    // Weights for Heuristic Scoring
    const partnerPenalty = 100000; // Hard fail if > 0
    const opponentPenalty = 5;      // Higher weight than court
    const courtPenalty = 1;         // Lowest weight for balancing
    
    // --- 1. Initialization ---
    var partners = Array.from({ length: N }, () => new Array(N).fill(0));
    var opponents = Array.from({ length: N }, () => new Array(N).fill(0));
    var courts = Array.from({ length: N }, () => new Array(numCourts).fill(0));
    var playerIDs = Array.from({ length: N }, (_, i) => i + 1); // P1, P2, ... P17

    if (rand === "Y") {
        shuffleArray(playerIDs);
    }

    var rounds = [];
    const playersToPlay = numCourts * 4;
    const noBye = N - playersToPlay;

    // --- 2. Schedule Generation ---
    var byeIdx = N - 1; // Start bye rotation from the last player index (P17)

    for (let r = 0; r < numRounds; r++) {
        let roundMatches = [];
        let usedInRound = new Set();
        
        // a. Determine Bye Players (rotates P17, P16, P15...)
        let currentByeIndices = [];
        if (noBye > 0) {
            for (let i = 0; i < noBye; i++) {
                currentByeIndices.push(byeIdx);
                byeIdx = (byeIdx - 1 + N) % N; // Rotate index down
            }
        }
        
        let availablePlayers = playerIDs
            .map((id, index) => index) // Get indices 0 to N-1
            .filter(index => !currentByeIndices.includes(index));

        // b. Greedily fill courts
        for (let court = 0; court < numCourts; court++) {
            
            let pool = availablePlayers.filter(i => !usedInRound.has(i));
            if (pool.length < 4) break; 

            const possibleQuartets = generateQuartets(pool);

            let bestQuartet = null;
            let minScore = Number.MAX_VALUE;

            for (const quartet of possibleQuartets) {
                const [p1, p2, p3, p4] = quartet;
                
                // --- Calculate Penalty Score ---
                let score = 0;
                
                // 1. Partner Repetition (Hard Constraint: must be 0)
                if (partners[p1][p2] > 0 || partners[p3][p4] > 0) {
                    score += partnerPenalty; 
                }
                
                // 2. Opponent Repetition (Quadratic to heavily penalize 2+ times)
                let oppScore = 
                    (opponents[p1][p3]**2 + opponents[p1][p4]**2 + 
                     opponents[p2][p3]**2 + opponents[p2][p4]**2);
                score += oppScore * opponentPenalty;
                
                // 3. Court Imbalance (Linear penalty for current court)
                let courtScore = 
                    (courts[p1][court] + courts[p2][court] + 
                     courts[p3][court] + courts[p4][court]);
                score += courtScore * courtPenalty;

                // 4. Tie-breaker Randomness
                score += Math.random() * 0.001; 

                if (score < minScore) {
                    minScore = score;
                    bestQuartet = quartet;
                }
            }

            // c. Commit the Match
            if (bestQuartet) {
                const [p1, p2, p3, p4] = bestQuartet;

                // Update partners (symmetric)
                partners[p1][p2]++; partners[p2][p1]++;
                partners[p3][p4]++; partners[p4][p3]++;
                
                // Update opponents (symmetric)
                opponents[p1][p3]++; opponents[p3][p1]++; 
                opponents[p1][p4]++; opponents[p4][p1]++;
                opponents[p2][p3]++; opponents[p3][p2]++; 
                opponents[p2][p4]++; opponents[p4][p2]++;

                // Update courts
                courts[p1][court]++; courts[p2][court]++; 
                courts[p3][court]++; courts[p4][court]++;
                
                // Record match for output and mark players as used
                roundMatches.push([p1, p2, p3, p4, court + 1]);
                bestQuartet.forEach(p => usedInRound.add(p));
            } else {
                // If a court cannot be filled without violating the hard partner rule, stop this round early
                console.warn(`Round ${r + 1}: Could not find a valid match for court ${court + 1} without repeating a partner.`);
                break; 
            }
        }

        // d. Record Round Results
        const roundOutput = {
            R: r + 1,
            Bye: currentByeIndices.map(i => `P${playerIDs[i]}`).join(', ') || 'None',
            Matches: roundMatches.map(([p1, p2, p3, p4, court]) => ({
                court: court,
                partners: [`P${playerIDs[p1]}`, `P${playerIDs[p2]}`],
                opponents: [`P${playerIDs[p3]}`, `P${playerIDs[p4]}`]
            }))
        };
        rounds.push(roundOutput);
    }
    
    return {
        schedule: rounds, 
        stats: { partners: partners, opponents: opponents, courts: courts, playerIDs: playerIDs }
    };
}


// --- DISPLAY FUNCTIONS ---

function formatMatch(match) {
    const p1 = match.partners.join(' & ');
    const p2 = match.opponents.join(' & ');
    return `(${p1}) vs (${p2})`;
}

function displaySchedule(schedule, stats, resultMessage, scheduleContainer, numCourts, numPlayers) {
    // 1. Display Schedule Table
    let html = '<h2>Match Schedule</h2>';
    html += '<div class="schedule-table-wrapper">';
    html += '<table><thead><tr><th>Round</th><th>Bye Player(s)</th>';
    for (let c = 1; c <= numCourts; c++) {
        html += `<th>Court ${c}</th>`;
    }
    html += '</tr></thead><tbody>';

    schedule.forEach(round => {
        html += '<tr>';
        html += `<td>${round.R}</td>`;
        html += `<td class="bye">${round.Bye}</td>`;
        
        let matchMap = new Map();
        round.Matches.forEach(m => matchMap.set(m.court, m));

        for (let c = 1; c <= numCourts; c++) {
            const match = matchMap.get(c);
            if (match) {
                const courtClass = `court-${c % 4 + 1}`; 
                html += `<td><span class="${courtClass}">${formatMatch(match)}</span></td>`;
            } else {
                html += `<td>-</td>`;
            }
        }
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    
    // 2. Display Stats
    html += '<h2>Fairness Metrics (Total Counts)</h2>';
    html += displayStatsMatrix(stats.partners, 'Partners', numPlayers, stats.playerIDs);
    html += displayStatsMatrix(stats.opponents, 'Opponents', numPlayers, stats.playerIDs);
    html += displayStatsMatrix(stats.courts, 'Court Assignments', numPlayers, stats.playerIDs, true, numCourts);

    scheduleContainer.innerHTML = html;
    
    resultMessage.innerHTML = `
        <h3>Schedule Generated Successfully!</h3>
        <p style="color: blue; font-weight: bold;">
            This schedule strictly enforces the "NO REPEATED PARTNERS" rule and uses a heuristic 
            to maximize fairness in opponent and court usage.
        </p>
    `;
}

function displayStatsMatrix(matrix, title, N, playerIDs, isCourt = false, numCourts) {
    let html = `<h3>${title} Matrix</h3>`;
    html += `<div class="stats-table-wrapper"><table><thead><tr><th>Player</th>`;
    
    if (isCourt) {
        for (let c = 0; c < numCourts; c++) html += `<th>C${c + 1}</th>`;
        html += `<th>Total</th>`;
    } else {
        for (let j = 0; j < N; j++) html += `<th>P${playerIDs[j]}</th>`;
    }
    html += '</tr></thead><tbody>';
    
    for (let i = 0; i < N; i++) {
        html += `<tr><td><strong>P${playerIDs[i]}</strong></td>`;
        
        if (isCourt) {
            let total = 0;
            for (let j = 0; j < numCourts; j++) {
                html += `<td>${matrix[i][j]}</td>`;
                total += matrix[i][j];
            }
            html += `<td><strong>${total}</strong></td>`;
        } else {
            for (let j = 0; j < N; j++) {
                html += `<td>${i === j ? '-' : matrix[i][j]}</td>`;
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}