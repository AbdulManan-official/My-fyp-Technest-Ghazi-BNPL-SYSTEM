import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import OrdersTabView from './OrdersTabView'; // 🔁 Swapped here

// Import Admin Screens
import AdminHomeScreen from './AdminHomeScreen';
import AdminMessageScreen from './AdminMessageScreen';
import ProductScreen from './ProductScreen';

// Wrap screens with SafeAreaView so they start below the status bar
import { SafeAreaView } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

// 🧠 Wrapper to inject SafeAreaView
const withSafeArea = (Component) => (props) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
    <Component {...props} />
  </SafeAreaView>
);

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
          height: 60,
          paddingBottom: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={withSafeArea(AdminHomeScreen)} />
      <Tab.Screen name="Products" component={withSafeArea(ProductScreen)} />
   
<Tab.Screen name="Orders" component={OrdersTabView} />
      <Tab.Screen name="Messages" component={withSafeArea(AdminMessageScreen)} />
    </Tab.Navigator>
  );
}
