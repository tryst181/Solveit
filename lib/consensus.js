/**
 * Solveit — Consensus / Cross-Verification Engine
 * Implements majority voting, numerical clustering, and text matching
 * to determine the cross-verified final answer from multiple AI models.
 */

const ConsensusEngine = (() => {

  /**
   * Run consensus on responses from multiple models for a single question
   * @param {Array} responses - Array of {answer, explanation, confidence, provider}
   * @param {string} questionType - 'mcq' | 'integer' | 'decimal' | 'short-text' | 'long-text'
   * @returns {Object} - {finalAnswer, confidence, explanations, modelVotes, consensusType}
   */
  function resolve(responses, questionType) {
    // Filter out failed/empty responses
    const valid = responses.filter(r => r && r.answer !== undefined && r.answer !== '');

    if (valid.length === 0) {
      return {
        finalAnswer: '',
        confidence: 0,
        explanations: [],
        modelVotes: [],
        consensusType: 'no-response'
      };
    }

    if (valid.length === 1) {
      return {
        finalAnswer: valid[0].answer,
        confidence: Math.min(valid[0].confidence || 60, 80), // Cap single-model confidence
        explanations: [{ provider: valid[0].provider, explanation: valid[0].explanation }],
        modelVotes: [{ provider: valid[0].provider, answer: valid[0].answer, agreed: true }],
        consensusType: 'single-model'
      };
    }

    switch (questionType) {
      case 'mcq':
        return resolveMCQ(valid);
      case 'integer':
        return resolveInteger(valid);
      case 'decimal':
        return resolveDecimal(valid);
      case 'long-text':
        return resolveLongText(valid);
      default:
        return resolveShortText(valid);
    }
  }

  /**
   * MCQ: Majority vote on the selected option text
   */
  function resolveMCQ(responses) {
    const votes = {};
    const explanations = [];

    responses.forEach(r => {
      const normalized = r.answer.trim().toLowerCase();
      if (!votes[normalized]) {
        votes[normalized] = { originalAnswer: r.answer, count: 0, totalConfidence: 0, providers: [] };
      }
      votes[normalized].count++;
      votes[normalized].totalConfidence += (r.confidence || 60);
      votes[normalized].providers.push(r.provider);
      explanations.push({ provider: r.provider, explanation: r.explanation });
    });

    // Get the option with most votes
    const sorted = Object.values(votes).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.totalConfidence - a.totalConfidence; // Tie-break by confidence
    });

    const winner = sorted[0];
    const totalModels = responses.length;
    const agreementRatio = winner.count / totalModels;

    // Calculate confidence based on agreement
    let confidence;
    if (agreementRatio >= 1.0) confidence = 98;
    else if (agreementRatio >= 0.75) confidence = 90;
    else if (agreementRatio >= 0.5) confidence = 75;
    else confidence = 55;

    const modelVotes = responses.map(r => ({
      provider: r.provider,
      answer: r.answer,
      agreed: r.answer.trim().toLowerCase() === winner.originalAnswer.trim().toLowerCase()
    }));

    return {
      finalAnswer: winner.originalAnswer,
      confidence,
      explanations,
      modelVotes,
      consensusType: agreementRatio >= 0.5 ? 'majority' : 'plurality'
    };
  }

  /**
   * Integer: Exact match majority, fallback to median
   */
  function resolveInteger(responses) {
    const explanations = responses.map(r => ({ provider: r.provider, explanation: r.explanation }));
    const numbers = [];

    responses.forEach(r => {
      const num = parseInt(r.answer, 10);
      if (!isNaN(num)) numbers.push({ value: num, provider: r.provider, confidence: r.confidence || 60 });
    });

    if (numbers.length === 0) {
      return resolveShortText(responses); // Fallback to text comparison
    }

    // Count exact matches
    const counts = {};
    numbers.forEach(n => {
      counts[n.value] = (counts[n.value] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(counts));
    const winners = Object.entries(counts)
      .filter(([_, c]) => c === maxCount)
      .map(([v]) => parseInt(v, 10));

    let finalAnswer;
    if (winners.length === 1) {
      finalAnswer = winners[0];
    } else {
      // Multiple tied: use median
      const sorted = numbers.map(n => n.value).sort((a, b) => a - b);
      finalAnswer = sorted[Math.floor(sorted.length / 2)];
    }

    const agreementRatio = maxCount / numbers.length;
    let confidence;
    if (agreementRatio >= 1.0) confidence = 98;
    else if (agreementRatio >= 0.75) confidence = 88;
    else if (agreementRatio >= 0.5) confidence = 72;
    else confidence = 50;

    const modelVotes = responses.map(r => ({
      provider: r.provider,
      answer: r.answer,
      agreed: parseInt(r.answer, 10) === finalAnswer
    }));

    return {
      finalAnswer: String(finalAnswer),
      confidence,
      explanations,
      modelVotes,
      consensusType: agreementRatio >= 0.5 ? 'majority' : 'median'
    };
  }

  /**
   * Decimal: Cluster within epsilon tolerance
   */
  function resolveDecimal(responses) {
    const explanations = responses.map(r => ({ provider: r.provider, explanation: r.explanation }));
    const numbers = [];

    responses.forEach(r => {
      const num = parseFloat(r.answer);
      if (!isNaN(num)) numbers.push({ value: num, provider: r.provider, confidence: r.confidence || 60 });
    });

    if (numbers.length === 0) {
      return resolveShortText(responses);
    }

    // Cluster within epsilon
    const epsilon = 0.01;
    const clusters = [];

    numbers.forEach(n => {
      let added = false;
      for (const cluster of clusters) {
        if (Math.abs(cluster.center - n.value) <= epsilon) {
          cluster.members.push(n);
          cluster.center = cluster.members.reduce((s, m) => s + m.value, 0) / cluster.members.length;
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({ center: n.value, members: [n] });
      }
    });

    // Pick largest cluster
    clusters.sort((a, b) => b.members.length - a.members.length);
    const winnerCluster = clusters[0];
    const finalAnswer = winnerCluster.center;

    const agreementRatio = winnerCluster.members.length / numbers.length;
    let confidence;
    if (agreementRatio >= 1.0) confidence = 97;
    else if (agreementRatio >= 0.75) confidence = 85;
    else if (agreementRatio >= 0.5) confidence = 70;
    else confidence = 48;

    // Determine decimal places from original answers
    const maxDecimals = Math.max(
      ...winnerCluster.members.map(m => {
        const parts = String(m.value).split('.');
        return parts[1] ? parts[1].length : 0;
      })
    );

    const modelVotes = responses.map(r => ({
      provider: r.provider,
      answer: r.answer,
      agreed: winnerCluster.members.some(m => m.provider === r.provider)
    }));

    return {
      finalAnswer: finalAnswer.toFixed(maxDecimals),
      confidence,
      explanations,
      modelVotes,
      consensusType: agreementRatio >= 0.5 ? 'cluster-majority' : 'largest-cluster'
    };
  }

  /**
   * Short text: Normalized string majority
   */
  function resolveShortText(responses) {
    const explanations = responses.map(r => ({ provider: r.provider, explanation: r.explanation }));

    // Normalize and count
    const votes = {};
    responses.forEach(r => {
      const normalized = r.answer.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      if (!votes[normalized]) {
        votes[normalized] = { originalAnswer: r.answer, count: 0, totalConfidence: 0, providers: [] };
      }
      votes[normalized].count++;
      votes[normalized].totalConfidence += (r.confidence || 60);
      votes[normalized].providers.push(r.provider);
    });

    const sorted = Object.values(votes).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.totalConfidence - a.totalConfidence;
    });

    const winner = sorted[0];
    const agreementRatio = winner.count / responses.length;

    let confidence;
    if (agreementRatio >= 1.0) confidence = 95;
    else if (agreementRatio >= 0.75) confidence = 82;
    else if (agreementRatio >= 0.5) confidence = 68;
    else confidence = 45;

    const winnerNorm = winner.originalAnswer.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    const modelVotes = responses.map(r => ({
      provider: r.provider,
      answer: r.answer,
      agreed: r.answer.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ') === winnerNorm
    }));

    return {
      finalAnswer: winner.originalAnswer,
      confidence,
      explanations,
      modelVotes,
      consensusType: agreementRatio >= 0.5 ? 'majority' : 'plurality'
    };
  }

  /**
   * Long text: Pick the highest-confidence model's response
   */
  function resolveLongText(responses) {
    const explanations = responses.map(r => ({ provider: r.provider, explanation: r.explanation }));

    // Sort by confidence descending
    const sorted = [...responses].sort((a, b) => (b.confidence || 60) - (a.confidence || 60));
    const winner = sorted[0];

    const modelVotes = responses.map(r => ({
      provider: r.provider,
      answer: r.answer.slice(0, 50) + (r.answer.length > 50 ? '...' : ''),
      agreed: r.provider === winner.provider
    }));

    return {
      finalAnswer: winner.answer,
      confidence: Math.min(winner.confidence || 60, 85),
      explanations,
      modelVotes,
      consensusType: 'highest-confidence'
    };
  }

  return { resolve };
})();
