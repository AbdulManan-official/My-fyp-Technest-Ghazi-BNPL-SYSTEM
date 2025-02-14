import React, { useState } from 'react';
import { 
  View, TextInput, Text, StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  };

  const handleEmailChange = (input) => {
    setEmail(input);
    setEmailError(validateEmail(input) ? '' : 'Invalid email format.');
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (emailError) {
      setError('Please enter a valid email.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('User signed up:', email);
      navigation.replace('AdminDashboard');
    } catch (e) {
      setError('Failed to sign up. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#007BFF', '#0056D2', '#0033A0']} style={styles.gradientContainer}>
        <Image source={require('../assets/cod.png')} style={styles.image} />
        <Text style={styles.title}>Create a New Account</Text>
        <Text style={styles.subtitle}>Sign up to join TechNest Ghazi</Text>
      </LinearGradient>
      
      <View style={styles.inputContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons name="email" size={22} color="#007BFF" />
          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            value={email}
            onChangeText={handleEmailChange}
            placeholderTextColor="#777"
            autoCapitalize="none"
          />
        </View>
        {emailError && email === '' ? <Text style={styles.errorText}>{emailError}</Text> : null}

        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons name="lock" size={22} color="#007BFF" />
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
            <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#007BFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons name="lock" size={22} color="#007BFF" />
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
            <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#007BFF" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={handleSignUp} style={[styles.button, isLoading && styles.buttonDisabled]} disabled={isLoading}>
        {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.signupText}>Already have an account? <Text style={styles.signupLink}>Login</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  gradientContainer: { width: "100%", height: "45%", justifyContent: "center", alignItems: "center", borderBottomLeftRadius: 80, borderBottomRightRadius: 80, elevation: 8 },
  image: { width: 120, height: 120, resizeMode: "contain", marginBottom: 10 },
  title: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#FFC107", textAlign: "center", marginTop: 5 },
  inputContainer: { width: "100%", marginTop: 15 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderColor: "#E0E0E0", borderWidth: 1, borderRadius: 10, marginBottom: 12, backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 6, elevation: 2 },
  input: { flex: 1, height: 42, fontSize: 15, color: "#333", marginLeft: 10 },
  button: { backgroundColor: "#0033A0", paddingVertical: 12, borderRadius: 10, alignItems: "center", width: "100%", marginTop: 12, elevation: 4 },
  buttonDisabled: { backgroundColor: "#90CAF9" },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  signupText: { marginTop: 15, color: "#333", fontSize: 13, fontWeight: "500", alignSelf: "flex-end" },
  signupLink: { color: "#3399FF", fontWeight: "bold", textDecorationLine: "underline" },
  errorText: { color: "#F44336", fontSize: 14, marginBottom: 8, textAlign: "center" }
});

export default SignupScreen;
