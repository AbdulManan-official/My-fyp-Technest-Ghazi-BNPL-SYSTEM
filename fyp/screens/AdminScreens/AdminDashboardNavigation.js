import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

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
        tabBarIcon: ({ color, size }) => {
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

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0033A0',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { backgroundColor: '#fff', paddingBottom: 5 },
      })}
    >
      <Tab.Screen name="Home" component={AdminHomeScreen} />
      <Tab.Screen name="Orders" component={OrderScreen} />
      <Tab.Screen name="Messages" component={AdminMessageScreen} />
      <Tab.Screen name="Products" component={ProductScreen} />
      <Tab.Screen name="Categories" component={CategoryScreen} />
    </Tab.Navigator>
  );
}
