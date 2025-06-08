// App.js

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StatusBar, Platform, View, Text, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// --- Import the Stripe Wrapper ---
import StripeWrapper from './Components/StripeWrapper';

// --- Import Screens (ensure all your screen imports are here) ---
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
import VideoSplashScreen from './screens/VideoSplashScreen';
import LocationScreen from './screens/userscreens/LocationScreen';

const Stack = createStackNavigator();

const placeholderAvatarUri = 'https://via.placeholder.com/40'; // Global placeholder

// CustomHeader Component
const CustomHeader = ({ navigation, title, avatarUrl, titleAlign = 'left' }) => ({ // Added titleAlign, default to 'left'
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
  headerTitleAlign: titleAlign, // Use the passed titleAlign prop
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
  // You might need headerTitleContainerStyle for perfect centering with a back button on Android.
  // Example (uncomment and adjust if needed):
  // headerTitleContainerStyle: titleAlign === 'center' && navigation.canGoBack() && Platform.OS === 'android'
  //   ? { position: 'absolute', left: 0, right: 0, alignItems: 'center' }
  //   : {},
});

export default function App() {
  return (
    <StripeWrapper>
      <NavigationContainer>
        <StatusBar backgroundColor="#CC0000" barStyle="light-content" />
        <Stack.Navigator
          initialRouteName="VideoSplash"
          // Default screenOptions for all screens in this navigator
          // Titles will be centered by default unless overridden
          screenOptions={({ navigation }) => ({
            ...CustomHeader({ navigation, title: '', titleAlign: 'center' }),
          })}
        >
          <Stack.Screen
            name="VideoSplash"
            component={VideoSplashScreen}
            options={{ headerShown: false }} // no header on splash
          />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Forgot Password', titleAlign: 'center' })}
          />

          <Stack.Screen name="BottomTabs" component={BottomTabNavigation} options={{ headerShown: false }} />
          <Stack.Screen name="AdminDashboardTabs" component={AdminDashboardNavigation} options={{ headerShown: false }} />

          <Stack.Screen
            name="ProductDetails"
            component={ProductDetailsScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Product Details', titleAlign: 'center' })}
          />

          <Stack.Screen
            name="CartScreen"
            component={CartScreen}
            options={({ navigation, route }) => {
              // if (route.params?.hideHeader) { // Allow CartScreen to hide its own header if needed
              //   return { headerShown: false };
              // }
              return CustomHeader({ navigation, title: 'My Cart', titleAlign: 'center' });
            }}
          />
          <Stack.Screen
            name="CheckoutScreen"
            component={CheckoutScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Checkout', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="OrderConfirmationScreen"
            component={OrderConfirmationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Order Confirmation', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="UserProfileScreen"
            component={UserProfileScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Profile', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="RequestVerificationScreen"
            component={RequestVerificationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Request Verification', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="PrivacyPolicyScreen"
            component={PrivacyPolicyScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Privacy Policy', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="RulesRegulationScreen"
            component={RulesRegulationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Rules & Regulations', titleAlign: 'center' })}
          />

          {/* --- SupportChatScreen: Explicitly use left alignment --- */}
          <Stack.Screen
            name="SupportChatScreen"
            component={SupportChatScreen}
            options={({ navigation }) => CustomHeader({
              navigation,
              title: 'Support',      // Default title, screen can update
              avatarUrl: null,       // Default avatar, screen can update
              titleAlign: 'left'     // EXCEPTION: Set to left
            })}
          />

          <Stack.Screen
            name="AboutUsScreen"
            component={AboutUsScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'About Us', titleAlign: 'center' })}
          />

          <Stack.Screen
            name="AddressEditScreen"
            component={AddressEditScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Edit Delivery Address', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="MyOrders"
            component={MyOrders}
            options={{ headerShown: false }} // Uses its own header or no header
          />
          <Stack.Screen
            name="UserOrderDetailScreen"
            component={UserOrderDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: `Order #${route.params?.order?.orderNumber || route.params?.orderId?.substring(0, 6) || 'Details'}`,
              titleAlign: 'center'
            })}
          />
          <Stack.Screen
            name="UserBNPLSchedules"
            component={UserBNPLSchedules}
            options={{ headerShown: false }} // Uses its own header or no header
          />
          <Stack.Screen
            name="SchedulesDetailScreen"
            component={SchedulesDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: route.params?.schedule?.orderNumber
                ? `Schedule #${route.params.schedule.orderNumber}`
                : 'Schedule Details',
              titleAlign: 'center'
            })}
          />
          <Stack.Screen
            name="AdminMessageScreen"
            component={AdminMessageScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Messages', titleAlign: 'center' })}
          />

          {/* --- MessageDetailScreen: Explicitly use left alignment --- */}
          <Stack.Screen
            name="MessageDetailScreen"
            component={MessageDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: route.params?.recipientName || 'Chat Details',
              avatarUrl: route.params?.recipientAvatar,
              titleAlign: 'left' // EXCEPTION: Set to left
            })}
          />

          <Stack.Screen
            name="AdminDetailOrderScreen"
            component={AdminDetailOrderScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: `Order #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0, 6) || 'Details'}`,
              titleAlign: 'center'
            })}
          />
          <Stack.Screen
            name="UserSchedulesProgressDetails"
            component={UserSchedulesProgressDetails}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: `Schedule #${route.params?.order?.orderNumber || route.params?.order?.id?.substring(0, 6) || 'Details'}`,
              titleAlign: 'center'
            })}
          />
          <Stack.Screen
            name="UsersScreen"
            component={UsersScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Users Management', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="UserDetail"
            component={UserDetailScreen} // Assuming this is the User Verification Request screen
            options={({ navigation }) => CustomHeader({ navigation, title: 'User Verification Request', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="UserVerificationDetail" // This is for Admin to see user details
            component={UserVerificationDetailScreen}
            options={({ route, navigation }) => CustomHeader({
              navigation,
              title: route.params?.user?.name || 'User Details',
              titleAlign: 'center'
            })}
          />
          <Stack.Screen
            name="AdminProfileScreen"
            component={AdminProfileScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Admin Profile', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="AdminCategoryScreen"
            component={AdminCategoryScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Manage Categories', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="ReportsScreen"
            component={ReportsScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Reports', titleAlign: 'center' })}
          />
          <Stack.Screen
            name="BNPLPlansScreen"
            component={BNPLPlansScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Manage BNPL Plans', titleAlign: 'center' })}
          />
             <Stack.Screen
            name="LocationScreen"
            component={LocationScreen}
            options={({ navigation }) => CustomHeader({ navigation, title: 'Shop Location', titleAlign: 'center' })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </StripeWrapper>
  );
}

// Styles for CustomHeader
const styles = StyleSheet.create({
  customHeaderLeftButton: {
    paddingHorizontal: Platform.OS === 'ios' ? 10 : 15,
    paddingVertical: 5,
  },
  customHeaderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // For Android, when headerTitleAlign: 'center' and headerLeft is present,
    // the title component might still be slightly offset.
    // You may need to adjust its container or use a more complex centering logic if precise centering is critical.
    // One common trick for Android is a negative marginLeft if a back button is present.
    // e.g., marginLeft: Platform.OS === 'android' && navigation.canGoBack() ? -20 : 0,
    // However, this is best handled by testing on an Android device.
  },
  customHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#E0E0E0', // Placeholder background for the avatar
  },
  customHeaderTitleText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
});