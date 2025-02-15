import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Import Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import BottomTabNavigation from './screens/userscreens/BottomTabNavigation'; // User Screens
import AdminDashboardNavigation from './screens/AdminScreens/AdminDashboardNavigation'; // Admin Screens

const Stack = createStackNavigator();

// Custom Header with Pure Bright Red
const CustomHeader = ({ navigation, title }) => ({
  headerShown: true,
  headerStyle: { backgroundColor: '#FF0000' }, // Pure Bright Red
  headerTitleStyle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerLeft: () => (
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
      <MaterialIcons name="arrow-back" size={28} color="white" />
    </TouchableOpacity>
  ),
  headerTitle: title,
});

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Default: No headers
        }}
      >
        {/* Authentication Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen 
          name="Signup" 
          component={SignupScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Sign Up' })}
        />
        <Stack.Screen 
          name="ForgotPassword" 
          component={ForgotPasswordScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password' })}
        />

        {/* User Bottom Tab Navigation */}
        <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />

        {/* Admin Dashboard Tabs */}
        <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
