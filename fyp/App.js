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
import HomeScreen from './screens/userscreens/HomeScreen';
import ProductDetailsScreen from './screens/userscreens/ProductDetailsScreen';
import CheckoutScreen from './screens/userscreens/CheckoutScreen';
import CartScreen from './screens/userscreens/CartScreen';

// Newly Added Screens
import UserProfileScreen from './screens/userscreens/UserProfileScreen';
import RequestVerificationScreen from './screens/userscreens/RequestVerificationScreen';
import PrivacyPolicyScreen from './screens/userscreens/PrivacyPolicyScreen';
import RulesRegulationScreen from './screens/userscreens/RulesRegulationScreen';
import SupportChatScreen from './screens/userscreens/SupportChatScreen';
import AboutUsScreen from './screens/userscreens/AboutUsScreen';
import WishlistScreen from './screens/userscreens/WishlistScreen';

// Orders & BNPL
import UserActiveOrders from './screens/userscreens/UserActiveOrders';
import UserBNPLSchedules from './screens/userscreens/UserBNPLSchedules';
import OrderHistoryScreen from './screens/userscreens/OrderHistoryScreen';

// Admin Screens
import AdminMessageScreen from './screens/AdminScreens/AdminMessageScreen';
import MessageDetailScreen from './screens/AdminScreens/MessageDetailScreen';
import AdminDetailOrderScreen from './screens/AdminScreens/AdminDetailOrderScreen';
import AdminProfileScreen from './screens/AdminScreens/AdminProfileScreen';
import UsersScreen from './screens/AdminScreens/UsersScreen'; // 🔁 Add this import
import UserDetailScreen from './screens/AdminScreens/UserDetailScreen';
import AdminCategoryScreen from './screens/AdminScreens/AdminCategoryScreen';
import ReportsScreen from './screens/AdminScreens/ReportsScreen';
import BNPLPlansScreen from './screens/AdminScreens/BNPLPlansScreen';

// New User Detail Screen Import
import UserVerificationDetailScreen from './screens/AdminScreens/UserVerificationDetailScreen';
import AddressEditScreen from './screens/userscreens/AddressEditScreen';
import OrderConfirmationScreen from './screens/userscreens/OrderConfirmationScreen';
const Stack = createStackNavigator();

const CustomHeader = ({ navigation, title }) => ({
  headerShown: true,
  headerStyle: { backgroundColor: '#FF0000' },
  headerTitleStyle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerLeft: () => (
    navigation.canGoBack() ? (
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 10 }}>
        <MaterialIcons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
    ) : null // Don't show anything if can't go back
  ),
  headerTitle: title,
});

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar backgroundColor="black" barStyle="light-content" />
      <Stack.Navigator
        initialRouteName="BottomTabs"
        screenOptions={{ headerShown: false }}
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

        {/* Admin Message Screens */}
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

        {/* Admin Screens */}
        <Stack.Screen
          name="UsersScreen" // 🔁 Add this new screen
          component={UsersScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Users ' })}
        />
        <Stack.Screen
          name="UserDetail"
          component={UserDetailScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'User Verification' })} />
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
          options={({ navigation }) => CustomHeader({ navigation, title: 'BNPL Plans' })}
        />

        {/* New User Detail Screen */}
        <Stack.Screen
          name="UserVerificationDetail"
          component={UserVerificationDetailScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'User Details' })}
        />
        <Stack.Screen
          name="AddressEditScreen" // Name used to navigate to this screen
          component={AddressEditScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Edit Delivery Address' })} // Use CustomHeader
        />
         <Stack.Screen
          name="OrderConfirmationScreen" // Name used to navigate to this screen
          component={OrderConfirmationScreen}
          options={({ navigation }) => CustomHeader({ navigation, title: 'Order Confirmation ' })} // Use CustomHeader
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
