import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Image, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

const AdminCustomDrawer = ({ navigation, closeDrawer }) => {
  const translateX = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const closeDrawerWithAnimation = (callback) => {
    Animated.timing(translateX, {
      toValue: width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      closeDrawer();
      if (callback) callback();
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout Confirmation",
      "If you log out, you might need to enter your credentials again. Do you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Logout", onPress: () => closeDrawerWithAnimation(() => navigation.replace('Login')) }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.overlay}
      activeOpacity={1}
      onPress={() => closeDrawerWithAnimation()}
    >
      <PanGestureHandler
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.END && nativeEvent.translationX > 50) {
            closeDrawerWithAnimation();
          }
        }}>
        <Animated.View style={[styles.drawerContainer, { transform: [{ translateX }] }]}>

          <TouchableOpacity style={styles.closeIcon} onPress={() => closeDrawerWithAnimation()}>
            <Icon name="times-circle" size={28} color="#FF0000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileSection}
            onPress={() => closeDrawerWithAnimation(() => navigation.navigate('AdminProfileScreen'))}
          >
            <Image source={{ uri: 'https://www.w3schools.com/w3images/avatar2.png' }} style={styles.profileImage} />
            <View style={styles.profileInfo}>
              <Text style={styles.heading}>Admin User</Text>
              <Text style={styles.subHeading}>admin@example.com</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {[
            { name: 'user', label: 'Profile', route: 'AdminProfileScreen' },
            { name: 'list', label: 'Categories', route: 'AdminCategoryScreen' },
            { name: 'credit-card', label: 'BNPL Plans', route: 'BNPLPlansScreen' },
            { name: 'check-square-o', label: 'User Verifications', route: 'AdminUserVerficationScreen' },

            { name: 'bar-chart', label: 'Reports', route: 'ReportsScreen' },
          ].map((item, index) => (
            <DrawerItem
              key={index}
              icon={item.name}
              label={item.label}
              onPress={() => closeDrawerWithAnimation(() => navigation.navigate(item.route))}
            />
          ))}

          <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="sign-out" size={22} color="#FF0000" />
              <Text style={styles.drawerText}>Logout</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />
        </Animated.View>
      </PanGestureHandler>
    </TouchableOpacity>
  );
};

const DrawerItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={22} color="#FF0000" />
      <Text style={styles.drawerText}>{label}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: width * 0.75,
    maxHeight: height * 0.95,
    height: '100%',
    backgroundColor: '#FFF',
    paddingVertical: 20,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  closeIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    width: '100%',
  },
  profileImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    marginRight: 15,
    backgroundColor: '#EEE',
  },
  profileInfo: {
    flex: 1,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  subHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  drawerText: {
    fontSize: 14,
    marginLeft: 15,
    fontWeight: '500',
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#DDD',
    marginVertical: 15,
    width: '100%',
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 5,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    width: '100%',
  },
});

export default AdminCustomDrawer;