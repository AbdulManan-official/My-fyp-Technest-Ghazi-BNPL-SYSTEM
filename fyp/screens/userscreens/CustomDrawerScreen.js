import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated,
    Image, Alert, ActivityIndicator // Added ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
// Removed FontAwesome import from '@expo/vector-icons' as react-native-vector-icons is already used

// Import Firebase and AsyncStorage
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Define keys for AsyncStorage (optional but good practice)
const PROFILE_IMAGE_KEY = 'userProfileImage';
const USER_NAME_KEY = 'userName';
const USER_EMAIL_KEY = 'userEmail';


const CustomDrawerScreen = ({ navigation, closeDrawer }) => {
    const translateX = useRef(new Animated.Value(width)).current;

    // --- Start: Added State for User Data and Loading ---
    const [userData, setUserData] = useState({
        profileImage: 'https://www.w3schools.com/w3images/avatar2.png', // Default placeholder
        name: 'Loading...',
        email: ' '
    });
    const [isLoading, setIsLoading] = useState(true);
    // --- End: Added State ---

    // --- Start: Firebase Initialization ---
    const auth = getAuth();
    const db = getFirestore();
    // --- End: Firebase Initialization ---

    // --- Start: useEffect for Auth State Changes and Data Fetching ---
    useEffect(() => {
        const fetchUserData = async (currentUser) => {
            if (!currentUser) return;
            setIsLoading(true);
            const userUid = currentUser.uid;

            // Define cache keys specific to the user
            const cacheImageKey = `${PROFILE_IMAGE_KEY}_${userUid}`;
            const cacheNameKey = `${USER_NAME_KEY}_${userUid}`;
            const cacheEmailKey = `${USER_EMAIL_KEY}_${userUid}`;

            try {
                // Try loading from cache first
                const cachedProfile = await AsyncStorage.getItem(cacheImageKey);
                const cachedName = await AsyncStorage.getItem(cacheNameKey);
                const cachedEmail = await AsyncStorage.getItem(cacheEmailKey);

                let dataFromCache = false;
                if (cachedProfile && cachedName && cachedEmail) {
                    setUserData({ profileImage: cachedProfile, name: cachedName, email: cachedEmail });
                    dataFromCache = true; // Set data from cache, but still fetch latest
                    setIsLoading(false); // Show cached data immediately if available
                }

                // Fetch latest data from Firestore
                const userRef = doc(db, "Users", userUid); // Assuming your collection is named 'Users'
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    // Use fetched data or fallback to defaults
                    const imageUrl = data.profileImage?.trim() ? data.profileImage : 'https://www.w3schools.com/w3images/avatar2.png';
                    const name = data.name || "Unknown User";
                    const email = data.email || "No Email Provided";

                    // Update state if fetched data is different from cache or if no cache existed
                    if (!dataFromCache || imageUrl !== cachedProfile || name !== cachedName || email !== cachedEmail) {
                        setUserData({ profileImage: imageUrl, name: name, email: email });
                        // Update cache with latest data
                        await AsyncStorage.setItem(cacheImageKey, imageUrl);
                        await AsyncStorage.setItem(cacheNameKey, name);
                        await AsyncStorage.setItem(cacheEmailKey, email);
                    }
                } else {
                    console.log("User document not found in Firestore.");
                    // If no Firestore doc, use defaults and potentially clear cache if it existed
                    const defaultImage = 'https://www.w3schools.com/w3images/avatar2.png';
                    const defaultName = "User";
                    const defaultEmail = currentUser.email || "No Email"; // Use auth email as fallback
                    if (!dataFromCache) { // Only set defaults if nothing was loaded from cache
                       setUserData({ profileImage: defaultImage, name: defaultName, email: defaultEmail });
                    }
                    // Clear cache if Firestore doc doesn't exist
                    await AsyncStorage.removeItem(cacheImageKey);
                    await AsyncStorage.removeItem(cacheNameKey);
                    await AsyncStorage.removeItem(cacheEmailKey);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                // Show error state or fallbacks if fetch fails
                 if (!userData.name || userData.name === 'Loading...') { // Avoid overwriting cached data on error
                    setUserData({ profileImage: 'https://www.w3schools.com/w3images/avatar2.png', name: 'Error Loading', email: '' });
                 }
            } finally {
                setIsLoading(false); // Ensure loading is set to false
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchUserData(user);
            } else {
                // User is signed out, clear user data and cache keys
                setUserData({ profileImage: 'https://www.w3schools.com/w3images/avatar2.png', name: 'Not logged in', email: '' });
                setIsLoading(false);
                // No userUid here, so can't clear specific keys easily unless stored elsewhere
                // Consider clearing generic keys or handling this during logout
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();

    }, [auth, db]); // Dependencies for the effect
    // --- End: useEffect for Auth State Changes ---

    // Effect for drawer open animation (no changes needed here)
    useEffect(() => {
        Animated.timing(translateX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [translateX]); // Added translateX dependency

    const closeDrawerWithAnimation = (callback) => {
        Animated.timing(translateX, {
            toValue: width, // Animate back off-screen
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            closeDrawer(); // Call the prop to hide/unmount the drawer
            if (callback && typeof callback === 'function') {
                callback(); // Execute callback (like navigation) after animation
            }
        });
    };

    // --- Start: Updated handleLogout ---
    const handleLogout = () => {
        Alert.alert(
            "Logout Confirmation",
            "If you log out, you might need to enter your credentials again. Do you want to proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Logout", onPress: async () => { // Make onPress async
                        const user = auth.currentUser;
                        const userUid = user?.uid; // Get UID before signing out

                        try {
                            await signOut(auth);
                            // Clear cached data upon logout
                            if (userUid) {
                                await AsyncStorage.removeItem(`${PROFILE_IMAGE_KEY}_${userUid}`);
                                await AsyncStorage.removeItem(`${USER_NAME_KEY}_${userUid}`);
                                await AsyncStorage.removeItem(`${USER_EMAIL_KEY}_${userUid}`);
                            }
                            // Navigate after sign out and cache clearing
                            closeDrawerWithAnimation(() => navigation.replace('Login'));
                        } catch (error) {
                            console.error("Logout Error:", error);
                            Alert.alert("Logout Failed", "An error occurred while logging out.");
                            // Optionally still close the drawer or navigate
                            closeDrawerWithAnimation(() => navigation.replace('Login')); // Navigate even on error? Decide based on UX needs.
                        }
                    }
                }
            ]
        );
    };
    // --- End: Updated handleLogout ---

    return (
        <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => closeDrawerWithAnimation()}
        >
            <PanGestureHandler
                onHandlerStateChange={({ nativeEvent }) => {
                    // Adjusted condition: Close on swipe left (negative translation)
                    if (nativeEvent.state === State.END && nativeEvent.translationX > 50) { // Keep swipe right to close if intended
                        closeDrawerWithAnimation();
                    }
                     // If you want swipe LEFT to close (like the first example):
                     // if (nativeEvent.state === State.END && nativeEvent.translationX < -50) {
                     //   closeDrawerWithAnimation();
                     // }
                }}>
                <Animated.View style={[styles.drawerContainer, { transform: [{ translateX }] }]}>

                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeIcon} onPress={() => closeDrawerWithAnimation()}>
                        <Icon name="times-circle" size={28} color="#FF0000" />
                    </TouchableOpacity>

                    {/* --- Start: Updated User Profile Section --- */}
                    <TouchableOpacity
                        style={styles.profileSection}
                        onPress={() => closeDrawerWithAnimation(() => navigation.navigate('UserProfileScreen'))}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#FF0000" style={{ marginRight: 15 }}/> // Show loader
                        ) : (
                            <Image
                                source={{ uri: userData.profileImage || 'https://www.w3schools.com/w3images/avatar2.png' }} // Use fetched URI or fallback
                                style={styles.profileImage}
                            />
                        )}
                        <View style={styles.profileInfo}>
                            {/* Conditionally render text or loader placeholders */}
                            {isLoading && !userData.name ? (
                                 <Text style={styles.heading}>Loading...</Text>
                            ) : (
                                <Text style={styles.heading} numberOfLines={1}>{userData.name}</Text>
                            )}
                             {isLoading && !userData.email ? (
                                 <Text style={styles.subHeading}> </Text>
                             ) : (
                                <Text style={styles.subHeading} numberOfLines={1}>{userData.email}</Text>
                             )}
                        </View>
                    </TouchableOpacity>
                    {/* --- End: Updated User Profile Section --- */}

                    <View style={styles.divider} />

                    {/* Drawer Menu Items */}
                    {[
                        { name: 'user', label: 'Profile', route: 'UserProfileScreen' },
                        { name: 'comments', label: 'Support Chat', route: 'SupportChatScreen' },
                        { name: 'heart', label: 'Wishlist', route: 'WishlistScreen' },
                        { name: 'lock', label: 'Privacy Policy', route: 'PrivacyPolicyScreen' },
                        { name: 'balance-scale', label: 'Rules & Regulations', route: 'RulesRegulationScreen' },
                        { name: 'info-circle', label: 'About Us', route: 'AboutUsScreen' },
                    ]
                        .map((item, index) => (
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
                     {/* Divider before Logout */}
                    <View style={styles.divider} />

                    {/* Logout Button */}
                    


                </Animated.View>
            </PanGestureHandler>
        </TouchableOpacity>
    );
};

/* Drawer Item Component (no changes needed) */
const DrawerItem = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={icon} size={22} color="#FF0000" />
            <Text style={styles.drawerText}>{label}</Text>
        </View>
    </TouchableOpacity>
);

// Styles (consider adjusting colors/margins if needed)
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // Removed justifyContent: 'flex-end', to allow PanGestureHandler overlay
    },
    drawerContainer: {
        position: 'absolute',
        top: 0,
        right: 0, // Drawer comes from the right
        width: width * 0.75,
        // maxHeight: height * 0.95, // You might want full height
        height: '100%',
        backgroundColor: '#FFF',
        paddingTop: 40, // Adjusted padding for close button space
        paddingBottom: 20,
        paddingHorizontal: 15,
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        borderTopLeftRadius: 15, // Keep if you like the style
        borderBottomLeftRadius: 15, // Keep if you like the style
    },
    closeIcon: {
        position: 'absolute',
        top: 15,
        right: 15,
        padding: 5,
        zIndex: 10, // Ensure it's tappable
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 30, // Removed as paddingTop added to container
        marginBottom: 20,
        padding: 15,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 0, 0, 0.1)', // Example color
        width: '100%',
    },
    profileImage: {
        width: 65,
        height: 65,
        borderRadius: 32.5,
        marginRight: 15,
        backgroundColor: '#EEE', // Placeholder background
    },
    profileInfo: {
        flex: 1, // Allow text to take remaining space
        justifyContent: 'center', // Center text vertically if needed
    },
    heading: {
        fontSize: 18, // Adjusted size slightly
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 4, // Add space between name and email
    },
    subHeading: {
        fontSize: 14, // Adjusted size slightly
        fontWeight: '600', // Slightly less bold
        color: '#555', // Darker grey
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
        marginVertical: 10, // Adjusted margin
        width: '100%',
    },
    drawerItem: {
        flexDirection: 'row', // Keep this for icon/text layout
        alignItems: 'center',
        paddingVertical: 12, // Adjusted padding
        paddingHorizontal: 10,
        borderRadius: 8, // Slightly smaller radius
        marginBottom: 8, // Adjusted spacing
        backgroundColor: 'rgba(255, 0, 0, 0.08)', // Lighter background
        width: '100%',
    },
});

export default CustomDrawerScreen;