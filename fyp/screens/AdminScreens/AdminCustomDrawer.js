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
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

// --- Start: Firebase & AsyncStorage Imports ---
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
// Import query and limit from firestore
import { getFirestore, collection, query, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
// --- End: Firebase & AsyncStorage Imports ---

const { width, height } = Dimensions.get('window');

// --- Start: Define Cache Keys (Generic for THE Admin) ---
const ADMIN_PROFILE_IMAGE_KEY = 'adminDrawerProfileImage'; // Generic key
const ADMIN_NAME_KEY = 'adminDrawerName';           // Generic key
const ADMIN_EMAIL_KEY = 'adminDrawerEmail';          // Generic key
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
// --- End: Define Cache Keys ---


const AdminCustomDrawer = ({ navigation, closeDrawer }) => {
    const translateX = useRef(new Animated.Value(width)).current;

    // --- Start: State for Admin Data and Loading ---
    const [adminData, setAdminData] = useState({
        profileImage: defaultProfileImageUri,
        name: 'Admin',
        email: 'Loading...'
    });
    const [isLoading, setIsLoading] = useState(true);
    // --- End: State for Admin Data and Loading ---

    // --- Start: Firebase Initialization ---
    const auth = getAuth();
    const db = getFirestore();
    // --- End: Firebase Initialization ---


    // --- Start: useEffect for Auth State Changes and Data Fetching ---
    useEffect(() => {
        // Function to fetch THE admin document data
        const fetchAdminData = async () => {
            setIsLoading(true);

            try {
                // Try loading from GENERIC cache first
                const cachedProfile = await AsyncStorage.getItem(ADMIN_PROFILE_IMAGE_KEY);
                const cachedName = await AsyncStorage.getItem(ADMIN_NAME_KEY);
                const cachedEmail = await AsyncStorage.getItem(ADMIN_EMAIL_KEY);

                let dataFromCache = false;
                if (cachedProfile && cachedName && cachedEmail) {
                    setAdminData({ profileImage: cachedProfile, name: cachedName, email: cachedEmail });
                    dataFromCache = true;
                    setIsLoading(false); // Show cached data immediately
                }

                // Query the 'Admin' collection, limit to 1 document
                console.log("Fetching admin document from Firestore...");
                const adminQuery = query(collection(db, "Admin"), limit(1));
                const querySnapshot = await getDocs(adminQuery);

                if (!querySnapshot.empty) {
                    const adminDoc = querySnapshot.docs[0]; // Get the first document
                    const data = adminDoc.data();
                    console.log("Admin document found:", adminDoc.id, data);

                    // Extract data using the fields from your structure
                    const imageUrl = data.profileImage?.trim() ? data.profileImage : defaultProfileImageUri;
                    const name = data.name || "Admin User"; // Use 'name' field
                    const email = data.email || "No Email Provided"; // Use 'email' field

                    // Update state if fetched data is different from cache or if no cache existed
                    if (!dataFromCache || imageUrl !== cachedProfile || name !== cachedName || email !== cachedEmail) {
                        setAdminData({ profileImage: imageUrl, name: name, email: email });
                        // Update GENERIC cache with latest data
                        await AsyncStorage.setItem(ADMIN_PROFILE_IMAGE_KEY, imageUrl);
                        await AsyncStorage.setItem(ADMIN_NAME_KEY, name);
                        await AsyncStorage.setItem(ADMIN_EMAIL_KEY, email);
                        console.log("Admin cache updated.");
                    }
                } else {
                    console.warn("No documents found in the 'Admin' collection. Using defaults.");
                     if (!dataFromCache) { // Only set defaults if nothing was loaded from cache
                        setAdminData({ profileImage: defaultProfileImageUri, name: "Admin", email: "Not Configured" });
                     }
                    // Clear generic cache if no admin doc is configured in Firestore
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

        // Listen for Auth state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // If a user is logged in (assumed to be an admin), fetch the admin data
                fetchAdminData();
            } else {
                // Admin is signed out, clear displayed admin data
                setAdminData({ profileImage: defaultProfileImageUri, name: 'Admin', email: '' });
                setIsLoading(false);
                // Cache clearing happens explicitly on logout action
            }
        });

        return () => unsubscribe(); // Cleanup listener

    }, [auth, db]); // Dependencies
    // --- End: useEffect for Auth State Changes ---


    // Animation and Close logic (no changes)
    useEffect(() => {
        Animated.timing(translateX, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, [translateX]);

    const closeDrawerWithAnimation = (callback) => {
        Animated.timing(translateX, { toValue: width, duration: 300, useNativeDriver: true })
            .start(() => {
                closeDrawer();
                if (callback && typeof callback === 'function') callback();
            });
    };

    // --- Start: Updated handleLogout ---
    const handleLogout = () => {
        Alert.alert(
            "Logout Confirmation",
            "Do you want to proceed with logout?", // Simplified message
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Logout", onPress: async () => {
                        try {
                            await signOut(auth);
                            // Clear GENERIC admin cache upon logout
                            await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY);
                            await AsyncStorage.removeItem(ADMIN_NAME_KEY);
                            await AsyncStorage.removeItem(ADMIN_EMAIL_KEY);
                            console.log("Generic Admin cache cleared on logout.");

                            closeDrawerWithAnimation(() => navigation.replace('Login'));
                        } catch (error) {
                            console.error("Logout Error:", error);
                            Alert.alert("Logout Failed", "An error occurred.");
                            // Still attempt navigation even on error
                            closeDrawerWithAnimation(() => navigation.replace('Login'));
                        }
                    }
                }
            ]
        );
    };
    // --- End: Updated handleLogout ---


    // --- JSX (Main structure remains similar, only Profile Section updated) ---
    return (
        <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => closeDrawerWithAnimation()}
        >
            <PanGestureHandler
                onHandlerStateChange={({ nativeEvent }) => {
                     // Swipe LEFT to close (more common for right drawer):
                     if (nativeEvent.state === State.END && nativeEvent.translationX < -50) {
                       closeDrawerWithAnimation();
                     }
                }}>
                <Animated.View style={[styles.drawerContainer, { transform: [{ translateX }] }]}>

                    <TouchableOpacity style={styles.closeIcon} onPress={() => closeDrawerWithAnimation()}>
                        <Icon name="times-circle" size={28} color="#FF0000" />
                    </TouchableOpacity>

                    {/* Updated Profile Section using adminData state */}
                    <TouchableOpacity
                        style={styles.profileSection}
                        onPress={() => closeDrawerWithAnimation(() => navigation.navigate('AdminProfileScreen'))}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#FF0000" style={styles.profileImage} />
                        ) : (
                            <Image
                                source={{ uri: adminData.profileImage || defaultProfileImageUri }}
                                style={styles.profileImage}
                            />
                        )}
                        <View style={styles.profileInfo}>
                            {isLoading && !adminData.name ? (
                                 <Text style={styles.heading}>Loading...</Text>
                            ) : (
                                <Text style={styles.heading} numberOfLines={1}>{adminData.name}</Text>
                            )}
                             {isLoading && !adminData.email ? (
                                 <Text style={styles.subHeading}> </Text>
                             ) : (
                                <Text style={styles.subHeading} numberOfLines={1}>{adminData.email}</Text>
                             )}
                        </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* Drawer items remain the same */}
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
                            onPress={() => closeDrawerWithAnimation(() => navigation.navigate(item.route))}
                        />
                    ))}


                    {/* Logout Button */}
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

// Drawer Item Component (no changes)
const DrawerItem = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={icon} size={22} color="#FF0000" />
            <Text style={styles.drawerText}>{label}</Text>
        </View>
    </TouchableOpacity>
);

// Styles (no changes needed from previous version)
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