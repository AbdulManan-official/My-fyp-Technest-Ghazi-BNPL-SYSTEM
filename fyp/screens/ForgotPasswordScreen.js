import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Email Validation
  const validateEmail = (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      setEmailWarning('Invalid email format.');
    } else {
      setEmailWarning('');
    }
    setEmail(text);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('Please enter your email address.');
      return;
    }

    if (emailWarning) {
      setMessage('Please enter a valid email.');
      return;
    }

    setIsLoading(true);
    try {
      setMessage('Password reset email functionality needs to be implemented.');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 3000);
    } catch (e) {
      setMessage('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Gradient Header with Image */}
      <LinearGradient
        colors={['#007BFF', '#0056D2', '#0033A0']}
        style={styles.gradientContainer}
      >
        <Image source={require('../assets/two.png')} style={styles.image} />
        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your email to reset your password
        </Text>
      </LinearGradient>

      {/* Input Field */}
      <View style={styles.inputContainer}>
        <MaterialCommunityIcons name="email-outline" size={22} color="#007BFF" />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={validateEmail}
          placeholderTextColor="#777"
          autoCapitalize="none"
        />
      </View>

      {/* Warning Message */}
      {emailWarning ? <Text style={styles.warningText}>{emailWarning}</Text> : null}

      {/* Reset Button */}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>

      {/* Display Message */}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  gradientContainer: {
    width: '100%',
    height: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
    color: '#FFC107',
    textAlign: 'center',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 2,
    width: '100%',
  },
  input: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  warningText: {
    color: '#FF8C00',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0033A0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#90CAF9',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    marginTop: 15,
    color: '#F44336',
    textAlign: 'center',
    fontSize: 14,
  },
});

export default ForgotPasswordScreen;
