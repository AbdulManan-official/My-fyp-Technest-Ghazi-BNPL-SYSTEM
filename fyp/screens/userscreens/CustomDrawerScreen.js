// CustomDrawerScreen.js (Final Code - Fixed Text Warning & Formatted)

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  SafeAreaView, // Use SafeAreaView for consistency if desired at root
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome"; // Ensure FontAwesome is linked/available
import { PanGestureHandler, State } from "react-native-gesture-handler";

// Import Firebase and AsyncStorage
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

// Define keys for AsyncStorage
const PROFILE_IMAGE_KEY = "userProfileImage";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";

// Define Support Admin UID
const SUPPORT_ADMIN_UID = "fCCDQ77mAOXOWUjDUNqzVWi9awF3"; // Ensure this is correct

// --- DrawerItem Component (conditionally renders badge) ---
const DrawerItem = ({ icon, label, onPress, badgeCount }) => (
  <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
    {/* Content (Icon and Text) */}
    <View style={styles.drawerItemContent}>
      <Icon name={icon} size={22} color="#FF0000" style={styles.drawerIcon} />
      <Text style={styles.drawerText}>{label}</Text>
    </View>
    {/* Conditionally render the badge ONLY for 'Support Chat' and if count > 0 */}
    {label === "Support Chat" && badgeCount > 0 && (
      <View style={styles.badgeContainer}>
        {/* Ensure badgeCount is rendered as a string */}
        <Text style={styles.badgeText}>
          {badgeCount > 9 ? "9+" : String(badgeCount)}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const CustomDrawerScreen = ({ navigation, closeDrawer }) => {
  const translateX = useRef(new Animated.Value(width)).current;

  // --- State ---
  const [userData, setUserData] = useState({
    profileImage: "https://www.w3schools.com/w3images/avatar2.png",
    name: "Loading...",
    email: " ",
  });
  const [isLoading, setIsLoading] = useState(true); // Loading for profile fetch
  const [currentUserUid, setCurrentUserUid] = useState(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [supportChatId, setSupportChatId] = useState(null);

  // --- Firebase Initialization ---
  const auth = getAuth();
  const db = getFirestore();

  // --- Effect for Auth State Changes and Profile Data Fetching ---
  useEffect(() => {
    setIsLoading(true);
    const fetchUserData = async (currentUser) => {
      if (!currentUser) return;
      const userUid = currentUser.uid;
      const cacheImageKey = `${PROFILE_IMAGE_KEY}_${userUid}`;
      const cacheNameKey = `${USER_NAME_KEY}_${userUid}`;
      const cacheEmailKey = `${USER_EMAIL_KEY}_${userUid}`;
      try {
        const cachedProfile = await AsyncStorage.getItem(cacheImageKey);
        const cachedName = await AsyncStorage.getItem(cacheNameKey);
        const cachedEmail = await AsyncStorage.getItem(cacheEmailKey);
        let dataFromCache = false;
        if (cachedProfile && cachedName && cachedEmail) {
          setUserData({
            profileImage: cachedProfile,
            name: cachedName,
            email: cachedEmail,
          });
          dataFromCache = true;
        }
        const userRef = doc(db, "Users", userUid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          const imageUrl = data.profileImage?.trim()
            ? data.profileImage
            : "https://www.w3schools.com/w3images/avatar2.png";
          const name = data.name || "Unknown User";
          const email = data.email || currentUser.email || "No Email Provided"; // Added auth email fallback

          if (
            !dataFromCache ||
            imageUrl !== cachedProfile ||
            name !== cachedName ||
            email !== cachedEmail
          ) {
            setUserData({ profileImage: imageUrl, name: name, email: email });
            await AsyncStorage.setItem(cacheImageKey, imageUrl);
            await AsyncStorage.setItem(cacheNameKey, name);
            await AsyncStorage.setItem(cacheEmailKey, email);
          }
        } else {
          console.log("User document not found in Firestore.");
          const defaultImage = "https://www.w3schools.com/w3images/avatar2.png";
          const defaultName = "User";
          const defaultEmail = currentUser.email || "No Email";
          if (!dataFromCache) {
            setUserData({
              profileImage: defaultImage,
              name: defaultName,
              email: defaultEmail,
            });
          }
          await AsyncStorage.removeItem(cacheImageKey);
          await AsyncStorage.removeItem(cacheNameKey);
          await AsyncStorage.removeItem(cacheEmailKey);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        if (!userData.name || userData.name === "Loading...") {
          setUserData({
            profileImage: "https://www.w3schools.com/w3images/avatar2.png",
            name: "Error Loading",
            email: "",
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserUid(user.uid);
        fetchUserData(user);
      } else {
        setCurrentUserUid(null);
        setUserData({
          profileImage: "https://www.w3schools.com/w3images/avatar2.png",
          name: "Not logged in",
          email: "",
        });
        setIsLoading(false);
        setUnreadSupportCount(0);
        setSupportChatId(null);
      }
    });
    return () => unsubscribe();
  }, [auth, db]); // Removed userData from dependencies

  // --- Effect to find Support Chat ID ---
  useEffect(() => {
    if (!currentUserUid || !SUPPORT_ADMIN_UID) {
      setSupportChatId(null);
      return;
    }
    let foundChatId = null;
    const findChat = async () => {
      try {
        const chatsRef = collection(db, "Chats");
        const q = query(
          chatsRef,
          where("isSupportChat", "==", true),
          where("users", "array-contains", currentUserUid)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          if (docSnap.data().users?.includes(SUPPORT_ADMIN_UID)) {
            foundChatId = docSnap.id;
          }
        });
        if (foundChatId) { setSupportChatId(foundChatId); }
        else { setSupportChatId(null); }
      } catch (error) {
        console.error("[Drawer] Error finding support chat ID:", error);
        setSupportChatId(null);
      }
    };
    findChat();
  }, [currentUserUid]);

  // --- Effect for Unread Count Listener ---
  useEffect(() => {
    if (!currentUserUid || !supportChatId) {
      setUnreadSupportCount(0);
      return () => {}; // Return empty cleanup
    }
    const messagesRef = collection(db, "Chats", supportChatId, "messages");
    const qUnread = query(
      messagesRef,
      where("receiverId", "==", currentUserUid),
      where("status", "==", "sent")
    );
    const unsubscribeUnread = onSnapshot(
      qUnread,
      (snapshot) => { setUnreadSupportCount(snapshot.size); },
      (error) => { console.error(`[Drawer] Error listening to unread:`, error); setUnreadSupportCount(0); }
    );
    return () => unsubscribeUnread();
  }, [supportChatId, currentUserUid]);

  // --- Animation and Close/Logout Logic ---
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const closeDrawerWithAnimation = (callback) => {
    Animated.timing(translateX, {
      toValue: width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      closeDrawer(); // Call parent prop
      if (callback) callback();
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout Confirmation",
      "Do you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Logout",
          onPress: async () => {
            const userUid = auth.currentUser?.uid;
            try {
              await signOut(auth);
              if (userUid) {
                await AsyncStorage.removeItem(`${PROFILE_IMAGE_KEY}_${userUid}`);
                await AsyncStorage.removeItem(`${USER_NAME_KEY}_${userUid}`);
                await AsyncStorage.removeItem(`${USER_EMAIL_KEY}_${userUid}`);
              }
              closeDrawerWithAnimation(() => navigation.replace("Login"));
            } catch (error) {
              console.error("Logout Error:", error);
              Alert.alert("Logout Failed");
              closeDrawerWithAnimation(() => navigation.replace("Login"));
            }
          },
        },
      ]
    );
  };
  // --- End Logic ---

  // --- Render ---
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
        }}
      >
        <Animated.View
          style={[styles.drawerContainer, { transform: [{ translateX }] }]}
        >
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={() => closeDrawerWithAnimation()}
          >
            <Icon name="times-circle" size={28} color="#FF0000" />
          </TouchableOpacity>

          {/* Profile Section */}
          <TouchableOpacity
            style={styles.profileSection}
            onPress={() => { navigation.navigate("UserProfileScreen"); }} // Keep drawer open
          >
            {/* Loader for image */}
            {isLoading ? (
              <ActivityIndicator
                size="large"
                color="#FF0000"
                style={{ width: 65, height: 65, borderRadius: 32.5, marginRight: 15 }}
              />
            ) : (
              <Image
                source={{ uri: userData.profileImage }} // Use state value
                style={styles.profileImage}
              />
            )}
            <View style={styles.profileInfo}>
              {/* Ensure name is rendered within Text */}
              <Text style={styles.heading} numberOfLines={1}>
                {userData.name}
              </Text>
              {/* Ensure email is rendered within Text and handle empty state */}
              <Text style={styles.subHeading} numberOfLines={1}>
                {userData.email?.trim() ? userData.email : ""}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Drawer Menu Items */}
          {[
            { name: "user", label: "Profile", route: "UserProfileScreen" },
            { name: "comments", label: "Support Chat", route: "SupportChatScreen" },
            { name: "map-marker", label: "Shop Location", route: "LocationScreen" },
            { name: "lock", label: "Privacy Policy", route: "PrivacyPolicyScreen" },
            { name: "balance-scale", label: "Rules & Regulations", route: "RulesRegulationScreen", },
            { name: "info-circle", label: "About Us", route: "AboutUsScreen" },
          ].map((item, index) => (
            <DrawerItem
              key={index}
              icon={item.name}
              label={item.label}
              onPress={() => { navigation.navigate(item.route); }} // Keep drawer open
              // Pass count only to the relevant item
              badgeCount={item.label === "Support Chat" ? unreadSupportCount : 0}
            />
          ))}
 <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
            <View style={styles.drawerItemContent}>
              <Icon name="sign-out" size={22} color="#FF0000" style={styles.drawerIcon} />
              <Text style={styles.drawerText}>Logout</Text>
            </View>
            {/* No badge needed for logout */}
          </TouchableOpacity>
          <View style={styles.divider} />

          {/* Logout Button */}
         
        </Animated.View>
      </PanGestureHandler>
    </TouchableOpacity>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  drawerContainer: {
    position: "absolute",
    top: 0,
    right: 0, // Drawer comes from the right
    width: width * 0.75,
    height: "100%",
    backgroundColor: "#FFF",
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  closeIcon: {
    position: "absolute",
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop:25,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    width: "100%",
  },
  profileImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    marginRight: 15,
    backgroundColor: "#EEE",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  drawerText: {
    fontSize: 14,
    marginLeft: 15, // Space between icon and text
    fontWeight: "500",
    color: "#666", // Text color for drawer items
  },
  divider: {
    height: 1,
    backgroundColor: "#DDD",
    marginVertical: 10,
    width: "100%",
  },
  drawerItem: { // Style for the TouchableOpacity wrapping each item
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Push badge to right
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "rgba(255, 0, 0, 0.08)",
    width: "100%",
  },
  drawerItemContent: { // Wrapper for icon and text
    flexDirection: "row",
    alignItems: "center",
  },
  drawerIcon: {
    // Optional styling like marginRight
  },
  badgeContainer: { // Style for the notification badge
    backgroundColor: "#FF0000",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10, // Space from text
  },
  badgeText: { // Text inside the badge
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
});

export default CustomDrawerScreen;