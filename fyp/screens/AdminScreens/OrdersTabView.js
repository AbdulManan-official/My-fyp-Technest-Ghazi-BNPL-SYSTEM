import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { TabView, TabBar, SceneMap } from 'react-native-tab-view';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import OrderScreen from './OrderScreen';
import AdminSideUserSchedulesProgress from './AdminSideUserSchedulesProgress';

// --- Best Practice: Centralize Constants ---
const THEME = {
  primary: '#FF0000',
  accent: 'black',
  textLight: '#FFFFFF',
  textDark: 'black',
};

const ROUTES = [
  { key: 'orders', title: 'Orders', icon: 'shopping-basket' },
  { key: 'bnpl', title: 'BNPL', icon: 'schedule' },
];

// --- Performance: Use SceneMap for memoized scenes ---
// This prevents scenes from re-rendering unnecessarily when you switch tabs.
// NOTE: Make sure OrderScreen and AdminSideUserSchedulesProgress now use the useNavigation() hook internally
// instead of receiving it as a prop.
const renderScene = SceneMap({
  orders: OrderScreen,
  bnpl: AdminSideUserSchedulesProgress,
});

const OrdersTabView = () => {
  const { width } = useWindowDimensions(); // ✅ More robust than Dimensions API
  const [index, setIndex] = useState(0);
  const [routes] = useState(ROUTES);

  // --- Performance: Memoize render functions with useCallback ---
  // This prevents the TabBar and its children from re-creating their render functions on every render of OrdersTabView.

  const renderIcon = useCallback(({ route, focused }) => (
    <MaterialIcons
      name={route.icon}
      size={focused ? 26 : 22}
      color={focused ? THEME.accent : THEME.textLight}
      style={styles.iconOnly}
    />
  ), []); // Empty dependency array means this function is created only once.

  const renderLabel = useCallback(({ route, focused }) => (
    <Text style={[styles.labelText, { color: focused ? THEME.accent : THEME.textLight }]}>
      {route.title}
    </Text>
  ), []); // Also created only once.

  const renderTabBar = useCallback(
    (props) => (
      <TabBar
        {...props}
        indicatorStyle={styles.indicator}
        style={styles.tabBar}
        renderLabel={renderLabel}
        renderIcon={renderIcon}
      />
    ),
    [renderLabel, renderIcon] // Re-create only if renderLabel or renderIcon change (which they won't).
  );

  return (
    <SafeAreaView style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width }} // Use width from the hook
        renderTabBar={renderTabBar}
        lazy // Optional: Renders scenes only when they are made active. Good for memory.
      />
    </SafeAreaView>
  );
};

// --- Readability: Use constants in StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.textLight,
  },
  tabBar: {
    backgroundColor: THEME.primary,
    height: 60,
    justifyContent: 'center',
    elevation: 4,
  },
  indicator: {
    backgroundColor: THEME.accent,
    height: 3,
  },
  iconOnly: {
    alignSelf: 'center',
    marginBottom: 2,
  },
  labelText: {
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default OrdersTabView;