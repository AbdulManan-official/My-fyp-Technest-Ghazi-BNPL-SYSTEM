import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons'; // Using Material Icons now

import { TouchableOpacity, View, StyleSheet, Image } from 'react-native';

// Import Screens
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import CartScreen from './CartScreen';
import UserOrderScreen from './UserOrderScreen';

const Tab = createBottomTabNavigator();

// Custom Header Function with Reduced Height

        


export default function BottomTabNavigation() {
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
                size={focused ? 30 : 25} // Increased size for active tab
                color={focused ? 'black' : '#FFFFFF'} // Active: Black, Inactive: White
              />
            </View>
          );
        },
        tabBarActiveTintColor: 'black', // Active label color
        tabBarInactiveTintColor: '#FFFFFF', // Inactive label color
        tabBarStyle: {
          backgroundColor: '#FF0000', // Bright Red Tab Background
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
      })} 
    >
      {/* Home Tab with Custom Header */}
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} options={{ headerShown: false }}
      />

      {/* Other Tabs */}
      <Tab.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Orders" component={UserOrderScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
