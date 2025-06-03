// ForgotPasswordScreen.js (Updated to check Firestore 'Users' collection)

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig'; // Import db for Firestore
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import Firestore functions

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    setMessage('');
    const trimmedEmail = email.trim(); // Use a trimmed version consistently
    const lowerCaseEmail = trimmedEmail.toLowerCase(); // For case-insensitive Firestore query

    // 1. Client-Side Validations
    if (!trimmedEmail) {
      Alert.alert('Missing Email', 'Please enter your email address to reset your password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(
        'Invalid Email Format',
        'Please enter a valid email address (e.g., user@example.com).'
      );
      return;
    }

    setIsLoading(true);
    try {
      // 2. Check if email exists in Firestore 'Users' collection
      // Ensure your 'email' field in Firestore is stored consistently (e.g., lowercase)
      const usersRef = collection(db, 'Users');
      const q = query(usersRef, where('email', '==', lowerCaseEmail)); // Query by the lowercase email
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Email not found in Firestore 'Users' collection
        const notRegisteredMsg = "This email is not registered in our system. Please check the email or sign up.";
        Alert.alert('Email Not Found', notRegisteredMsg);
        setMessage(notRegisteredMsg);
        setIsLoading(false); // Stop loading before returning
        return;
      }

      // 3. If email exists in Firestore, proceed to send password reset email via Auth
      await sendPasswordResetEmail(auth, trimmedEmail); // Use the original trimmed email for Auth
      const successMsg = 'Password reset instructions have been sent to your email. Please check your inbox (and spam folder).';
      Alert.alert('Email Sent', successMsg);
      setMessage(successMsg);

    } catch (err) {
      // This catch block will now primarily handle errors from sendPasswordResetEmail
      // or errors during the Firestore query itself (though less common if permissions are right)
      // console.error("Error:", err.code, err.message); // Comment out to suppress console logs

      let alertTitle = "Operation Failed";
      let alertMessage = "An unexpected error occurred. Please try again.";
      let inlineErrorMessage = alertMessage;

      // Handle Firebase Auth specific errors if they still occur (e.g., network, too many requests)
      // The 'auth/user-not-found' from Auth might be redundant if Firestore check is perfect,
      // but good as a fallback.
      if (err.code === 'auth/user-not-found') { // Should ideally be caught by Firestore check now
        alertTitle = "Email Not Registered (Auth)";
        alertMessage = "This email is not registered with an authentication account. Please check the email or sign up.";
        inlineErrorMessage = "This email is not registered (Auth).";
      } else if (err.code === 'auth/invalid-email') {
        alertTitle = "Invalid Email (Auth System Check)";
        alertMessage = "The email address provided is invalid according to the authentication system.";
        inlineErrorMessage = "The email address is invalid (Auth).";
      } else if (err.code === 'auth/too-many-requests') {
        alertTitle = "Too Many Attempts";
        alertMessage = "We have blocked all requests from this device due to unusual activity. Try again later.";
        inlineErrorMessage = "Too many requests. Please try again later.";
      } else if (err.message) { // Generic error message
        alertMessage = err.message;
        inlineErrorMessage = err.message;
      }

      Alert.alert(alertTitle, alertMessage);
      setMessage(inlineErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <LinearGradient colors={['#C40000', '#FF0000']} style={styles.gradientContainer}>
              <Image source={require('../assets/forgot.png')} style={styles.image} />
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>Enter your registered email to reset your password</Text>
            </LinearGradient>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Icon name="email" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => setEmail(text)} // Trimming and lowercasing done in handler
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {message ? (
              <Text
                style={[
                  styles.message,
                  message.toLowerCase().includes('sent') || message.toLowerCase().includes('success')
                    ? styles.successMessage
                    : styles.errorMessage,
                ]}
              >
                {message}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleResetPassword}
              style={[styles.button, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signupText}>
                Remember your password? <Text style={styles.signupLink}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  gradientContainer: {
    width: '100%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 30,
  },
  image: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#FFCCBC',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  button: {
    backgroundColor: '#FF0000',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#FF6666',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 10,
  },
  successMessage: {
    color: '#4CAF50',
  },
  errorMessage: {
    color: '#F44336',
  },
  signupText: {
    marginTop: 20,
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'center',
  },
  signupLink: {
    color: '#FF0000',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default ForgotPasswordScreen;