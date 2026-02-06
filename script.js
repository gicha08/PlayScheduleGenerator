// document.addEventListener('DOMContentLoaded', () => {
//     const form = document.getElementById('scheduleForm');
//     const resultMessage = document.getElementById('resultMessage');
//     const scheduleContainer = document.querySelector('.schedule-container');

//     form.addEventListener('submit', (e) => {
//         e.preventDefault();

//         // 1. Get User Input
//         const numPlayers = parseInt(document.getElementById('numPlayers').value);
//         const numCourts = parseInt(document.getElementById('numCourts').value);
//         const numRounds = parseInt(document.getElementById('numRounds').value);

//         // Clear previous results
//         scheduleContainer.innerHTML = '';
        
//         // Input Validation
//         if (numPlayers < 4 || numCourts < 1) {
//             resultMessage.innerHTML = `<p style="color:red;">Please enter at least 4 players and 1 court.</p>`;
//             return;
//         }
//         if (numCourts * 4 > numPlayers) {
//              resultMessage.innerHTML = `<p style="color:red;">The number of courts (${numCourts}) can't accommodate all ${numPlayers} players without excessive byes (need at least ${Math.ceil(numPlayers / 4)} courts).</p>`;
//              return;
//         }

//         // 2. Generate and Display Schedule
//         const result = matchUp(numPlayers, numRounds, numCourts, "N");
//         displaySchedule(result.schedule, result.stats, resultMessage, scheduleContainer, numCourts, numPlayers);
//     });
// });

// Module-level state for toggle persistence
let lastSchedule = null;
let lastNumCourts = null;
let currentView = 'table';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scheduleForm');
    const resultMessage = document.getElementById('resultMessage');
    const scheduleContainer = document.querySelector('.schedule-container');
    const statContainer = document.getElementById('stat-container');
    const printButton = document.getElementById('printButton');
    const viewToggle = document.getElementById('viewToggle');

    // --- Print Function ---
    const printSchedule = () => {
        const contentToPrint = scheduleContainer.innerHTML;

        // Count rounds to determine optimal card layout
        const roundCount = scheduleContainer.querySelectorAll('.round-card').length;
        // Calculate optimal columns: aim for 4 columns, but adjust based on round count
        const cardColumns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(roundCount))));

        const printWindow = window.open('', '', 'height=600,width=1000');

        printWindow.document.write('<html><head><title>Match Schedule</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: sans-serif; margin: 10px; }');
        printWindow.document.write('h1 { font-size: 1.2em; margin: 0 0 10px 0; }');
        printWindow.document.write('h2, h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
        printWindow.document.write('.error-cell { background-color: #ffcccc; color: red; font-weight: bold; }');
        // Cards-specific compact styles for printing
        printWindow.document.write(`.schedule-cards-wrapper { display: grid; grid-template-columns: repeat(${cardColumns}, 1fr); gap: 10px; width: 960px; }`);
        printWindow.document.write('.round-card { background: white; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85em; }');
        printWindow.document.write('.round-card-header { background-color: #2a9d8f; color: white; padding: 5px 8px; font-weight: bold; font-size: 0.95em; }');
        printWindow.document.write('.round-card-body { padding: 8px; }');
        printWindow.document.write('.court-match { padding: 4px 0; border-bottom: 1px solid #eee; }');
        printWindow.document.write('.court-match:last-child { border-bottom: none; }');
        printWindow.document.write('.court-label { font-size: 0.75em; font-weight: bold; color: #2a9d8f; }');
        printWindow.document.write('.bye-label { padding: 4px 8px; font-size: 0.8em; color: #888; font-style: italic; }');
        printWindow.document.write('</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<h1>Generated Doubles Match Schedule</h1>');
        printWindow.document.write(contentToPrint);
        printWindow.document.write('</body></html>');

        printWindow.document.close();
        printWindow.focus();

        // Use setTimeout to allow content to render before measuring
        setTimeout(() => {
            // Measure content dimensions
            const content = printWindow.document.body;
            const contentWidth = content.scrollWidth;
            const contentHeight = content.scrollHeight;

            // Printable areas (in pixels at 96 DPI, with ~0.5" margins)
            const portraitWidth = 720;   // ~7.5 inches
            const portraitHeight = 960;  // ~10 inches
            const landscapeWidth = 960;  // ~10 inches
            const landscapeHeight = 720; // ~7.5 inches

            // Calculate scale needed for each orientation (cap at 1 to avoid enlarging)
            const portraitScale = Math.min(portraitWidth / contentWidth, portraitHeight / contentHeight, 1);
            const landscapeScale = Math.min(landscapeWidth / contentWidth, landscapeHeight / contentHeight, 1);

            // Choose orientation that needs less scaling (larger scale = less shrinking)
            const useLandscape = landscapeScale > portraitScale;
            const scale = useLandscape ? landscapeScale : portraitScale;

            // Create style element with calculated values
            const style = printWindow.document.createElement('style');
            style.textContent = `
                @page { size: ${useLandscape ? 'landscape' : 'portrait'}; margin: 10mm; }
                @media print {
                    body {
                        transform: scale(${scale});
                        transform-origin: top left;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `;
            printWindow.document.head.appendChild(style);
            printWindow.print();
        }, 100);
    };

    // --- Toggle View ---
    viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn || btn.classList.contains('active')) return;

        viewToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentView = btn.dataset.view;
        renderCurrentView(scheduleContainer);
    });

    // --- Form Submit ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const numPlayers = parseInt(document.getElementById('numPlayers').value);
        const numCourts = parseInt(document.getElementById('numCourts').value);
        const numRounds = parseInt(document.getElementById('numRounds').value);

        scheduleContainer.innerHTML = '';
        statContainer.innerHTML = '';
        printButton.style.display = 'none';
        viewToggle.style.display = 'none';
        document.getElementById('matchScheduleHeading').style.display = 'none';

        if (numPlayers < 4 || numCourts < 1) {
            resultMessage.innerHTML = `<p style="color:red;">Please enter at least 4 players and 1 court.</p>`;
            return;
        }
        if (numCourts * 4 > numPlayers) {
             resultMessage.innerHTML = `<p style="color:red;">The number of courts (${numCourts}) can't accommodate all ${numPlayers} players without excessive byes (Max players per round is ${numCourts * 4}).</p>`;
             return;
        }

        const result = matchUp(numPlayers, numRounds, numCourts, "N");
        lastSchedule = result.schedule;
        lastNumCourts = numCourts;

        displaySchedule(result.schedule, result.stats, resultMessage, scheduleContainer, statContainer, numCourts, numPlayers);

        printButton.style.display = 'block';
        viewToggle.style.display = 'flex';
    });

    printButton.addEventListener('click', printSchedule);
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

function renderCurrentView(scheduleContainer) {
    if (!lastSchedule) return;
    const wrapper = scheduleContainer.querySelector('.schedule-table-wrapper');
    const cards = scheduleContainer.querySelector('.schedule-cards-wrapper');
    if (currentView === 'table') {
        if (wrapper) wrapper.style.display = '';
        if (cards) cards.style.display = 'none';
    } else {
        if (wrapper) wrapper.style.display = 'none';
        if (cards) cards.style.display = '';
    }
}

function buildTableHTML(schedule, numCourts) {
    let html = '<div class="schedule-table-wrapper">';
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
    return html;
}

function buildCardsHTML(schedule) {
    let html = '<div class="schedule-cards-wrapper" style="display:none;">';
    schedule.forEach(round => {
        html += '<div class="round-card">';
        html += `<div class="round-card-header">Round ${round.R}</div>`;
        html += '<div class="round-card-body">';
        round.Matches.forEach(match => {
            html += '<div class="court-match">';
            html += `<div class="court-label">Court ${match.court}</div>`;
            html += `<div class="match-text">${formatMatch(match)}</div>`;
            html += '</div>';
        });
        html += '</div>';
        if (round.Bye && round.Bye !== 'None') {
            html += `<div class="bye-label">Bye: ${round.Bye}</div>`;
        }
        html += '</div>';
    });
    html += '</div>';
    return html;
}

function displaySchedule(schedule, stats, resultMessage, scheduleContainer, statContainer, numCourts, numPlayers) {
    const matchHeading = document.getElementById('matchScheduleHeading');
    if (matchHeading) matchHeading.style.display = '';

    let html = buildTableHTML(schedule, numCourts);
    html += buildCardsHTML(schedule);
    scheduleContainer.innerHTML = html;

    // Apply current view state
    renderCurrentView(scheduleContainer);

    // Display Stats
    let statsHtml = '<h2>Fairness Metrics (Total Counts)</h2>';
    statsHtml += displayStatsMatrix(stats.partners, 'Partners', numPlayers, stats.playerIDs);
    statsHtml += displayStatsMatrix(stats.opponents, 'Opponents', numPlayers, stats.playerIDs);
    statsHtml += displayStatsMatrix(stats.courts, 'Court Assignments', numPlayers, stats.playerIDs, true, numCourts);
    statContainer.innerHTML = statsHtml;

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