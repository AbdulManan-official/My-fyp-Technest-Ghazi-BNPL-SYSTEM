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

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Hide headers globally
        }}
      >
        {/* Authentication Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />

        {/* Forgot Password Screen (With Custom Header & Back Button) */}
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerStyle: { backgroundColor: '#0033A0' },
            headerTitleStyle: { color: 'white' },
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
                <MaterialIcons name="arrow-back" size={30} color="white" />
              </TouchableOpacity>
            ),
            headerTitle: 'Forgot Password',
          })}
        />

        {/* User Bottom Tab Navigation */}
        <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />

        {/* Admin Dashboard Tabs */}
        <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
