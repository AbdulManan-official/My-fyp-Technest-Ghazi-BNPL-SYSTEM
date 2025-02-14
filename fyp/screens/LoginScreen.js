import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LinearGradient } from 'expo-linear-gradient';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
  
    setIsLoading(true);
  
    if (email === "admin" && password === "1234") {
      navigation.replace("AdminDashboardTabs"); // Navigate to Admin Dashboard Tabs
    } else if (email === "user" && password === "1234") {
      navigation.replace("BottomTabs"); // Navigate to User Bottom Navigation
    } else {
      setError("Invalid email or password.");
    }
  
    setIsLoading(false);
  };
  
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Gradient Header */}
      <LinearGradient 
        colors={["#007BFF", "#0056D2", "#0033A0"]} 
        style={styles.gradientContainer}
      >
        <Image source={require("../assets/cart.png")} style={styles.image} />
        <Text style={styles.title}>Welcome to TechNest Ghazi</Text>
        <Text style={styles.subtitle}>Buy Now, Pay Later - Secure & Flexible Shopping</Text>
      </LinearGradient>

      {/* Input Fields */}
      <View style={styles.inputContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputWrapper}>
          <Icon name="email" size={22} color="#007BFF" />
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
          <Icon name="lock" size={22} color="#007BFF" />
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
            <Icon 
              name={showPassword ? "eye-off" : "eye"} 
              size={22} 
              color="#007BFF" 
            />
          </TouchableOpacity>
        </View>

        {/* Forgot Password Positioned Below Password Field */}
        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
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
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      {/* Signup Link Positioned Like Forgot Password */}
      <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.signupText}>Don't have an account? <Text style={styles.signupLink}>Sign up</Text></Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  gradientContainer: {
    width: "100%",
    height: "40%", // Reduced height slightly for better balance
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 60,  
    borderTopRightRadius: 60, 
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  image: {
    width: 120,  
    height: 120,
    resizeMode: "contain",
    marginBottom: 10,
  },
  title: {
    fontSize: 22, 
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#FFC107",
    textAlign: "center",
    marginTop: 5,
  },
  inputContainer: {
    width: "100%",
    marginTop: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: "#333",
    marginLeft: 10,
  },
  forgotPasswordText: {
    marginTop: 5,  
    color: "#3399FF", // Light Blue for Hypertext
    fontSize: 13,
    fontWeight: "500",
    alignSelf: "flex-end",
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: "#0033A0", // Dark Blue for Button
    paddingVertical: 12, 
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginTop: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "#90CAF9",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  signupText: {
    marginTop: 5,  
    color: "#333",
    fontSize: 13,
    fontWeight: "500",
    alignSelf: "flex-end",
  },
  signupLink: {
    color: "#3399FF", // Light Blue for Hypertext
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  errorText: {
    color: "#F44336",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
});

export default LoginScreen;
