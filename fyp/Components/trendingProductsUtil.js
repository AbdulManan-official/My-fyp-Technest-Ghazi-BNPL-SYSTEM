// utils/trendingProductsUtil.js (Refactored)

// PRODUCTS_COLLECTION_NAME is not needed here anymore as we pass the products
const NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW = 16; // How many top products to return

// --- Trending Score Calculation Logic (same as before) ---
const TRENDING_WEIGHTS = {
    sales: 0.4,
    views: 0.2,
    avgRating: 0.25,
    reviewCount: 0.15
};

// function calculateTrendingScore(product) { ... same as before ... }
function calculateTrendingScore(product) {
    const reviewCount = product.reviewCount || 0;
    const totalRatingSum = product.totalRatingSum || 0;
    let averageRating = 0;

    if (reviewCount > 0) {
        averageRating = totalRatingSum / reviewCount;
    }

    const score =
        (product.salesCount || 0) * TRENDING_WEIGHTS.sales +
        (product.viewCount || 0) * TRENDING_WEIGHTS.views +
        (averageRating || 0) * TRENDING_WEIGHTS.avgRating +
        (reviewCount || 0) * TRENDING_WEIGHTS.reviewCount;
    return score;
}
// --- End Trending Score Calculation ---

/**
 * Calculates trending scores for a given list of products,
 * sorts them, and returns the top N products with their scores.
 * @param {Array<Object>} allProductsData - An array of product objects.
 * @returns {Array<Object>} An array of the top N trending product objects, each including a 'trendingScore'.
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
                const score = calculateTrendingScore(product);
                return {
                    ...product, // Spread all original product data
                    trendingScore: score,
                };
            })
            .filter(product => product.trendingScore > 0); // Optional: filter out non-eligible

        console.log(`[calculateTopTrendingFromList] Calculated scores for ${productsWithScores.length} eligible products.`);

        productsWithScores.sort((a, b) => b.trendingScore - a.trendingScore);
        console.log('[calculateTopTrendingFromList] Products sorted by trending score.');

        const topTrending = productsWithScores.slice(0, NUMBER_OF_TRENDING_PRODUCTS_TO_SHOW);

        console.log(`[calculateTopTrendingFromList] Identified top ${topTrending.length} trending products:`);
        topTrending.forEach(p => {
            const avgRating = p.reviewCount > 0 ? (p.totalRatingSum / p.reviewCount).toFixed(1) : 'N/A';
            console.log(
                `  - Name: ${p.name || 'Unnamed'}, ID: ${p.id}, Score: ${p.trendingScore.toFixed(3)}, ` +
                `Sales: ${p.salesCount || 0}, Views: ${p.viewCount || 0}, ` +
                `AvgRating: ${avgRating}, Reviews: ${p.reviewCount || 0}`
            );
        });
        
        return topTrending;

    } catch (err) {
        console.error("[calculateTopTrendingFromList] CRITICAL ERROR calculating trending scores:", err);
        return []; // Return empty on error to prevent app crash
    }
};