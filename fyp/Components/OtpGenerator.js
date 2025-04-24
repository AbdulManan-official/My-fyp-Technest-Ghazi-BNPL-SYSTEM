import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types'; // Optional: for prop type validation

const OTP_LENGTH = 6;

/**
 * Generates a random numeric OTP of a specified length.
 * @returns {string} The generated OTP string.
 */
const generateOtpValue = () => {
  const min = Math.pow(10, OTP_LENGTH - 1); // e.g., 100000 for length 6
  const max = Math.pow(10, OTP_LENGTH) - 1; // e.g., 999999 for length 6
  const otp = Math.floor(min + Math.random() * (max - min + 1));
  return String(otp);
};

/**
 * A component that generates and displays a 6-digit OTP.
 * It provides a function to trigger generation and calls a callback
 * with the newly generated OTP.
 */
const OtpGenerator = ({
    buttonText = 'Generate Delivery OTP', // Default button text
    onOtpGenerated, // Callback function: (otp: string) => void
    style, // Optional style for the container
    buttonStyle, // Optional style for the button
    textStyle // Optional style for the OTP display text
}) => {
    const [generatedOtp, setGeneratedOtp] = useState(null);

    /**
     * Generates a new OTP, updates the state, and calls the callback prop.
     */
    const handleGenerateOtp = useCallback(() => {
        const newOtp = generateOtpValue();
        setGeneratedOtp(newOtp);
        console.log(`[OtpGenerator] Generated OTP: ${newOtp}`);

        // Call the parent's callback function with the new OTP
        if (typeof onOtpGenerated === 'function') {
            onOtpGenerated(newOtp);
        } else {
            console.warn("[OtpGenerator] 'onOtpGenerated' prop is not a function or not provided.");
        }
    }, [onOtpGenerated]); // Dependency on the callback prop

    return (
        <View style={[styles.container, style]}>
            {/* Button to trigger OTP generation */}
            <TouchableOpacity
                style={[styles.button, buttonStyle]}
                onPress={handleGenerateOtp}
                activeOpacity={0.7}
            >
                <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>

            {/* Display area for the generated OTP */}
            {generatedOtp && (
                <View style={styles.otpDisplayContainer}>
                    <Text style={styles.otpLabel}>Generated OTP:</Text>
                    <Text style={[styles.otpText, textStyle]}>{generatedOtp}</Text>
                </View>
            )}
        </View>
    );
};

// Optional: Define prop types for better component usage understanding
OtpGenerator.propTypes = {
  buttonText: PropTypes.string,
  onOtpGenerated: PropTypes.func.isRequired, // Make callback required
  style: PropTypes.object,
  buttonStyle: PropTypes.object,
  textStyle: PropTypes.object,
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 10,
    },
    button: {
        backgroundColor: '#4CAF50', // Example: Green button
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
        marginBottom: 15, // Space between button and display
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    otpDisplayContainer: {
        flexDirection: 'row',
        alignItems: 'baseline', // Align text nicely
        padding: 10,
        backgroundColor: '#f0f0f0', // Light background for display
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    otpLabel: {
        fontSize: 14,
        color: '#666',
        marginRight: 8,
    },
    otpText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        letterSpacing: 2, // Add some spacing for OTP digits
    },
});

export default OtpGenerator;