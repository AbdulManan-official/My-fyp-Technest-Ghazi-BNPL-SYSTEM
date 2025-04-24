// LoginScreen.js (Updated with navigation.reset)

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
  Alert // Added Alert import just in case it's needed later
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig'; // Ensure the import is correct
import { signInWithEmailAndPassword } from 'firebase/auth'; // Firebase method for login
import { getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Correct Firebase Firestore imports
// *** NEW: Import CommonActions for navigation reset ***
import { CommonActions } from '@react-navigation/native';

// *** NEW: Define target screen names ***
// Make sure these match the actual names in your navigator
const ADMIN_DASHBOARD_SCREEN_NAME = 'AdminDashboardTabs';
const USER_MAIN_SCREEN_NAME = 'BottomTabs';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(''); // Clear previous errors
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    try {
      // Firebase Authentication login
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password); // Trim email
      const user = userCredential.user;
      console.log('User signed in successfully:', user.uid);

      // Check if the admin credentials are provided
      // NOTE: It's generally better to check roles from Firestore rather than hardcoding credentials here.
      // This example keeps your existing admin check logic.
      if (email.toLowerCase() === 'admin@gmail.com' && password === '123456') {
        console.log('Admin login detected.');
        // Store admin in Firestore if not already present (optional check)
        const adminRef = doc(db, 'Admin', user.uid); // Reference to Admin collection
        try {
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
             console.log('Admin document not found, creating...');
            await setDoc(adminRef, {
              uid: user.uid, // Added UID explicitly
              email: user.email,
              role: 'admin',
              createdAt: serverTimestamp(), // Use serverTimestamp
            });
            console.log('Admin stored in Firestore.');
          } else {
              console.log('Admin document already exists.');
          }
        } catch (firestoreError) {
             console.error("Error checking/setting Admin document:", firestoreError);
             // Decide if login should proceed despite Firestore error
        }

        // --- MODIFICATION: Reset stack for Admin ---
        console.log(`Navigating Admin to: ${ADMIN_DASHBOARD_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: ADMIN_DASHBOARD_SCREEN_NAME }],
          })
        );
        // --- END MODIFICATION ---

      } else {
        console.log('Regular user login.');
        // Optional: Verify if user exists in 'Users' collection if needed
        // const userRef = doc(db, 'Users', user.uid);
        // const userSnap = await getDoc(userRef);
        // if (!userSnap.exists()) { /* Handle case where user exists in Auth but not Firestore */ }

        // --- MODIFICATION: Reset stack for User ---
         console.log(`Navigating User to: ${USER_MAIN_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: USER_MAIN_SCREEN_NAME }],
          })
        );
         // --- END MODIFICATION ---
      }

      // setError(''); // Error already cleared at the start

    } catch (err) {
      console.error('Login Error:', err);
      let errorMessage = 'Invalid email or password. Please try again.';
      // Provide more specific Firebase auth errors if desired
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          errorMessage = 'Incorrect email or password.';
      } else if (err.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
          errorMessage = 'Access temporarily disabled due to too many attempts. Please try again later.';
      } else if (err.code === 'auth/user-disabled') {
          errorMessage = 'This user account has been disabled.';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

   // --- Return Statement (JSX remains unchanged) ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            {/* Gradient Header */}
            <LinearGradient
              colors={['#C40000', '#FF0000']}
              style={styles.gradientContainer}
            >
              <Image source={require('../assets/cart.png')} style={styles.image} />
              <Text style={styles.title}>Welcome to TechNest Ghazi</Text>
              <Text style={styles.subtitle}>Buy Now, Pay Later - Secure & Flexible Shopping</Text>
            </LinearGradient>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputWrapper}>
                <Icon name="email" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Icon name="lock" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={22} color="#FF0000" />
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleSignIn}
              style={[styles.button, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Signup Link */}
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}>Don't have an account? <Text style={styles.signupLink}>Sign up</Text></Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles (Keep exactly as provided) ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,  // Moves content below status bar
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
    height: '50%', // Adjust as needed
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 40, // Consider if these radii are desired
    borderTopRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 20, // Add margin if needed
  },
  image: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#FFCCBC', // Lighter color for subtitle
    textAlign: 'center',
    marginTop: 5,
  },
  inputContainer: {
    width: '100%',
    marginTop: 15, // Space below gradient
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6, // Adjust padding for consistency
    elevation: 2,
  },
  input: {
    flex: 1,
    // height: 42, // MinHeight might be better
    minHeight: 42,
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  forgotPasswordText: {
    marginTop: 5,
    color: '#FF0000',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'flex-end',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#FF0000',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#FF6666', // Lighter red when disabled
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupText: {
    marginTop: 20, // Increased margin
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
  errorText: {
    color: '#F44336', // Material Design error color
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default LoginScreen;