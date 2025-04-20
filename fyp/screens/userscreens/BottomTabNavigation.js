// BottomTabNavigation.js (Updated to Register User Push Token)

import React, { useEffect } from 'react'; // Import useEffect
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Platform, Alert } from 'react-native'; // Import Platform, Alert

// --- Import Firebase and Notifications ---
import * as Notifications from 'expo-notifications';
// Adjust the path './../firebaseConfig' if your config file is one level up
import { auth, db } from './../../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Import Screens (Keep your existing imports)
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import CartScreen from './CartScreen';
import UserOrderScreen from './UserOrderScreen';

const Tab = createBottomTabNavigator();


// --- Notification Helper Functions ---
// (These are identical to the ones used for Admin, but the save function targets 'Users')

/**
 * Requests notification permissions and returns the Expo Push Token.
 * Shows alerts to the user if permissions are denied or token fetch fails.
 * @returns {Promise<string|null>} The Expo Push Token or null if failed.
 */
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
      console.log('[UserToken] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // Optional: Alert the user they won't receive order status updates etc.
      // Alert.alert('Permissions Needed', 'Enable notifications to receive updates about your orders.');
      console.error('[UserToken] Notification permissions not granted!');
      return null;
    }

    console.log('[UserToken] Notification permissions granted. Getting Expo push token...');
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
        // projectId: Constants.expoConfig?.extra?.eas?.projectId, // Optional
    });
    token = pushTokenData.data;
    console.log("[UserToken] Expo Push Token:", token);

  } catch (error) {
    console.error("[UserToken] Error during notification setup/token fetch:", error);
    // Don't alert here necessarily, might annoy users if it fails silently
  }
  return token;
}

/**
 * Saves/Updates the Expo Push Token to the specified user's document in the 'Users' collection.
 * @param {string} userId - The Firebase Auth UID of the user.
 * @param {string} token - The Expo Push Token.
 * @returns {Promise<void>}
 */
async function saveUserTokenToFirestore(userId, token) {
  if (!userId || !token) {
    console.error("[UserToken] Missing userId or token. Cannot save to Firestore.");
    return;
  }
  if (typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) {
      console.error("[UserToken] Invalid token format received:", token);
      return;
  }

  try {
    // *** IMPORTANT: Use the correct collection name for your users (e.g., "Users", "customers") ***
    const userDocRef = doc(db, "Users", userId); // Target the 'Users' collection

    console.log(`[UserToken] Attempting to save/update token for user: ${userId}`);
    await setDoc(userDocRef, {
      expoPushToken: token,         // Field to store the token
      tokenUpdatedAt: serverTimestamp() // Optional: Timestamp
    }, { merge: true }); // Use merge: true to avoid overwriting other user data

    console.log(`[UserToken] Expo push token successfully saved/updated for user ${userId}`);

  } catch (error) {
    console.error(`[UserToken] Error saving token for user ${userId} to Firestore:`, error);
    // Don't necessarily alert the user, maybe log to analytics
  }
}

// --- End Notification Helper Functions ---


// --- Main Component ---
export default function BottomTabNavigation() {

  // useEffect Hook: Runs once when the component mounts for the logged-in user
  useEffect(() => {
    const initializeNotificationsForUser = async () => {
      // 1. Get the currently logged-in user from Firebase Auth
      const currentUser = auth.currentUser;

      if (!currentUser) {
        console.warn("[BottomTabNavigation] No authenticated user found. Cannot register for push notifications.");
        return; // Exit if no user is logged in
      }

      console.log(`[BottomTabNavigation] Initializing notifications for user: ${currentUser.uid}`);

      // 2. Request permissions and get the Expo Push Token
      const expoToken = await registerAndGetToken();

      // 3. If a token was successfully obtained, save it to Firestore 'Users' collection
      if (expoToken) {
        await saveUserTokenToFirestore(currentUser.uid, expoToken); // Use the user-specific save function
      } else {
        console.log("[BottomTabNavigation] No Expo token obtained for user, skipping Firestore save.");
      }
    };

    initializeNotificationsForUser(); // Run the setup

    // Cleanup function (optional, not needed for this effect)
    // return () => { console.log("Cleaning up BottomTabNavigation effect"); };

  }, []); // Empty dependency array [] ensures this runs only once after mount


  // --- Render the Tab Navigator (Keep your existing structure) ---
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Cart') {
            iconName = 'shopping-cart';
          } else if (route.name === 'Orders') {
            iconName = 'assignment';
          }
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={iconName}
                size={focused ? 30 : 25}
                color={focused ? 'black' : '#FFFFFF'}
              />
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
          height: 65,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        // Ensure headers are consistently handled (you had them false here)
        headerShown: false,
      })}
    >
      {/* Tabs */}
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={UserOrderScreen} />
    </Tab.Navigator>
  );
}