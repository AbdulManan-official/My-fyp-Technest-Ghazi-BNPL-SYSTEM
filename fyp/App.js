// App.js - Integrated with StripeWrapper

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar, Platform } from 'react-native'; // Added Platform
import { MaterialIcons } from '@expo/vector-icons';

// --- Import the Stripe Wrapper ---
import StripeWrapper from './Components/StripeWrapper'; // *** ADJUST PATH AS NEEDED ***

// --- Import Screens ---
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import BottomTabNavigation from './screens/userscreens/BottomTabNavigation'; // User Screens
import AdminDashboardNavigation from './screens/AdminScreens/AdminDashboardNavigation'; // Admin Screens
import HomeScreen from './screens/userscreens/HomeScreen';
import ProductDetailsScreen from './screens/userscreens/ProductDetailsScreen';
import CheckoutScreen from './screens/userscreens/CheckoutScreen';
import CartScreen from './screens/userscreens/CartScreen';
import UserProfileScreen from './screens/userscreens/UserProfileScreen';
import RequestVerificationScreen from './screens/userscreens/RequestVerificationScreen';
import PrivacyPolicyScreen from './screens/userscreens/PrivacyPolicyScreen';
import RulesRegulationScreen from './screens/userscreens/RulesRegulationScreen';
import SupportChatScreen from './screens/userscreens/SupportChatScreen';
import AboutUsScreen from './screens/userscreens/AboutUsScreen';
import WishlistScreen from './screens/userscreens/WishlistScreen';
import MyOrders from './screens/userscreens/MyOrders';
import UserBNPLSchedules from './screens/userscreens/UserBNPLSchedules'; // Screen that uses Stripe
import UserOrderDetailScreen from './screens/userscreens/UserOrderDetailScreen';
import OrderConfirmationScreen from './screens/userscreens/OrderConfirmationScreen';
import AddressEditScreen from './screens/userscreens/AddressEditScreen';
import AdminMessageScreen from './screens/AdminScreens/AdminMessageScreen';
import MessageDetailScreen from './screens/AdminScreens/MessageDetailScreen';
import AdminDetailOrderScreen from './screens/AdminScreens/AdminDetailOrderScreen';
import AdminProfileScreen from './screens/AdminScreens/AdminProfileScreen';
import UsersScreen from './screens/AdminScreens/UsersScreen';
import UserDetailScreen from './screens/AdminScreens/UserDetailScreen';
import AdminCategoryScreen from './screens/AdminScreens/AdminCategoryScreen';
import ReportsScreen from './screens/AdminScreens/ReportsScreen';
import BNPLPlansScreen from './screens/AdminScreens/BNPLPlansScreen';
import UserSchedulesProgressDetails from './screens/AdminScreens/UserSchedulesProgressDetails';
import UserVerificationDetailScreen from './screens/AdminScreens/UserVerificationDetailScreen';
import SchedulesDetailScreen from './screens/userscreens/SchedulesDetailScreen';
const Stack = createStackNavigator();

// Your Existing Custom Header Component (Keep as is)
const CustomHeader = ({ navigation, title }) => ({
  headerShown: true,
  headerStyle: { backgroundColor: '#FF0000' }, // Use your AccentColor if defined globally
  headerTitleStyle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerLeft: () => (
    navigation.canGoBack() ? (
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10, padding: 5 }}>
        <MaterialIcons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
    ) : null
  ),
  headerTitle: title,
  headerTitleAlign: 'center', // Optional: Center title
});

export default function App() {
  return (
    // Wrap the entire NavigationContainer with StripeWrapper
    
    <StripeWrapper>
      <NavigationContainer>
        {/* Use a consistent status bar color */}
        <StatusBar backgroundColor="#CC0000" barStyle="light-content" />
        <Stack.Navigator
          initialRouteName="Login"
          // Default to no header, enable specifically using options={CustomHeader(...)}
          screenOptions={{ headerShown: false }}
        >
          {/* Auth Screens */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password' })}
          />

          {/* Main User Area (via Bottom Tabs) */}
          <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />

          {/* Main Admin Area (via Admin Tabs) */}
          <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />

          {/* Standalone Screens reachable from various places */}
          {/* Product Flow */}
          {/* HomeScreen might be part of BottomTabs, remove if so */}
          {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
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
            name="CheckoutScreen" // This screen might also need Stripe
            component={CheckoutScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Checkout' })}
          />
          <Stack.Screen
            name="OrderConfirmationScreen"
            component={OrderConfirmationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Order Confirmation' })}
          />

          {/* User Account/Info Screens */}
          <Stack.Screen
            name="UserProfileScreen"
            component={UserProfileScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Profile' })}
          />
          <Stack.Screen
            name="RequestVerificationScreen"
            component={RequestVerificationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Request Verification' })}
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
            options={{ headerShown: false }} // Chat usually full screen
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
           <Stack.Screen
            name="AddressEditScreen"
            component={AddressEditScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Edit Delivery Address' })}
          />


          {/* User Orders & Schedules */}
          <Stack.Screen
            name="MyOrders" // Likely accessed from User Profile or Bottom Tabs
            component={MyOrders}
            options={{ headerShown: false }} // Assuming header is handled within MyOrders or Tabs
          />
          <Stack.Screen
            name="UserOrderDetailScreen" // Detail view for a specific user order
            component={UserOrderDetailScreen}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Order #${route.params?.order?.orderNumber || route.params?.orderId?.substring(0,6) || 'Details'}` })} // Dynamic title
          />
           <Stack.Screen
            name="UserBNPLSchedules" // The screen using Stripe
            component={UserBNPLSchedules}
            // Decide if this needs the standard header or not
            options={{ headerShown: false }} // Assuming header is handled within MyOrders or Tabs
          />


          {/* Admin Screens */}
          <Stack.Screen
            name="AdminMessageScreen"
            component={AdminMessageScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Messages' })}
          />
          <Stack.Screen
            name="MessageDetailScreen"
            component={MessageDetailScreen}
            options={{ headerShown: false }} // Chat usually full screen
          />
          <Stack.Screen
            name="AdminDetailOrderScreen" // Admin's Order Detail view
            component={AdminDetailOrderScreen}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Order #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0,6) || 'Details'}` })} // Dynamic Title
          />
           <Stack.Screen
            name="UserSchedulesProgressDetails" // Admin's Schedule Detail view
            component={UserSchedulesProgressDetails}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Schedule #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0,6) || 'Details'}` })} // Dynamic Title
          />
          <Stack.Screen
            name="UsersScreen"
            component={UsersScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Users Management' })}
          />
          <Stack.Screen // Keep or remove this old verification detail?
            name="UserDetail"
            component={UserDetailScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Verification Request' })}
          />
          <Stack.Screen // New user verification detail screen
            name="UserVerificationDetail"
            component={UserVerificationDetailScreen}
            options={({ route, navigation }) => CustomHeader({ navigation, title: route.params?.user?.name || 'User Details' })}
          />
          <Stack.Screen
            name="AdminProfileScreen"
            component={AdminProfileScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Admin Profile' })}
          />
          <Stack.Screen
            name="AdminCategoryScreen"
            component={AdminCategoryScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Manage Categories' })}
          />
          <Stack.Screen
            name="ReportsScreen"
            component={ReportsScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Reports' })}
          />
          <Stack.Screen
            name="BNPLPlansScreen"
            component={BNPLPlansScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Manage BNPL Plans' })}
          />
           <Stack.Screen
            name="SchedulesDetailScreen"
            component={SchedulesDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              // Use 'schedule' from route params now
              title: route.params?.schedule?.orderNumber
                     ? `Schedule #${route.params.schedule.orderNumber}`
                     : 'Schedule Details'
          })}          />

        </Stack.Navigator>
      </NavigationContainer>
    </StripeWrapper> // *** Close the StripeWrapper ***
  );
}