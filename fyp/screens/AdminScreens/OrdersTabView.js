import React, { useState } from 'react';
import { View, Dimensions, StyleSheet, Text } from 'react-native';
import { TabView, TabBar } from 'react-native-tab-view';
import OrderScreen from './OrderScreen';
import AdminSideUserSchedulesProgress from './AdminSideUserSchedulesProgress';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context'; // ✅
import { useNavigation } from '@react-navigation/native';

const OrdersTabView = () => {
  const navigation = useNavigation();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'orders', title: 'Orders', icon: 'shopping-basket' },
    { key: 'bnpl', title: 'BNPL ', icon: 'schedule' },
  ]);

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'orders':
        return <OrderScreen navigation={navigation} />;
      case 'bnpl':
        return <AdminSideUserSchedulesProgress navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: Dimensions.get('window').width }}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: 'black', height: 3 }}
            style={styles.tabBar}
            renderLabel={({ route, focused }) => (
              <Text
                style={{
                  color: focused ? 'black' : 'white',
                  fontWeight: 'bold',
                  fontSize: 12,
                }}
              >
                {route.title}
              </Text>
            )}
            renderIcon={({ route, focused }) => (
              <MaterialIcons
                name={route.icon}
                size={focused ? 26 : 22}
                color={focused ? 'black' : '#FFFFFF'}
                style={styles.iconOnly}
              />
            )}
          />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FF0000',
    height: 60,
    justifyContent: 'center',
    elevation: 4,
  },
  iconOnly: {
    alignSelf: 'center',
    marginBottom: 2,
  },
});

export default OrdersTabView;
