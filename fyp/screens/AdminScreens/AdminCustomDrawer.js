import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Animated,
    Image,
    Alert,
    ActivityIndicator,
    Platform // Added Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const ADMIN_PROFILE_IMAGE_KEY = 'adminDrawerProfileImage';
const ADMIN_NAME_KEY = 'adminDrawerName';
const ADMIN_EMAIL_KEY = 'adminDrawerEmail';
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';

const AdminCustomDrawer = ({ navigation, closeDrawer }) => {
    const translateX = useRef(new Animated.Value(width)).current;
    const [adminData, setAdminData] = useState({
        profileImage: defaultProfileImageUri,
        name: 'Admin',
        email: 'Loading...'
    });
    const [isLoading, setIsLoading] = useState(true);
    const auth = getAuth();
    const db = getFirestore();

    useEffect(() => {
        // ... (your existing useEffect for fetching admin data - unchanged)
        const fetchAdminData = async () => {
            setIsLoading(true);
            try {
                const cachedProfile = await AsyncStorage.getItem(ADMIN_PROFILE_IMAGE_KEY);
                const cachedName = await AsyncStorage.getItem(ADMIN_NAME_KEY);
                const cachedEmail = await AsyncStorage.getItem(ADMIN_EMAIL_KEY);
                let dataFromCache = false;
                if (cachedProfile && cachedName && cachedEmail) {
                    setAdminData({ profileImage: cachedProfile, name: cachedName, email: cachedEmail });
                    dataFromCache = true;
                    setIsLoading(false);
                }
                const adminQuery = query(collection(db, "Admin"), limit(1));
                const querySnapshot = await getDocs(adminQuery);
                if (!querySnapshot.empty) {
                    const adminDoc = querySnapshot.docs[0];
                    const data = adminDoc.data();
                    const imageUrl = data.profileImage?.trim() ? data.profileImage : defaultProfileImageUri;
                    const name = data.name || "Admin User";
                    const email = data.email || "No Email Provided";
                    if (!dataFromCache || imageUrl !== cachedProfile || name !== cachedName || email !== cachedEmail) {
                        setAdminData({ profileImage: imageUrl, name: name, email: email });
                        await AsyncStorage.setItem(ADMIN_PROFILE_IMAGE_KEY, imageUrl);
                        await AsyncStorage.setItem(ADMIN_NAME_KEY, name);
                        await AsyncStorage.setItem(ADMIN_EMAIL_KEY, email);
                    }
                } else {
                     if (!dataFromCache) {
                        setAdminData({ profileImage: defaultProfileImageUri, name: "Admin", email: "Not Configured" });
                     }
                    await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                    await AsyncStorage.removeItem(ADMIN_NAME_KEY);
                    await AsyncStorage.removeItem(ADMIN_EMAIL_KEY);
                }
            } catch (error) {
                console.error("Error fetching admin data:", error);
                 if (!adminData.name || adminData.name === 'Admin') {
                    setAdminData({ profileImage: defaultProfileImageUri, name: 'Error Loading', email: '' });
                 }
            } finally {
                setIsLoading(false);
            }
        };
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchAdminData();
            } else {
                setAdminData({ profileImage: defaultProfileImageUri, name: 'Admin', email: '' });
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [auth, db]);


    useEffect(() => {
        Animated.timing(translateX, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, [translateX]);

    const closeDrawerWithAnimation = (callback) => {
        Animated.timing(translateX, { toValue: width, duration: 300, useNativeDriver: true })
            .start(() => {
                if (closeDrawer && typeof closeDrawer === 'function') {
                    closeDrawer();
                }
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
    };

    const handleLogout = () => {
        // ... (your existing handleLogout - unchanged)
        Alert.alert(
            "Logout Confirmation",
            "Do you want to proceed with logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Logout", onPress: async () => {
                        try {
                            await signOut(auth);
                            await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                            await AsyncStorage.removeItem(ADMIN_NAME_KEY);
                            await AsyncStorage.removeItem(ADMIN_EMAIL_KEY);
                            closeDrawerWithAnimation(() => navigation.replace('Login'));
                        } catch (error) {
                            console.error("Logout Error:", error);
                            Alert.alert("Logout Failed", "An error occurred: " + error.message);
                            closeDrawerWithAnimation(() => navigation.replace('Login'));
                        }
                    }
                }
            ]
        );
    };

    const handleProfilePress = () => {
        navigation.navigate('AdminProfileScreen');
        // DO NOT CALL closeDrawerWithAnimation()
    };

    const handleGenericItemPress = (route) => {
        navigation.navigate(route);
        // DO NOT CALL closeDrawerWithAnimation()
    };

    // This is the crucial part for stopping event propagation
    // when interacting with the drawer content.
    const onDrawerContentPress = (e) => {
        // This function is called when the PanGestureHandler's child (Animated.View) is pressed.
        // We don't want this press to propagate to the overlay if it's on an actual item.
        // However, simply having TouchableOpacity items inside should typically handle this.
        // If items are still being "clicked through", this is where we'd stop it.
        // For now, we'll rely on the TouchableOpacity of the items themselves.
        // If that fails, we might need e.stopPropagation() here IF this handler was on the
        // Animated.View and if we could detect if the target was an item or empty space.
        // But that's complex.
    };


    return (
        <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1} // Make sure it's fully opaque to catch taps
            onPress={() => {
                // This onPress is for the overlay itself.
                // It should ONLY fire if the tap was NOT on the drawer content.
                // If a drawer item (TouchableOpacity) is pressed, its onPress should fire,
                // and the event should ideally not bubble up to this overlay's onPress.
                closeDrawerWithAnimation();
            }}
        >
            {/*
                The PanGestureHandler wraps the drawer.
                The Animated.View is the drawer itself.
                We need to make sure that taps on the *contents* of Animated.View
                do not also trigger the overlay's onPress.
            */}
            <PanGestureHandler
                onHandlerStateChange={({ nativeEvent }) => {
                    if (nativeEvent.state === State.END && nativeEvent.translationX < -50) {
                        closeDrawerWithAnimation();
                    }
                }}>
                <Animated.View
                    style={[styles.drawerContainer, { transform: [{ translateX }] }]}
                    // By NOT adding onStartShouldSetResponderCapture here,
                    // we allow child TouchableOpacity components to handle their own presses.
                    // If a tap occurs on this Animated.View but NOT on a child TouchableOpacity,
                    // the event MIGHT bubble to the parent overlay's onPress.
                    // This is often desired for "tap outside to close" on the actual drawer area.
                    // BUT, if the overlay fills the screen, this becomes tricky.

                    // A common pattern is to have the overlay be a separate, sibling view
                    // that is only visible when the drawer is open.
                    // And the drawer itself handles its own gestures.
                    // However, let's try to make your current structure work.

                    // Add a "dummy" onPress to the Animated.View itself.
                    // This can sometimes help in "consuming" a press event that isn't handled
                    // by any of its children, preventing it from reaching the main overlay.
                    // This is a bit of a hack.
                    onTouchEnd={(e) => {
                        // This will fire if a touch ends on the drawer container itself,
                        // not necessarily on an item.
                        // We don't want to do anything here that closes the drawer,
                        // as that's the job of the close button or the main overlay.
                        // The goal is to see if this helps "block" the event from
                        // reaching the main overlay if the touch was on the drawer.
                        // e.stopPropagation(); // THIS MIGHT BE TOO AGGRESSIVE AND BREAK OVERLAY TAP
                    }}
                >
                    <TouchableOpacity style={styles.closeIcon} onPress={() => closeDrawerWithAnimation()}>
                        <Icon name="times-circle" size={28} color="#FF0000" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.profileSection}
                        onPress={handleProfilePress} // Uses specific handler
                    >
                        {isLoading ? ( /* ... loading UI ... */ <ActivityIndicator size="large" color="#FF0000" style={styles.profileImage} />)
                        : ( <Image source={{ uri: adminData.profileImage || defaultProfileImageUri }} style={styles.profileImage} /> )}
                        <View style={styles.profileInfo}>
                            {isLoading && !adminData.name ? ( <Text style={styles.heading}>Loading...</Text> )
                            : ( <Text style={styles.heading} numberOfLines={1}>{adminData.name}</Text> )}
                            {isLoading && !adminData.email ? ( <Text style={styles.subHeading}> </Text> )
                            : ( <Text style={styles.subHeading} numberOfLines={1}>{adminData.email}</Text> )}
                        </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {[
                        { name: 'user', label: 'Profile', route: 'AdminProfileScreen' },
                        { name: 'list', label: 'Categories', route: 'AdminCategoryScreen' },
                        { name: 'credit-card', label: 'BNPL Plans', route: 'BNPLPlansScreen' },
                        { name: 'group', label: 'Users', route: 'UsersScreen' },
                        { name: 'bar-chart', label: 'Reports', route: 'ReportsScreen' },
                    ].map((item, index) => (
                        <DrawerItem
                            key={index}
                            icon={item.name}
                            label={item.label}
                            onPress={() => handleGenericItemPress(item.route)} // Use generic handler
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

// DrawerItem component remains the same. Its TouchableOpacity should handle its own press.
const DrawerItem = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={icon} size={22} color="#FF0000" />
            <Text style={styles.drawerText}>{label}</Text>
        </View>
    </TouchableOpacity>
);

// Styles remain the same
const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    drawerContainer: { position: 'absolute', top: 0, right: 0, width: width * 0.75, height: '100%', backgroundColor: '#FFF', paddingTop: 40, paddingBottom: 20, paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, borderTopLeftRadius: 15, borderBottomLeftRadius: 15, },
    closeIcon: { position: 'absolute', top: 15, right: 15, padding: 5, zIndex: 10 },
    profileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: 15, borderRadius: 10,marginTop:30, backgroundColor: 'rgba(255, 0, 0, 0.1)', width: '100%' },
    profileImage: { width: 65, height: 65, borderRadius: 32.5, marginRight: 15, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
    profileInfo: { flex: 1, justifyContent: 'center' },
    heading: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 4 },
    subHeading: { fontSize: 14, fontWeight: '600', color: '#555' },
    drawerText: { fontSize: 14, marginLeft: 15, fontWeight: '500', color: '#666' },
    divider: { height: 1, backgroundColor: '#DDD', marginVertical: 10, width: '100%' },
    drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(255, 0, 0, 0.08)', width: '100%' },
});

export default AdminCustomDrawer;