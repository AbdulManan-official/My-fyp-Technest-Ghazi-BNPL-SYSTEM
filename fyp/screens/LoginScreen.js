// LoginScreen.js (Full code with console.error suppressed for Firebase errors)

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
  Alert // Ensured Alert is imported
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig'; // Ensure the import is correct
import { signInWithEmailAndPassword } from 'firebase/auth'; // Firebase method for login
import { getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Correct Firebase Firestore imports
import { CommonActions } from '@react-navigation/native';

// Define target screen names
const ADMIN_DASHBOARD_SCREEN_NAME = 'AdminDashboardTabs';
const USER_MAIN_SCREEN_NAME = 'BottomTabs';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(''); // For inline Firebase errors
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(''); // Clear previous inline errors

    // --- Client-Side Validations with Alerts ---
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    // Email format validation (client-side)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Standard email regex
    if (!emailRegex.test(email.trim())) {
      Alert.alert(
        'Invalid Email Format',
        'Please enter a valid email address (e.g., user@example.com).'
      );
      return;
    }

    setIsLoading(true);

    try {
      // Firebase Authentication login
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password); // Trim email
      const user = userCredential.user;
      // console.log('User signed in successfully:', user.uid); // Keep for debugging if needed

      // Admin Check
      if (email.trim().toLowerCase() === 'admin@gmail.com' && password === '123456') {
        // console.log('Admin login detected.');
        const adminRef = doc(db, 'Admin', user.uid); // Reference to Admin collection
        try {
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            //  console.log('Admin document not found, creating...');
            await setDoc(adminRef, {
              uid: user.uid, // Added UID explicitly
              email: user.email,
              role: 'admin',
              createdAt: serverTimestamp(), // Use serverTimestamp
            });
            // console.log('Admin stored in Firestore.');
          } else {
            //   console.log('Admin document already exists.');
          }
        } catch (firestoreError) {
          // Log Firestore specific errors for admin setup, but still proceed with login
          // as auth was successful. User experience for admin might be slightly degraded if this fails.
          console.error("Error checking/setting Admin document:", firestoreError);
          Alert.alert("Admin Setup Note", "Login successful, but there was an issue setting up admin details in the database. Some admin features might be affected.");
        }

        // console.log(`Navigating Admin to: ${ADMIN_DASHBOARD_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: ADMIN_DASHBOARD_SCREEN_NAME }],
          })
        );
      } else {
        // console.log('Regular user login.');
        // console.log(`Navigating User to: ${USER_MAIN_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: USER_MAIN_SCREEN_NAME }],
          })
        );
      }
    } catch (err) {
      // The following console.error line is commented out to prevent the
      // "(NOBRIDGE) ERROR Login Error: ..." log in the console/yellow box.
      // console.error('Login Error:', err.code, err.message);

      let alertTitle = "Login Failed";
      let alertMessage = 'An unexpected error occurred. Please try again.';

      // Firebase Auth errors will now also use Alert
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        alertTitle = 'Login Failed';
        alertMessage = 'Incorrect email or password. Please check your credentials and try again.';
      } else if (err.code === 'auth/invalid-email') {
        alertTitle = 'Invalid Email (System Check)';
        alertMessage = 'The email address provided is invalid. Please ensure it is correct.';
      } else if (err.code === 'auth/too-many-requests') {
        alertTitle = 'Access Temporarily Disabled';
        alertMessage = 'Access to this account has been temporarily disabled due to too many failed login attempts. You can try again later or reset your password.';
      } else if (err.code === 'auth/user-disabled') {
        alertTitle = 'Account Disabled';
        alertMessage = 'This user account has been disabled.';
      } else if (err.message) {
        alertMessage = err.message; // Fallback to Firebase's message
      }

      Alert.alert(alertTitle, alertMessage);
      setError(alertMessage); // Also set the inline error message for UI display
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
            <LinearGradient
              colors={['#C40000', '#FF0000']}
              style={styles.gradientContainer}
            >
              <Image source={require('../assets/Mobile login-bro.png')} style={styles.image} />
              <Text style={styles.title}>Welcome to TechNest Ghazi</Text>
              <Text style={styles.subtitle}>Buy Now, Pay Later - Secure & Flexible Shopping</Text>
            </LinearGradient>

            <View style={styles.inputContainer}>
              {/* Inline error display is still useful for Firebase errors after Alert dismissal */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputWrapper}>
                <Icon name="email" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => setEmail(text)} // Trimming is done in handleSignIn
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

              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

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

            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}>Don't have an account? <Text style={styles.signupLink}>Sign up</Text></Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles (Keep exactly as provided in your original code) ---
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
    height: '55%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 20,
  },
  image: {
    width: 150,
    height: 150,
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
    color: '#FFCCBC',
    textAlign: 'center',
    marginTop: 5,
  },
  inputContainer: {
    width: '100%',
    marginTop: 15,
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
    backgroundColor: '#FF6666',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default LoginScreen;