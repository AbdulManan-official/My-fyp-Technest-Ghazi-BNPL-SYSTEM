// src/components/StripeWrapper.js - HARDCODED Key for Fastest Init (Final Version)

import React from 'react'; // Removed useState, useEffect
import { View, StyleSheet, Text, Platform } from 'react-native'; // Removed ActivityIndicator
import { StripeProvider } from '@stripe/stripe-react-native';
// No axios needed
import { MaterialIcons } from '@expo/vector-icons'; // Keep for potential error display

// --- Constants ---
// *** HARDCODE your Stripe Publishable Key Here ***
const STRIPE_PUBLISHABLE_KEY = "pk_test_51RDNhbIzzjIEkcSVInCEEK0ZDhFUYGP9VmYjnToVT3Bp31OWLpeKnBBzTuXBbi7l2IoABAY5aSb33hh869JVnmSY00SZha0a4u"; // Replace with YOUR actual key

// Optional constants for error display styling
const OverdueColor = '#D32F2F';
const ScreenBackgroundColor = '#F8F9FA';

const StripeWrapper = ({ children }) => {

  // Basic check if the key constant was accidentally left empty during development
  if (!STRIPE_PUBLISHABLE_KEY || typeof STRIPE_PUBLISHABLE_KEY !== 'string' || !STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
     console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
     console.error("Stripe Publishable Key is missing or invalid in StripeWrapper.js!");
     console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
     return (
       <View style={styles.centeredContainer}>
         <MaterialIcons name="error" size={60} color={OverdueColor} />
         <Text style={styles.errorText}>
            Critical Error: Stripe Publishable Key is invalid or missing in the application code. Payments cannot be initialized.
         </Text>
       </View>
    );
  }

  // --- Render StripeProvider Immediately with the Hardcoded Key ---
  // The provider itself loads synchronously because the key is provided directly.
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.yourAppName" // ** REPLACE with your actual Merchant ID for Apple Pay **
      // urlScheme="your-app-url-scheme" // ** Optional: REQUIRED for certain payment methods like Alipay - REPLACE **
    >
      {/* Render the rest of your application passed as children */}
      {children}
    </StripeProvider>
  );
};

// --- Styles --- (Only needed for the error display)
const styles = StyleSheet.create({
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: ScreenBackgroundColor,
    },
    errorText: {
        textAlign: 'center',
        marginTop: 15,
        fontSize: 16,
        color: OverdueColor,
        lineHeight: 22,
    }
});

export default StripeWrapper;