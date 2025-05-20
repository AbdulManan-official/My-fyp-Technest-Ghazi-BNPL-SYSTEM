// App.js

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar, Platform, View, Text, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// --- Import the Stripe Wrapper ---
import StripeWrapper from './Components/StripeWrapper';

// --- Import Screens (ensure all your screen imports are here) ---
// ... (All your screen imports remain the same)
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import BottomTabNavigation from './screens/userscreens/BottomTabNavigation';
import AdminDashboardNavigation from './screens/AdminScreens/AdminDashboardNavigation';
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
import UserBNPLSchedules from './screens/userscreens/UserBNPLSchedules';
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

const placeholderAvatarUri = 'https://via.placeholder.com/40'; // Global placeholder

// CustomHeader Component (Remains the same, capable of showing title and avatar)
const CustomHeader = ({ navigation, title, avatarUrl }) => ({
  headerShown: true,
  headerStyle: { backgroundColor: '#FF0000', elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
  headerTintColor: 'white',
  headerLeft: () => (
    navigation.canGoBack() ? (
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.customHeaderLeftButton}>
        <MaterialIcons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>
    ) : null
  ),
  headerTitleAlign: 'left',
  headerTitle: () => (
    <View style={styles.customHeaderTitleContainer}>
      {avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.customHeaderAvatar}
          defaultSource={{ uri: placeholderAvatarUri }}
        />
      ) : null}
      <Text style={styles.customHeaderTitleText} numberOfLines={1}>
        {title || 'Screen'}
      </Text>
    </View>
  ),
});

export default function App() {
  return (
    <StripeWrapper>
      <NavigationContainer>
        <StatusBar backgroundColor="#CC0000" barStyle="light-content" />
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          {/* ... (Other screens remain the same) ... */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password' })}
          />

          <Stack.Screen name="BottomTabs" component={BottomTabNavigation} />
          <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} />

          <Stack.Screen
            name="ProductDetails"
            component={ProductDetailsScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Product Details' })}
          />
          <Stack.Screen
            name="CartScreen"
            component={CartScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'My Cart' })}
          />
          <Stack.Screen
            name="CheckoutScreen"
            component={CheckoutScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Checkout' })}
          />
          <Stack.Screen
            name="OrderConfirmationScreen"
            component={OrderConfirmationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Order Confirmation' })}
          />
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

          {/* --- MODIFIED SupportChatScreen options --- */}
          {/* It will now use CustomHeader but SupportChatScreen.js will update title/avatar */}
          <Stack.Screen
            name="SupportChatScreen"
            component={SupportChatScreen}
            options={({ navigation }) => CustomHeader({
              navigation,
              title: 'Support', // Default title
              avatarUrl: null    // Default/no avatar, screen will update
                                  // or use placeholderAvatarUri if you want one initially
                                  // avatarUrl: placeholderAvatarUri
            })}
          />
          {/* --- END OF MODIFICATION --- */}

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
          <Stack.Screen
            name="MyOrders"
            component={MyOrders}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UserOrderDetailScreen"
            component={UserOrderDetailScreen}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Order #${route.params?.order?.orderNumber || route.params?.orderId?.substring(0,6) || 'Details'}` })}
          />
           <Stack.Screen
            name="UserBNPLSchedules"
            component={UserBNPLSchedules}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SchedulesDetailScreen"
            component={SchedulesDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: route.params?.schedule?.orderNumber
                     ? `Schedule #${route.params.schedule.orderNumber}`
                     : 'Schedule Details'
            })}
          />
          <Stack.Screen
            name="AdminMessageScreen"
            component={AdminMessageScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Messages' })}
          />
          <Stack.Screen
            name="MessageDetailScreen"
            component={MessageDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: route.params?.recipientName || 'Chat Details',
              avatarUrl: route.params?.recipientAvatar
            })}
          />
          <Stack.Screen
            name="AdminDetailOrderScreen"
            component={AdminDetailOrderScreen}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Order #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0,6) || 'Details'}` })}
          />
           <Stack.Screen
            name="UserSchedulesProgressDetails"
            component={UserSchedulesProgressDetails}
            options={({ route, navigation }) => CustomHeader({ navigation, title: `Schedule #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0,6) || 'Details'}` })}
          />
          <Stack.Screen
            name="UsersScreen"
            component={UsersScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Users Management' })}
          />
          <Stack.Screen
            name="UserDetail"
            component={UserDetailScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Verification Request' })}
          />
          <Stack.Screen
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
        </Stack.Navigator>
      </NavigationContainer>
    </StripeWrapper>
  );
}

// Styles for CustomHeader (ensure these are correct)
const styles = StyleSheet.create({
  customHeaderLeftButton: {
    paddingHorizontal: Platform.OS === 'ios' ? 10 : 15,
    paddingVertical: 5,
  },
  customHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#E0E0E0',
  },
  customHeaderTitleText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});