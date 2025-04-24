// SignupScreen.js (Updated with navigation.reset)

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
// *** Import db and Firestore functions ***
import { auth, db } from '../firebaseConfig'; // Assuming db is exported from firebaseConfig
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
// *** NEW: Import CommonActions for navigation reset ***
import { CommonActions } from '@react-navigation/native';

const USERS_COLLECTION = 'Users'; // Define collection name
// *** NEW: Define the target screen name after successful login/signup ***
// Make sure 'BottomTabs' is the correct name of your main authenticated navigator/screen
const MAIN_APP_SCREEN_NAME = 'BottomTabs';

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle signup process
  const handleSignUp = async () => {
    setError('');

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
       setError('Password must be at least 6 characters long.');
       return;
    }

    setIsLoading(true);

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;
      console.log('User created successfully in Auth:', newUser.uid);

      // --- Firestore Logic ---
      if (newUser) {
        // 2. Create Firestore document reference
        const userDocRef = doc(db, USERS_COLLECTION, newUser.uid);

        // 3. Define user data
        const userData = {
          uid: newUser.uid,
          email: newUser.email,
          verificationStatus: "Not Applied", // Add required field
          createdAt: serverTimestamp(),
          // Add any other default fields
        };

        // 4. Write data to Firestore
        await setDoc(userDocRef, userData);
        console.log('Firestore user document created successfully!');

        // --- MODIFICATION: Reset Navigation Stack ---
        // 5. Reset stack to the main app screen instead of replacing
        console.log(`Signup successful, resetting navigation stack to: ${MAIN_APP_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0, // Make the first route active
            routes: [
              // Define the new stack - only the main authenticated screen
              { name: MAIN_APP_SCREEN_NAME },
            ],
          })
        );
        // --- END MODIFICATION ---

      } else {
          throw new Error("User account created but user data is not available.");
      }

    } catch (error) {
      console.error("Signup Error:", error);
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak (min. 6 characters).';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      setError(errorMessage);
      // Alert.alert("Signup Failed", errorMessage); // Optional: Use Alert for more prominent errors
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
            <LinearGradient colors={['#C40000', '#FF0000']} style={styles.gradientContainer}>
              <Image source={require('../assets/cart.png')} style={styles.image} />
              <Text style={styles.title}>Join TechNest Ghazi</Text>
              <Text style={styles.subtitle}>Create an account to start shopping</Text>
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

              <View style={styles.inputWrapper}>
                <Icon name="lock" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#FF0000" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              onPress={handleSignUp}
              style={[styles.button, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign Up</Text>}
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signupText}>
                Already have an account? <Text style={styles.signupLink}>Login</Text>
              </Text>
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
    height: '45%', // Adjust as needed
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
    // height: 42, // MinHeight might be better than fixed height with multiline possibility
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

export default SignupScreen;