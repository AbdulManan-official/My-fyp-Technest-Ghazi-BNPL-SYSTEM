// utils/trendingProductsUtil.js (Refactored: "Top Rated" products logic)

// ❌ The TRENDING_WEIGHTS constant is no longer needed.

const NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW = 12;
// ✅ Minimum average rating required to be eligible
const MIN_AVERAGE_RATING = 3.5;

/**
 * Calculates a "score" which is just the product's average rating.
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

    // ✅ MODIFIED LINE: The score is now simply the averageRating itself.
    // We completely ignore the reviewCount for the score.
    const score = averageRating;

    return { score, averageRating };
}

/**
 * Calculates and returns top-rated products 
 * based on average rating and a minimum cutoff.
 * @param {Array<Object>} allProductsData 
 * @returns {Array<Object>}
 */
export const calculateTopTrendingFromList = (allProductsData) => {
    // This entire function does NOT need to be changed.
    // It will now sort by the new "score" (which is just the average rating).

    console.log('[calculateTopTrendingFromList] Received product list for "Top Rated" scoring. Count:', allProductsData.length);

    if (!allProductsData || allProductsData.length === 0) {
        console.log('[calculateTopTrendingFromList] No products provided.');
        return [];
    }

    try {
        const productsWithScores = allProductsData
            .map(product => {
                const { score, averageRating } = calculateTrendingScore(product);
                return {
                    ...product,
                    trendingScore: score,
                    _averageRating: averageRating,
                };
            })
            // Filter out products with low average rating OR zero score (no reviews)
            .filter(product => 
                product._averageRating >= MIN_AVERAGE_RATING && product.trendingScore > 0
            );

        console.log(`[calculateTopTrendingFromList] ${productsWithScores.length} products passed the minimum average rating (${MIN_AVERAGE_RATING}).`);

        // This sort now effectively sorts by averageRating, highest first.
        productsWithScores.sort((a, b) => b.trendingScore - a.trendingScore);
        console.log('[calculateTopTrendingFromList] Products sorted by average rating.');

        const topRated = productsWithScores.slice(0, NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW);

        console.log(`[calculateTopTrendingFromList] Identified top ${topRated.length} rated products:`);
        topRated.forEach(p => {
            console.log(
                `  - Name: ${p.name || 'Unnamed'}, ID: ${p.id}, Rating: ${p._averageRating.toFixed(1)}, ` +
                `Reviews: ${p.reviewCount || 0}` // Still useful to log review count
            );
        });

        return topRated;

    } catch (err) {
        console.error("[calculateTopTrendingFromList] CRITICAL ERROR calculating scores:", err);
        return [];
    }
};