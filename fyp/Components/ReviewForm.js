// ./../../Components/ReviewForm.js (CORRECTED onReviewSubmitSuccess call)

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
const REVIEWS_COLLECTION = 'Reviews';
const ACTION_RED = '#FF0000';
const STAR_SELECTED_COLOR = '#FFC107';
const STAR_UNSELECTED_COLOR = '#BDBDBD';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const INPUT_OUTLINE_COLOR = '#BDBDBD';
const INPUT_BACKGROUND_COLOR = '#FFFFFF';
const ERROR_COLOR = '#D32F2F';
const PRIMARY_TEXT_COLOR = '#333';

const ReviewForm = ({ orderId, reviewerId, productId, onReviewSubmitSuccess }) => {
    const [rating, setRating] = useState(0); // This 'rating' state holds the star value
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

        setSubmitting(true);

        try {
            const reviewCollectionRef = collection(db, REVIEWS_COLLECTION);
            const reviewData = {
                productId: productId,
                userId: reviewerId,
                orderId: orderId,
                rating: rating, // Save the selected rating to the review document
                reviewText: comment.trim(),
                timestamp: serverTimestamp(),
            };

            const newReviewDocRef = await addDoc(reviewCollectionRef, reviewData);
            console.log(`Review document added to '${REVIEWS_COLLECTION}' successfully with ID: ${newReviewDocRef.id}`);

            const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
            await updateDoc(orderDocRef, {
                reviewSubmitted: true,
            });
            console.log(`Order document ${orderId} updated successfully with reviewSubmitted=true.`);

            if (onReviewSubmitSuccess && typeof onReviewSubmitSuccess === 'function') {
                // --- THIS IS THE CRITICAL CHANGE ---
                onReviewSubmitSuccess(productId, rating); // Pass back productId AND the numeric 'rating'
                // --- END CRITICAL CHANGE ---
            }

        } catch (err) {
            console.error('Error submitting review to Firestore:', err);
            setError('Failed to submit review. Please check your internet connection and try again.');
            Alert.alert(
                'Submission Failed',
                'We couldn\'t save your review right now. Please try again later.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
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

            {error && (
                 <Text style={styles.errorText}>{error}</Text>
            )}

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