import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.user_status !== 'admin') {
            return Response.json({ error: 'Accès non autorisé. Réservé aux administrateurs.' }, { status: 403 });
        }

        const { limit = 100, athlete_emails, start_date, end_date } = await req.json().catch(() => ({}));
        const responseLimit = Math.min(Math.max(limit, 50), 1000);

        let responses = await base44.entities.QuestionnaireResponse.list('-submitted_date', responseLimit);
        
        if (athlete_emails && Array.isArray(athlete_emails) && athlete_emails.length > 0) {
            responses = responses.filter(r => athlete_emails.includes(r.athlete_email));
        }
        
        if (start_date || end_date) {
            responses = responses.filter(r => {
                const submittedDate = new Date(r.submitted_date);
                const matchesStart = !start_date || submittedDate >= new Date(start_date);
                const matchesEnd = !end_date || submittedDate <= new Date(end_date);
                return matchesStart && matchesEnd;
            });
        }
        
        if (responses.length === 0) {
            return Response.json({ error: 'Aucune réponse disponible.' }, { status: 400 });
        }

        const templates = await base44.entities.QuestionnaireTemplate.list();
        
        const numericData = {};
        const questionLabels = {};
        
        responses.forEach(resp => {
            if (resp.responses && typeof resp.responses === 'object') {
                Object.keys(resp.responses).forEach(questionId => {
                    const value = resp.responses[questionId];
                    if (typeof value === 'number') {
                        if (!numericData[questionId]) {
                            numericData[questionId] = [];
                            const template = templates.find(t => t.id === resp.template_id);
                            if (template && template.questions) {
                                const question = template.questions.find(q => q.id === questionId);
                                questionLabels[questionId] = question?.athleteLabel || question?.label || questionId;
                            }
                        }
                        numericData[questionId].push(value);
                    }
                });
            }
        });

        const questionIds = Object.keys(numericData);
        
        if (questionIds.length < 2) {
            return Response.json({ error: 'Pas assez de questions numériques.' }, { status: 400 });
        }

        const reliabilityAnalysis = calculateCronbachAlpha(numericData, questionIds, questionLabels);

        let interRaterAgreement = null;
        if (athlete_emails && athlete_emails.length > 1) {
            interRaterAgreement = calculateInterRaterAgreement(responses, questionIds, questionLabels);
        }

        const factorialAnalysis = performFactorialAnalysis(numericData, questionIds, questionLabels);
        const networkAnalysis = performNetworkAnalysis(numericData, questionIds, questionLabels);

        return Response.json({
            success: true,
            sampleSize: responses.length,
            numberOfQuestions: questionIds.length,
            reliability: reliabilityAnalysis,
            interRaterAgreement: interRaterAgreement,
            factorial: factorialAnalysis,
            network: networkAnalysis
        });

    } catch (error) {
        console.error('Erreur:', error);
        return Response.json({ error: error.message || 'Erreur' }, { status: 500 });
    }
});

function calculateMean(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function calculateVariance(arr, mean) {
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

function calculateCorrelation(arr1, arr2) {
    const n = Math.min(arr1.length, arr2.length);
    const mean1 = calculateMean(arr1.slice(0, n));
    const mean2 = calculateMean(arr2.slice(0, n));
    
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;
    
    for (let i = 0; i < n; i++) {
        const diff1 = arr1[i] - mean1;
        const diff2 = arr2[i] - mean2;
        numerator += diff1 * diff2;
        sumSq1 += diff1 * diff1;
        sumSq2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
}

function calculateCronbachAlpha(numericData, questionIds, questionLabels) {
    const n = questionIds.length;
    
    const itemVariances = questionIds.map(qId => {
        const mean = calculateMean(numericData[qId]);
        return calculateVariance(numericData[qId], mean);
    });
    
    const sumItemVariances = itemVariances.reduce((sum, v) => sum + v, 0);
    
    const maxLength = Math.max(...questionIds.map(qId => numericData[qId].length));
    const totalScores = [];
    
    for (let i = 0; i < maxLength; i++) {
        let sum = 0;
        let count = 0;
        questionIds.forEach(qId => {
            if (numericData[qId][i] !== undefined) {
                sum += numericData[qId][i];
                count++;
            }
        });
        if (count > 0) totalScores.push(sum);
    }
    
    const totalMean = calculateMean(totalScores);
    const totalVariance = calculateVariance(totalScores, totalMean);
    
    const alpha = (n / (n - 1)) * (1 - (sumItemVariances / totalVariance));
    
    let interpretation = '';
    if (alpha >= 0.9) interpretation = 'Excellente fiabilité';
    else if (alpha >= 0.8) interpretation = 'Bonne fiabilité';
    else if (alpha >= 0.7) interpretation = 'Fiabilité acceptable';
    else if (alpha >= 0.6) interpretation = 'Fiabilité questionnable';
    else interpretation = 'Fiabilité faible';
    
    // Analyse item par item
    const itemAnalysis = [];
    for (let i = 0; i < n; i++) {
        const otherItemVariances = itemVariances.filter((_, idx) => idx !== i);
        const sumOtherVariances = otherItemVariances.reduce((sum, v) => sum + v, 0);
        
        const totalScoresWithoutItem = [];
        for (let j = 0; j < maxLength; j++) {
            let sum = 0;
            let count = 0;
            questionIds.forEach((qId, idx) => {
                if (idx !== i && numericData[qId][j] !== undefined) {
                    sum += numericData[qId][j];
                    count++;
                }
            });
            if (count > 0) totalScoresWithoutItem.push(sum);
        }
        
        const meanWithoutItem = calculateMean(totalScoresWithoutItem);
        const varianceWithoutItem = calculateVariance(totalScoresWithoutItem, meanWithoutItem);
        
        let alphaWithoutItem = 0;
        if (n - 1 >= 2 && varianceWithoutItem !== 0) {
            alphaWithoutItem = ((n - 1) / (n - 2)) * (1 - (sumOtherVariances / varianceWithoutItem));
        }
        
        const improvement = alphaWithoutItem - alpha;
        
        itemAnalysis.push({
            id: questionIds[i],
            label: questionLabels[questionIds[i]],
            alphaIfDeleted: parseFloat(alphaWithoutItem.toFixed(3)),
            improvement: parseFloat(improvement.toFixed(3)),
            shouldDelete: improvement > 0.05
        });
    }
    
    itemAnalysis.sort((a, b) => b.improvement - a.improvement);
    
    return {
        alpha: parseFloat(alpha.toFixed(3)),
        interpretation: interpretation,
        numberOfItems: n,
        sampleSize: totalScores.length,
        itemAnalysis: itemAnalysis
    };
}

function calculateInterRaterAgreement(responses, questionIds, questionLabels) {
    const responsesByDate = {};
    responses.forEach(resp => {
        const dateKey = resp.submitted_date.split('T')[0];
        if (!responsesByDate[dateKey]) {
            responsesByDate[dateKey] = [];
        }
        responsesByDate[dateKey].push(resp);
    });
    
    const questionAgreements = [];
    
    questionIds.forEach(qId => {
        const ratings = [];
        
        Object.entries(responsesByDate).forEach(([date, dateResponses]) => {
            if (dateResponses.length >= 2) {
                const dayRatings = dateResponses
                    .map(r => r.responses?.[qId])
                    .filter(v => typeof v === 'number');
                
                if (dayRatings.length >= 2) {
                    ratings.push(dayRatings);
                }
            }
        });
        
        if (ratings.length === 0) return;
        
        let totalAgreement = 0;
        let totalComparisons = 0;
        
        ratings.forEach(dayRatings => {
            for (let i = 0; i < dayRatings.length; i++) {
                for (let j = i + 1; j < dayRatings.length; j++) {
                    const difference = Math.abs(dayRatings[i] - dayRatings[j]);
                    if (difference <= 10) {
                        totalAgreement++;
                    }
                    totalComparisons++;
                }
            }
        });
        
        const agreementRate = totalComparisons > 0 ? totalAgreement / totalComparisons : 0;
        
        questionAgreements.push({
            id: qId,
            label: questionLabels[qId],
            agreementRate: parseFloat(agreementRate.toFixed(3)),
            numberOfComparisons: totalComparisons,
            numberOfDates: ratings.length
        });
    });
    
    const avgAgreement = questionAgreements.length > 0
        ? questionAgreements.reduce((sum, q) => sum + q.agreementRate, 0) / questionAgreements.length
        : 0;
    
    let interpretation = '';
    if (avgAgreement >= 0.8) interpretation = 'Accord excellent entre les joueurs';
    else if (avgAgreement >= 0.6) interpretation = 'Accord bon entre les joueurs';
    else if (avgAgreement >= 0.4) interpretation = 'Accord modéré entre les joueurs';
    else interpretation = 'Accord faible entre les joueurs';
    
    return {
        globalAgreement: parseFloat(avgAgreement.toFixed(3)),
        interpretation: interpretation,
        questionAgreements: questionAgreements.sort((a, b) => b.agreementRate - a.agreementRate),
        numberOfRaters: responses.length,
        description: 'Mesure l\'accord entre joueurs (écart <= 10 points = accord)'
    };
}

function performFactorialAnalysis(numericData, questionIds, questionLabels) {
    const correlationMatrix = [];
    
    for (let i = 0; i < questionIds.length; i++) {
        const row = [];
        for (let j = 0; j < questionIds.length; j++) {
            if (i === j) {
                row.push(1.0);
            } else {
                const corr = calculateCorrelation(numericData[questionIds[i]], numericData[questionIds[j]]);
                row.push(parseFloat(corr.toFixed(3)));
            }
        }
        correlationMatrix.push(row);
    }
    
    const factors = [];
    const used = new Set();
    const threshold = 0.5;
    
    for (let i = 0; i < questionIds.length; i++) {
        if (used.has(i)) continue;
        
        const factor = {
            name: `Facteur ${factors.length + 1}`,
            items: [{
                id: questionIds[i],
                label: questionLabels[questionIds[i]],
                loading: 1.0
            }]
        };
        
        used.add(i);
        
        for (let j = i + 1; j < questionIds.length; j++) {
            if (used.has(j)) continue;
            
            if (Math.abs(correlationMatrix[i][j]) >= threshold) {
                factor.items.push({
                    id: questionIds[j],
                    label: questionLabels[questionIds[j]],
                    loading: parseFloat(correlationMatrix[i][j].toFixed(3))
                });
                used.add(j);
            }
        }
        
        factors.push(factor);
    }
    
    return {
        correlationMatrix: correlationMatrix,
        factors: factors,
        numberOfFactors: factors.length,
        varianceExplained: `${((factors.length / questionIds.length) * 100).toFixed(1)}%`
    };
}

function performNetworkAnalysis(numericData, questionIds, questionLabels) {
    const edges = [];
    const threshold = 0.3;
    
    for (let i = 0; i < questionIds.length; i++) {
        for (let j = i + 1; j < questionIds.length; j++) {
            const corr = calculateCorrelation(numericData[questionIds[i]], numericData[questionIds[j]]);
            
            if (Math.abs(corr) >= threshold) {
                edges.push({
                    source: questionLabels[questionIds[i]],
                    target: questionLabels[questionIds[j]],
                    weight: parseFloat(corr.toFixed(3)),
                    type: corr > 0 ? 'positive' : 'negative'
                });
            }
        }
    }
    
    const nodeDegrees = {};
    questionIds.forEach(qId => {
        nodeDegrees[questionLabels[qId]] = 0;
    });
    
    edges.forEach(edge => {
        nodeDegrees[edge.source]++;
        nodeDegrees[edge.target]++;
    });
    
    const nodes = questionIds.map(qId => ({
        id: questionLabels[qId],
        degree: nodeDegrees[questionLabels[qId]],
        centrality: parseFloat((nodeDegrees[questionLabels[qId]] / (questionIds.length - 1)).toFixed(3))
    })).sort((a, b) => b.degree - a.degree);
    
    const possibleEdges = (questionIds.length * (questionIds.length - 1)) / 2;
    const density = parseFloat((edges.length / possibleEdges).toFixed(3));
    
    return {
        nodes: nodes,
        edges: edges,
        numberOfNodes: nodes.length,
        numberOfEdges: edges.length,
        density: density,
        interpretation: density > 0.5 ? 'Réseau dense - forte interconnexion' : 
                       density > 0.3 ? 'Réseau modéré' : 
                       'Réseau clairsemé - faible interconnexion'
    };
}