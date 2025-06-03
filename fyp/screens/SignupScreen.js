// SignupScreen.js (Updated with all requested error handling and @gmail.com validation)

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
  Alert // Make sure Alert is imported
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CommonActions } from '@react-navigation/native';

const USERS_COLLECTION = 'Users';
const MAIN_APP_SCREEN_NAME = 'BottomTabs';

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(''); // For optional inline error display
  const [isLoading, setIsLoading] = useState(false);

  // Handle signup process
  const handleSignUp = async () => {
    setError(''); // Clear previous inline error

    // --- Client-Side Validations with Alerts ---
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all fields.');
      return;
    }

    // 1. General Email format validation (client-side)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Standard email regex
    if (!emailRegex.test(email.trim())) {
      Alert.alert(
        'Invalid Email Format',
        'Please enter a valid email address (e.g., user@example.com).'
      );
      return;
    }

    // 2. Specific @gmail.com domain validation
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      Alert.alert(
        'Invalid Email Domain',
        'Please use a valid @gmail.com email address for signup.'
      );
      return;
    }

    // 3. Password Mismatch
    if (password !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'The passwords entered do not match. Please check and try again.'
      );
      return;
    }

    // 4. Password Length (at least 8 characters)
    if (password.length < 8) {
      Alert.alert(
        'Weak Password',
        'Your password must be at least 8 characters long.\n\nFor a stronger password, please consider using a combination of:\n- Uppercase letters (A-Z)\n- Lowercase letters (a-z)\n- Numbers (0-9)\n- Special characters (e.g., !@#$%^&*)',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;
      // You can keep or remove these console logs based on your debugging needs
      // console.log('User created successfully in Auth:', newUser.uid);

      if (newUser) {
        const userDocRef = doc(db, USERS_COLLECTION, newUser.uid);
        const userData = {
          uid: newUser.uid,
          email: newUser.email, // This will be the validated @gmail.com email
          verificationStatus: "Not Applied",
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, userData);
        // console.log('Firestore user document created successfully!');

        // console.log(`Signup successful, resetting navigation stack to: ${MAIN_APP_SCREEN_NAME}`);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: MAIN_APP_SCREEN_NAME }],
          })
        );
      } else {
        // This scenario is less likely if createUserWithEmailAndPassword resolves,
        // but it's a safeguard.
        throw new Error("User account created but user data is not available.");
      }

    } catch (err) {
      // The following console.error line is commented out to prevent the
      // "(NOBRIDGE) ERROR Signup Error: ..." log in the console/yellow box.
      // console.error("Signup Error:", err.code, err.message);

      let alertTitle = "Signup Failed";
      let alertMessage = "An unexpected error occurred. Please try again.";

      if (err.code === 'auth/email-already-in-use') {
        alertTitle = 'Email Already Exists';
        alertMessage = 'This email address is already registered. Please use a different email or log in.';
      } else if (err.code === 'auth/weak-password') {
        alertTitle = 'Weak Password (System Check)';
        alertMessage = 'The password provided is considered too weak by the system. Please choose a stronger password, incorporating a mix of character types.';
      } else if (err.code === 'auth/invalid-email') {
        // This is a fallback for Firebase's email validation,
        // though client-side checks should catch most.
        alertTitle = 'Invalid Email (System Check)';
        alertMessage = 'The email address provided is invalid according to the system. Please ensure it is correct.';
      } else if (err.message) {
        // Use the error message from Firebase or other caught errors
        alertMessage = err.message;
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
            <LinearGradient colors={['#C40000', '#FF0000']} style={styles.gradientContainer}>
              <Image source={require('../assets/cod.png')} style={styles.image} />
              <Text style={styles.title}>Join TechNest Ghazi</Text>
              <Text style={styles.subtitle}>Create an account to start shopping</Text>
            </LinearGradient>

            <View style={styles.inputContainer}>
              {/* Inline error display remains for errors caught by Firebase after alerts */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputWrapper}>
                <Icon name="email" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Email (e.g., user@gmail.com)" // Hint for gmail
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => setEmail(text)} // Trimming is done in handleSignUp
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Icon name="lock" size={22} color="#FF0000" />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min. 8 characters)" // Hint for password length
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

            <TouchableOpacity
              onPress={handleSignUp}
              style={[styles.button, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign Up</Text>}
            </TouchableOpacity>

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
    height: '45%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 15,
  },
  image: {
    width: 160,
    height: 160,
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
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default SignupScreen;