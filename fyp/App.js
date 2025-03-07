import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Import Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import BottomTabNavigation from './screens/userscreens/BottomTabNavigation'; // User Screens
import AdminDashboardNavigation from './screens/AdminScreens/AdminDashboardNavigation'; // Admin Screens
import HomeScreen from './screens/userscreens/HomeScreen'; // ✅ Home Screen
import ProductDetailsScreen from './screens/userscreens/ProductDetailsScreen'; // ✅ Product Detail Screen
import CheckoutScreen from './screens/userscreens/CheckoutScreen'; // ✅ Checkout Screen Import
import CartScreen from './screens/userscreens/CartScreen'; // ✅ Cart Screen Import

// Newly Added Screens
import UserProfileScreen from './screens/userscreens/UserProfileScreen'; // ✅ User Profile Screen
import UserSecurityVerificationScreen from './screens/userscreens/UserVerficationScreen'; // ✅ User Security Verification Screen
import PrivacyPolicyScreen from './screens/userscreens/PrivacyPolicyScreen'; // ✅ Privacy Policy Screen
import RulesRegulationScreen from './screens/userscreens/RulesRegulationScreen'; // ✅ Rules & Regulations Screen
import SupportChatScreen from './screens/userscreens/SupportChatScreen'; // ✅ Support Chat Screen
import AboutUsScreen from './screens/userscreens/AboutUsScreen'; // ✅ About Us Screen

const Stack = createStackNavigator();

// Custom Header with Bright Red Theme
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
      {/* ✅ Fix StatusBar Color */}
      <StatusBar backgroundColor="black" barStyle="light-content" />

      <Stack.Navigator
        initialRouteName="Login" // This will set LoginScreen as the initial screen
        screenOptions={{
          headerShown: false, // Default: No headers
        }}
      >
        {/* Authentication Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen 
          name="ForgotPassword" 
          component={ForgotPasswordScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password' })} 
        />

        {/* User Bottom Tab Navigation */}
        <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />

        {/* Admin Dashboard Tabs */}
        <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />

        {/* ✅ Home Screen */}
        <Stack.Screen name="Home" component={HomeScreen} />

        {/* ✅ Product Detail Screen */}
        <Stack.Screen 
          name="ProductDetails" 
          component={ProductDetailsScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Product Details' })} 
        />

        {/* ✅ Cart Screen */}
        <Stack.Screen 
          name="CartScreen" 
          component={CartScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Your Cart' })} 
        />

        {/* ✅ Checkout Screen */}
        <Stack.Screen 
          name="CheckoutScreen" 
          component={CheckoutScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Checkout' })} 
        />

        {/* ✅ User Screens */}
        <Stack.Screen 
          name="UserProfileScreen" 
          component={UserProfileScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Profile' })} 
        />
        <Stack.Screen 
          name="UserSecurityVerificationScreen" 
          component={UserSecurityVerificationScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'User Security Verification' })} 
        />
        <Stack.Screen 
          name="PrivacyPolicyScreen" 
          component={PrivacyPolicyScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Privacy Policy' })} 
        />
        <Stack.Screen 
          name="RulesRegulationScreen" 
          component={RulesRegulationScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Rules & Regulations' })} 
        />
        <Stack.Screen 
          name="SupportChatScreen" 
          component={SupportChatScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'Support Chat' })} 
        />
        <Stack.Screen 
          name="AboutUsScreen" 
          component={AboutUsScreen} 
          options={({ navigation }) => CustomHeader({ navigation, title: 'About Us' })} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
