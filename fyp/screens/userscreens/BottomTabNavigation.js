// BottomTabNavigation.js

import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { auth, db } from './../../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Import Screens
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import CartScreen from './CartScreen';
import UserOrderScreen from './UserOrderScreen';

const Tab = createBottomTabNavigator();

// --- Notification Helper Functions (registerAndGetToken, saveUserTokenToFirestore) ---
// ... (your existing notification helper functions remain unchanged here) ...
async function registerAndGetToken() { /* ... your code ... */
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
    }
    return token;
}

async function saveUserTokenToFirestore(userId, token) { /* ... your code ... */
    if (!userId || !token) {
        console.error("[UserToken] Missing userId or token. Cannot save to Firestore.");
        return;
    }
    if (typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) {
        console.error("[UserToken] Invalid token format received:", token);
        return;
    }

    try {
        const userDocRef = doc(db, "Users", userId);
        console.log(`[UserToken] Attempting to save/update token for user: ${userId}`);
        await setDoc(userDocRef, {
        expoPushToken: token,
        tokenUpdatedAt: serverTimestamp()
        }, { merge: true });
        console.log(`[UserToken] Expo push token successfully saved/updated for user ${userId}`);
    } catch (error) {
        console.error(`[UserToken] Error saving token for user ${userId} to Firestore:`, error);
    }
}


// --- Main Component ---
export default function BottomTabNavigation() {
  useEffect(() => {
    const initializeNotificationsForUser = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("[BottomTabNavigation] No authenticated user found. Cannot register for push notifications.");
        return;
      }
      console.log(`[BottomTabNavigation] Initializing notifications for user: ${currentUser.uid}`);
      const expoToken = await registerAndGetToken();
      if (expoToken) {
        await saveUserTokenToFirestore(currentUser.uid, expoToken);
      } else {
        console.log("[BottomTabNavigation] No Expo token obtained for user, skipping Firestore save.");
      }
    };
    initializeNotificationsForUser();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Search') iconName = 'search';
          else if (route.name === 'Cart') iconName = 'shopping-cart';
          else if (route.name === 'Orders') iconName = 'assignment';
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
          // Position absolute can sometimes help if other methods fail, but tabBarHideOnKeyboard is preferred
          // position: 'absolute', // Try this if tabBarHideOnKeyboard doesn't work as expected alone
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        headerShown: false,
        // --- THIS IS THE KEY ADDITION ---
        tabBarHideOnKeyboard: true,
        // --------------------------------
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