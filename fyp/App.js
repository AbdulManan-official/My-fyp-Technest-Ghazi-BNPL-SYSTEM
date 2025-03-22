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
import CheckoutScreen from './screens/userscreens/CheckoutScreen'; // ✅ Checkout Screen
import CartScreen from './screens/userscreens/CartScreen'; // ✅ Cart Screen

// Newly Added Screens
import UserProfileScreen from './screens/userscreens/UserProfileScreen'; // ✅ User Profile Screen
import UserSecurityVerificationScreen from './screens/userscreens/UserVerficationScreen'; // ✅ User Security Verification Screen
import PrivacyPolicyScreen from './screens/userscreens/PrivacyPolicyScreen'; // ✅ Privacy Policy Screen
import RulesRegulationScreen from './screens/userscreens/RulesRegulationScreen'; // ✅ Rules & Regulations Screen
import SupportChatScreen from './screens/userscreens/SupportChatScreen'; // ✅ Support Chat Screen
import AboutUsScreen from './screens/userscreens/AboutUsScreen'; 
import WishlistScreen from './screens/userscreens/WishlistScreen'; // ✅ Wishlist Screen

// Orders & BNPL
import UserActiveOrders from './screens/userscreens/UserActiveOrders';
import UserBNPLSchedules from './screens/userscreens/UserBNPLSchedules';
import OrderHistoryScreen from './screens/userscreens/OrderHistoryScreen';

// ✅ New Screens You Just Built
import AdminMessageScreen from './screens/AdminScreens/AdminMessageScreen';
import MessageDetailScreen from './screens/AdminScreens/MessageDetailScreen';
import AdminDetailOrderScreen from './screens/AdminScreens/AdminDetailOrderScreen';


const Stack = createStackNavigator();

// 🔴 Custom Header (bright red)
const CustomHeader = ({ navigation, title }) => ({
  headerShown: true,
  headerStyle: { backgroundColor: '#FF0000' },
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
      <StatusBar backgroundColor="black" barStyle="light-content" />

      <Stack.Navigator
        initialRouteName="AdminDashboardTabs"
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password' })}
        />

        {/* User Navigation */}
        <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />

        {/* Admin Navigation */}
        <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />

        {/* Product & Cart Screens */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="ProductDetails"
          component={ProductDetailsScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Product Details' })}
        />
        <Stack.Screen
          name="CartScreen"
          component={CartScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Your Cart' })}
        />
        <Stack.Screen
          name="CheckoutScreen"
          component={CheckoutScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Checkout' })}
        />

        {/* User Info Screens */}
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
        <Stack.Screen
          name="WishlistScreen"
          component={WishlistScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Wishlist' })}
        />

        {/* Orders & History */}
        <Stack.Screen
          name="UserActiveOrders"
          component={UserActiveOrders}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Active Orders' })}
        />
        <Stack.Screen
          name="UserBNPLSchedules"
          component={UserBNPLSchedules}
          options={({ navigation }) => CustomHeader({ navigation, title: 'BNPL Schedule' })}
        />
        <Stack.Screen
          name="OrderHistoryScreen"
          component={OrderHistoryScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Order History' })}
        />

        {/* ✅ New Admin Message Screens */}
        <Stack.Screen
          name="AdminMessageScreen"
          component={AdminMessageScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'User Messages' })}
        />
        <Stack.Screen
  name="MessageDetailScreen"
  component={MessageDetailScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="AdminDetailOrderScreen"
  component={AdminDetailOrderScreen}
  options={({ navigation }) => CustomHeader({ navigation, title: 'Order Details' })}
/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
