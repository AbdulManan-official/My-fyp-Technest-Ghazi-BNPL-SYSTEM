// ./../../Components/ReviewForm.js (Complete & Final - Writes to 'Reviews' Collection including userId and productId)

import React, { useState } from 'react';
import {
    View, Text, StyleSheet, Alert, TouchableOpacity,
    ActivityIndicator, Keyboard
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Ensure this path is correct
import Icon from 'react-native-vector-icons/FontAwesome';

// --- Constants ---
const ORDERS_COLLECTION = 'orders';
const REVIEWS_COLLECTION = 'Reviews'; // Collection where reviews are stored
const ACTION_RED = '#FF0000';
const STAR_SELECTED_COLOR = '#FFC107';
const STAR_UNSELECTED_COLOR = '#BDBDBD';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const INPUT_OUTLINE_COLOR = '#BDBDBD';
const INPUT_BACKGROUND_COLOR = '#FFFFFF';
const ERROR_COLOR = '#D32F2F';
const PRIMARY_TEXT_COLOR = '#333';

/**
 * ReviewForm Component
 *
 * Props:
 * - orderId (string): ID of the order document.
 * - reviewerId (string): ID of the user submitting the review (will be stored as userId).
 * - productId (string): ID of the specific product being reviewed.
 * - onReviewSubmitSuccess (function): Callback(productId) executed on successful submission.
 */
const ReviewForm = ({ orderId, reviewerId, productId, onReviewSubmitSuccess }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleStarPress = (selectedStar) => {
        setRating(selectedStar);
        if (error) setError(null);
    };

    const handleCommentChange = (text) => {
        setComment(text);
        if (error) setError(null);
    }

    const handleSubmit = async () => {
        Keyboard.dismiss();
        setError(null);

        // --- Validation ---
        if (!orderId || !reviewerId || !productId) {
            console.error("ReviewForm handleSubmit Error: Missing required prop (orderId, reviewerId, or productId).");
            Alert.alert('Submission Error', 'Cannot submit review due to missing information. Please contact support if this persists.');
            setError('An internal error occurred. Cannot submit review.');
            return;
        }
        if (rating < 1 || rating > 5) {
            setError('Please select a rating using the stars.');
            return;
        }
        if (!comment.trim()) {
            setError('Please share your experience in the comment box.');
            return;
        }

        // --- Submission Start ---
        setSubmitting(true);

        try {
            // --- Create Review Document in 'Reviews' Collection ---
            const reviewCollectionRef = collection(db, REVIEWS_COLLECTION);
            const reviewData = {
                // <<< Storing IDs >>>
                productId: productId,    // The specific product being reviewed
                userId: reviewerId,     // The ID of the user submitting the review
                // <<< Other Review Data >>>
                orderId: orderId,       // Link back to the original order
                rating: rating,         // User's star rating
                reviewText: comment.trim(), // User's comment
                timestamp: serverTimestamp(), // Time of submission
            };

            // Add the document
            const newReviewDocRef = await addDoc(reviewCollectionRef, reviewData);
            console.log(`Review document added to '${REVIEWS_COLLECTION}' successfully with ID: ${newReviewDocRef.id}`);

            // --- Update the Original Order Document ---
            const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
            await updateDoc(orderDocRef, {
                reviewSubmitted: true, // General flag indicating *a* review was submitted for this order
            });
            console.log(`Order document ${orderId} updated successfully with reviewSubmitted=true.`);

            // --- Signal Success ---
            if (onReviewSubmitSuccess && typeof onReviewSubmitSuccess === 'function') {
                onReviewSubmitSuccess(productId); // Pass back the ID of the product that was reviewed
            }

        } catch (err) {
            // --- Error Handling ---
            console.error('Error submitting review to Firestore:', err);
            setError('Failed to submit review. Please check your internet connection and try again.');
            Alert.alert(
                'Submission Failed',
                'We couldn\'t save your review right now. Please try again later.'
            );

        } finally {
            // --- Submission End ---
            setSubmitting(false); // Hide loader
        }
    };

    // --- Render UI ---
    return (
        <View style={styles.container}>
            {/* Stars */}
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starValue) => (
                    <TouchableOpacity
                        key={starValue}
                        onPress={() => handleStarPress(starValue)}
                        disabled={submitting}
                    >
                        <Icon
                            name={starValue <= rating ? 'star' : 'star-o'}
                            size={35}
                            color={starValue <= rating ? STAR_SELECTED_COLOR : STAR_UNSELECTED_COLOR}
                            style={styles.star}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Comment Input */}
            <TextInput
                label="Share your thoughts..."
                value={comment}
                onChangeText={handleCommentChange}
                multiline
                numberOfLines={4}
                mode="outlined"
                style={styles.input}
                outlineColor={INPUT_OUTLINE_COLOR}
                activeOutlineColor={ACTION_RED}
                theme={{ roundness: 8 }}
                disabled={submitting}
                maxLength={500}
            />

            {/* Error Display */}
            {error && (
                 <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Submit Button */}
            <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={styles.submitButtonWrapper}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[ACTION_RED, ACTION_RED]}
                    style={[
                        styles.submitButton,
                        submitting && styles.submitButtonDisabled
                    ]}
                >
                    {submitting ? (
                        <ActivityIndicator color={BUTTON_TEXT_COLOR} size="small" />
                    ) : (
                        <Text style={styles.buttonText}>Submit Review</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        paddingVertical: 15,
        paddingHorizontal: 5,
    },
    starsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    star: {
        marginHorizontal: 6,
    },
    input: {
        marginBottom: 15,
        backgroundColor: INPUT_BACKGROUND_COLOR,
        minHeight: 80,
    },
    errorText: {
        color: ERROR_COLOR,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 10,
        marginTop: -5,
        minHeight: 18,
    },
    submitButtonWrapper: {},
    submitButton: {
        paddingVertical: 14,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: BUTTON_TEXT_COLOR,
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default ReviewForm;