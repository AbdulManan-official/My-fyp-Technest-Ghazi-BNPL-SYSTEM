// AdminDashboardNavigation.js (Updated with Notification Handling)

import React, { useEffect, useRef } from 'react'; // Import useRef
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation for tap handling

// --- Import Firebase and Notifications ---
import * as Notifications from 'expo-notifications';
import { auth, db } from './../../firebaseConfig'; // Adjust path if needed
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// --- Import Admin Screens ---
import OrdersTabView from './OrdersTabView';
import AdminHomeScreen from './AdminHomeScreen';
import AdminMessageScreen from './AdminMessageScreen';
import ProductScreen from './ProductScreen';
import UserVerificationScreen from './UserVerificationScreen';

// --- Initialize Bottom Tab Navigator ---
const Tab = createBottomTabNavigator();

// --- Set Up Notification Handling (Foreground) ---
// NOTE: Ideally, set this ONCE globally in your App.js
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true, // Show the alert when app is foregrounded
        shouldPlaySound: true, // Play sound
        shouldSetBadge: false, // Set to true if you want to manage badge counts
    }),
});

// --- Wrapper component for SafeAreaView (optional) ---
const withSafeArea = (Component) => (props) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
    <Component {...props} />
  </SafeAreaView>
);

// --- Notification Helper Functions (registerAndGetToken, saveTokenToFirestore - unchanged) ---

async function registerAndGetToken() {
  let token = null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      console.log('[Admin] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permissions Required','Push notifications require permission...');
      console.error('[Admin] Notification permissions not granted!');
      return null;
    }
    console.log('[Admin] Notification permissions granted. Getting Expo push token...');
    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    token = pushTokenData.data;
    console.log("[Admin] Expo Push Token:", token);
  } catch (error) {
    console.error("[Admin] Error during notification setup/token fetch:", error);
    Alert.alert("Notification Error", "Could not configure notifications.");
  }
  return token;
}

async function saveTokenToFirestore(adminUid, token) {
  if (!adminUid || !token || typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) {
    console.error("[Admin] Missing adminUid or invalid token. Cannot save to Firestore.", { adminUid, token });
    return;
  }
  try {
    const adminDocRef = doc(db, "Admin", adminUid);
    console.log(`[Admin] Attempting to save/update token for admin: ${adminUid}`);
    await setDoc(adminDocRef, {
      expoPushToken: token,
      tokenUpdatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Admin] Expo push token successfully saved/updated for admin ${adminUid}`);
  } catch (error) {
    console.error(`[Admin] Error saving token for admin ${adminUid} to Firestore:`, error);
    Alert.alert("Save Error", "Could not save notification preferences.");
  }
}

// --- Main Admin Dashboard Component ---
export default function AdminDashboardNavigation() {
    const navigation = useNavigation(); // Get navigation object

    // --- Refs to store listener subscriptions ---
    const notificationListener = useRef();
    const responseListener = useRef();

    // --- useEffect Hook for Initialization and Listeners ---
    useEffect(() => {
        let isMounted = true; // Flag to check if component is still mounted

        const initializeAndListen = async () => {
            // --- Part 1: Register Token (Existing Logic) ---
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.warn("[Admin] No authenticated user found for notification setup.");
                return;
            }
            console.log(`[Admin] Initializing notifications for: ${currentUser.uid}`);
            const expoToken = await registerAndGetToken();
            if (expoToken && isMounted) { // Check if still mounted before saving
                await saveTokenToFirestore(currentUser.uid, expoToken);
            } else {
                console.log("[Admin] No valid Expo token obtained, skipping Firestore save.");
            }

            // --- Part 2: Set up Notification Listeners ---

            // Listener for notifications received while app is foregrounded
            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                console.log('[Admin] FOREGROUND NOTIFICATION RECEIVED:', JSON.stringify(notification, null, 2));
                // You could potentially update UI here, like a badge count
                // Example: setNotificationCount(prev => prev + 1);
            });

            // Listener for user tapping on a notification
            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                console.log('[Admin] NOTIFICATION TAPPED:', JSON.stringify(response, null, 2));
                const notificationData = response.notification.request.content.data;
                console.log('[Admin] Notification Data:', notificationData);

                // --- Handle Navigation Based on Data ---
                if (notificationData?.type === 'new_order' && notificationData?.orderId) {
                     console.log(`[Admin] Navigating to Order Details for ID: ${notificationData.orderId}`);
                     // Navigate to the specific order screen (adjust screen name as needed)
                     // Ensure 'AdminOrderDetailScreen' exists in your navigation stack accessible from here
                     navigation.navigate('Orders', { // Navigate to the Orders tab first
                         screen: 'AdminOrderDetailScreen', // Then navigate within that stack
                         params: { orderId: notificationData.orderId },
                     });
                } else {
                    console.log("[Admin] Notification tapped, but no specific action defined for data:", notificationData);
                    // Maybe navigate to a general notifications screen or home screen
                }
            });

            console.log("[Admin] Notification listeners added.");
        };

        initializeAndListen();

        // --- Cleanup Function: Remove listeners when component unmounts ---
        return () => {
            isMounted = false; // Set flag when unmounting
            console.log("[Admin] Removing notification listeners...");
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
                console.log("[Admin] Removed notification received listener.");
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
                console.log("[Admin] Removed notification response listener.");
            }
        };
    }, [navigation]); // Add navigation as dependency if used inside effect for navigation


    // --- Render the Bottom Tab Navigator (Unchanged) ---
    return (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => {
              let iconName = 'help-outline';
              if (route.name === 'Home') iconName = 'dashboard';
              else if (route.name === 'Orders') iconName = 'shopping-basket';
              else if (route.name === 'Messages') iconName = 'message';
              else if (route.name === 'Products') iconName = 'inventory';
              else if (route.name === 'Verify') iconName = 'verified';
              return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={iconName} size={focused ? 30 : 25} color={focused ? 'black' : '#FFFFFF'}/>
                </View>
              );
            },
            tabBarActiveTintColor: 'black',
            tabBarInactiveTintColor: '#FFFFFF',
            tabBarStyle: {
              backgroundColor: '#FF0000',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              elevation: 5,
              shadowOpacity: 0.1,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: -3 },
              height: 60,
              paddingBottom: 5,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: 'bold',
              marginBottom: 3,
            },
            headerShown: false,
          })}
        >
          <Tab.Screen name="Home" component={AdminHomeScreen} />
          <Tab.Screen name="Products" component={ProductScreen} />
          <Tab.Screen name="Orders" component={OrdersTabView} />
          <Tab.Screen name="Messages" component={AdminMessageScreen} />
          <Tab.Screen name="Verify" component={UserVerificationScreen} />
        </Tab.Navigator>
      );
}