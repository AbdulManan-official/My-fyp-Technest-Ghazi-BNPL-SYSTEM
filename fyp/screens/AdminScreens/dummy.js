// utils/trendingProductsUtil.js (Refactored: rating-based trending WITH weights + minimum rating cutoff)

// Keep your weights
const TRENDING_WEIGHTS = {
    avgRating: 0.25,
    reviewCount: 0.15,
};

const NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW = 12;
// ✅ Minimum average rating required to be eligible
const MIN_AVERAGE_RATING = 3.5;

/**
 * Calculates trending score using weights.
 * @param {Object} product 
 * @returns {Object} { score, averageRating }
 */
function calculateTrendingScore(product) {
    const reviewCount = product.reviewCount || 0;
    const totalRatingSum = product.totalRatingSum || 0;

    let averageRating = 0;
    if (reviewCount > 0) {
        averageRating = totalRatingSum / reviewCount;
    }

    const score =
        (averageRating * TRENDING_WEIGHTS.avgRating) +
        (reviewCount * TRENDING_WEIGHTS.reviewCount);

    return { score, averageRating };
}

/**
 * Calculates and returns top trending products 
 * based on ratings and minimum average rating cutoff.
 * @param {Array<Object>} allProductsData 
 * @returns {Array<Object>}
 */
export const calculateTopTrendingFromList = (allProductsData) => {
    console.log('[calculateTopTrendingFromList] Received product list for scoring. Count:', allProductsData.length);

    if (!allProductsData || allProductsData.length === 0) {
        console.log('[calculateTopTrendingFromList] No products provided to calculate trending.');
        return [];
    }

    try {
        const productsWithScores = allProductsData
            .map(product => {
                const { score, averageRating } = calculateTrendingScore(product);
                return {
                    ...product,
                    trendingScore: score,
                    _averageRating: averageRating, // store for filtering & logging
                };
            })
            // ✅ Filter out products with low average rating OR zero score
            .filter(product => 
                product._averageRating >= MIN_AVERAGE_RATING && product.trendingScore > 0
            );

        console.log(`[calculateTopTrendingFromList] ${productsWithScores.length} products passed the minimum average rating (${MIN_AVERAGE_RATING}) and have a valid score.`);

        productsWithScores.sort((a, b) => b.trendingScore - a.trendingScore);
        console.log('[calculateTopTrendingFromList] Products sorted by trending score.');

        const topTrending = productsWithScores.slice(0, NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW);

        console.log(`[calculateTopTrendingFromList] Identified top ${topTrending.length} trending products:`);
        topTrending.forEach(p => {
            console.log(
                `  - Name: ${p.name || 'Unnamed'}, ID: ${p.id}, Score: ${p.trendingScore.toFixed(3)}, ` +
                `AvgRating: ${p._averageRating.toFixed(1)}, Reviews: ${p.reviewCount || 0}`
            );
        });

        return topTrending;

    } catch (err) {
        console.error("[calculateTopTrendingFromList] CRITICAL ERROR calculating trending scores:", err);
        return [];
    }
};
