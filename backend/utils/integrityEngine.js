const weights = {
    multiFace: 10,
    faceAbsent: 6,
    gazeDeviation: 2,
    audioSpeech: 4,
    browserSwitch: 5,
    typingAnomaly: 3
};

/**
 * Calculates the current integrity score based on violation durations.
 * S_current = 100 - Σ (W_i × t_i)
 * 
 * @param {Object} durations - Durations of each violation in seconds.
 * @returns {number} Integrity score clamped between 0 and 100.
 */
function calculateIntegrity(durations) {
    let penalty = 0;

    for (let key in durations) {
        penalty += (weights[key] || 0) * durations[key];
    }

    return Math.max(0, 100 - penalty);
}

module.exports = calculateIntegrity;
