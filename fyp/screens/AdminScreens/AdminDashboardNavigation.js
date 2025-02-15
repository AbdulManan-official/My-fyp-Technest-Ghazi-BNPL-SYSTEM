import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

// Import Admin Screens
import AdminHomeScreen from './AdminHomeScreen';
import OrderScreen from './OrderScreen';
import AdminMessageScreen from './AdminMessageScreen';
import ProductScreen from './ProductScreen';
import CategoryScreen from './CategoryScreen';

const Tab = createBottomTabNavigator();

export default function AdminDashboardNavigation() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'dashboard';
          } else if (route.name === 'Orders') {
            iconName = 'shopping-basket';
          } else if (route.name === 'Messages') {
            iconName = 'message';
          } else if (route.name === 'Products') {
            iconName = 'inventory';
          } else if (route.name === 'Categories') {
            iconName = 'category';
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={iconName}
                size={focused ? 30 : 25} // Reduced active & inactive size slightly
                color={focused ? 'black' : '#FFFFFF'}
              />
            </View>
          );
        },
        tabBarActiveTintColor: 'black', // Active label color
        tabBarInactiveTintColor: '#FFFFFF', // White for inactive label
        tabBarStyle: {
          backgroundColor: '#FF0000', // Pure Bright Red Background
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          elevation: 5,
          height: 60,
          paddingBottom: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11, // Reduced label size
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Home" component={AdminHomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Orders" component={OrderScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Messages" component={AdminMessageScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Products" component={ProductScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Categories" component={CategoryScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
