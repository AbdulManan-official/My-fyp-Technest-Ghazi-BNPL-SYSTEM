// Ensure Toast is imported if you are using it for success messages
import Toast from 'react-native-toast-message'; // << ADDED Import
import React, { useEffect, useState, useCallback } from 'react'; // << ADDED useCallback
import {
  View,
  Text, // Ensure Text is imported
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,         // << ADDED Import
  StatusBar         // << ADDED Import
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context'; // << ADDED Import
import * as ImagePicker from 'expo-image-picker';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Keep onAuthStateChanged if needed, or simplify if only current user is used
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
// Assuming db is exported correctly from firebaseConfig
// import { db } from '../../firebaseConfig'; // Use firestore instance directly
import { uploadImage } from '../../Components/UploadImage'; // Verify path

// --- Constants (Adopted from UserProfileScreen) ---
const THEME_RED = '#FF0000';
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png'; // Or an admin-specific default

// --- Component ---
export default function AdminProfileScreen() { // Removed navigation/route if not needed
  // --- Hooks ---
  const auth = getAuth();
  const firestore = getFirestore(); // Use this instance

  // --- State (Adopted & Adjusted) ---
  const [profileImage, setProfileImage] = useState(defaultProfileImage);
  const [localImage, setLocalImage] = useState(null);
  const [adminData, setAdminData] = useState({ name: '', contact: '', email: '', profileImage: '' }); // Renamed 'phone' to 'contact' if needed
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updatingField, setUpdatingField] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Removed isDataFetched, hasNavigated, verificationStatus - add back if needed for specific Admin logic

  // --- Fetch Data ---
  // Use useCallback for consistency and potential optimization
  const fetchAdminData = useCallback(async (uid) => {
    if (!uid) {
        console.log("No UID provided to fetchAdminData");
        setLoading(false); // Stop loading if no user
        return;
    }
    console.log("Fetching data for admin UID:", uid);
    const adminDocRef = doc(firestore, 'Admin', uid); // Correct path
    try {
      const docSnap = await getDoc(adminDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Fetched Admin Data:", data);
        // Use functional update to avoid stale state issues
        setAdminData(prev => ({ ...prev, ...data }));
        setProfileImage(data.profileImage || defaultProfileImage);
      } else {
        console.log("No such admin document!");
        // Set default/empty state if admin doc doesn't exist
        const user = auth.currentUser; // Get email from auth if possible
        setAdminData({ name: '', contact: '', email: user?.email || '', profileImage: '' });
        setProfileImage(defaultProfileImage);
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
      Alert.alert("Fetch Error", "Could not load admin profile.");
      // Set defaults on error too
      const user = auth.currentUser;
      setAdminData({ name: '', contact: '', email: user?.email || '', profileImage: '' });
      setProfileImage(defaultProfileImage);
    } finally {
      setLoading(false); // Ensure loading stops
    }
  }, [firestore, auth]); // Add auth to dependency array if using currentUser inside

  // --- Effect for Initial Fetch ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchAdminData(user.uid);
      } else {
        console.log("Admin user logged out or not found.");
        setLoading(false); // Stop loading if no user
        // Reset state if user logs out
        setAdminData({ name: '', contact: '', email: '', profileImage: '' });
        setProfileImage(defaultProfileImage);
      }
    });
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [auth, fetchAdminData]); // fetchAdminData is now stable due to useCallback

  // --- Callbacks (Adopted & Adjusted) ---
  const updateUserData = useCallback(async (updatedFields) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Auth Error", "Not logged in.");
      return Promise.reject(new Error("Not logged in")); // Match rejection style
    }
    const userRef = doc(firestore, "Admin", user.uid); // Correct path
    try {
      // Update Firestore
      await setDoc(userRef, updatedFields, { merge: true });
      // Update local state *after* successful Firestore update
      setAdminData(prev => ({ ...prev, ...updatedFields }));
      // No need to return anything specific unless chaining
    } catch (error) {
      console.error("Update error:", error);
      // Provide specific field names in the error message
      Alert.alert("Save Error", `Could not save ${Object.keys(updatedFields).join(', ')}.`);
      throw error; // Re-throw error for potential handling in caller
    }
  }, [auth, firestore]); // Dependencies

  const uploadAndSaveImage = useCallback(async (imageAsset) => {
    if (!imageAsset?.uri) {
      Alert.alert("Error", "Invalid image selected.");
      return;
    }
    setUploading(true);
    setLocalImage(imageAsset.uri); // Show local image immediately
    try {
      const uploadResponse = await uploadImage(imageAsset); // Use the imported function
      if (!uploadResponse?.cloudinaryUrl) {
        throw new Error("Upload failed or no URL was returned.");
      }
      // Save the new URL to Firestore and update local state via updateUserData
      await updateUserData({ profileImage: uploadResponse.cloudinaryUrl });
      // Update the main profile image state *after* successful save
      setProfileImage(uploadResponse.cloudinaryUrl);
      setLocalImage(null); // Clear local image preview
      Toast.show({ type: 'success', text1: 'Profile Picture Updated', position: 'bottom', visibilityTime: 3000 });
    } catch (error) {
      console.error("Upload/Save error:", error);
      // Check if the error came from updateUserData or the upload itself
      if (!error.message?.includes("Could not save")) {
        Alert.alert("Upload Failed", error.message || "Could not update the profile picture.");
      }
      // Revert UI optimistically shown changes on failure
      setLocalImage(null);
      setProfileImage(adminData.profileImage || defaultProfileImage); // Revert to previous DB state
    } finally {
      setUploading(false); // Ensure uploading indicator stops
    }
  }, [adminData.profileImage, updateUserData]); // Dependencies

  // Image Picker Functions (Adopted directly, check permissions if needed)
  const handleChangePicture = () => {
    Alert.alert("Change Profile Picture", "Choose an option:", [
        { text: "Take Photo", onPress: takePicture },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
    ]);
  };

  const pickImage = async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
          Alert.alert("Permission Required", "Please allow access to your photo library to choose an image.");
          return;
      }
      try {
          let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8, // Slightly reduced quality for faster uploads
          });
          if (!result.canceled && result.assets && result.assets.length > 0) {
              await uploadAndSaveImage(result.assets[0]);
          }
      } catch (e) {
          console.error("Gallery Error:", e);
          Alert.alert("Error", "Could not open the image gallery.");
      }
  };

  const takePicture = async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
          Alert.alert("Permission Required", "Please allow access to your camera to take a photo.");
          return;
      }
      try {
          let result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
          });
          if (!result.canceled && result.assets && result.assets.length > 0) {
              await uploadAndSaveImage(result.assets[0]);
          }
      } catch (e) {
          console.error("Camera Error:", e);
          Alert.alert("Error", "Could not open the camera.");
      }
  };


  // Editing Handlers (Adopted & Adjusted)
  const handleEditField = (fieldKey) => {
    if (updatingField) return; // Prevent editing while another field is saving
    setEditingField(fieldKey);
    setTempValue(adminData[fieldKey] || ''); // Use current data or empty string
  };

  const handleSaveEdit = async () => {
    if (!editingField) return; // No field being edited

    const fieldKey = editingField;
    const originalValue = adminData[fieldKey] || '';
    const newValue = tempValue.trim(); // Trim whitespace

    // Define field labels for messages
    const fieldConfig = [
        { key: 'name', label: 'Full Name' },
        { key: 'contact', label: 'Contact Number' },
        // Email is non-editable usually
    ].find(f => f.key === fieldKey);
    const fieldLabel = fieldConfig ? fieldConfig.label : fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);

    // Validation
    if (newValue === '' && fieldKey !== 'address') { // Allow empty address if that were a field
        Alert.alert("Invalid Input", `${fieldLabel} cannot be empty.`);
        return;
    }
    if (fieldKey === 'contact' && !/^\d{11}$/.test(newValue)) { // Example: 11 digit validation for contact
        Alert.alert("Invalid Contact", "Please enter exactly 11 digits.");
        return;
    }
    if (newValue === originalValue) {
        // No change, just exit editing mode
        setEditingField(null);
        setTempValue('');
        return;
    }

    setUpdatingField(fieldKey); // Show saving indicator for this field
    try {
        await updateUserData({ [fieldKey]: newValue }); // Save the single field
        Toast.show({ type: 'success', text1: `${fieldLabel} Updated`, position: 'bottom', visibilityTime: 3000 });
        setEditingField(null); // Exit editing mode on success
        setTempValue('');      // Clear temp value
    } catch (error) {
        // Error Alert is handled within updateUserData
        // Optionally, revert tempValue or keep input open for retry?
        // setTempValue(originalValue); // Option: revert input on failure
    } finally {
        setUpdatingField(null); // Hide saving indicator regardless of outcome
    }
  };

   // Specific handler for phone/contact input formatting
   const handleContactChange = (text) => {
    const formattedText = text.replace(/[^0-9]/g, ''); // Remove non-numeric characters
    if (formattedText.length <= 11) { // Enforce max length
      setTempValue(formattedText);
    }
  };


  // Refresh Handler (Adopted)
  const onRefresh = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      setRefreshing(true); // Show refresh indicator
      await fetchAdminData(user.uid); // Re-fetch data
      setRefreshing(false); // Hide refresh indicator
    } else {
        Alert.alert("Error", "Not logged in."); // Handle case where user is logged out
    }
  }, [auth, fetchAdminData]); // Dependencies

  // --- Render ---
  return (
    // Use SafeAreaView for proper screen boundaries
    <SafeAreaView style={styles.container}>
      {/* Use StatusBar for consistent styling */}
      <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />

      {/* Initial Loading Indicator (Centered) */}
      {loading ? ( // Simplified loading check
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={THEME_RED} />
          {/* Use Text component for loading message */}
          <Text style={styles.loadingText}>Loading Admin Profile...</Text>
        </View>
      ) : (
        // Main Scrollable Content
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Better tap handling with inputs
          refreshControl={
            <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={THEME_RED} // iOS color
                colors={[THEME_RED]} // Android colors
            />
           }
        >
          {/* Header Section (Adopted Style) */}
          <View style={styles.headerContainer}>
            {/* Image Area (Adopted Structure & Style) */}
            <TouchableOpacity onPress={handleChangePicture} activeOpacity={0.8} disabled={uploading}>
              <View style={styles.imageWrapper}>
                {/* Display local image preview, then profile image, then default */}
                <Image
                  source={{ uri: localImage || profileImage || defaultProfileImage }}
                  style={styles.profileImage}
                  // Add onError to fall back to default if the fetched URL fails
                  onError={(e) => {
                    console.log("Image load error:", e.nativeEvent.error);
                    if (!localImage) { // Only reset if it's not the local temp image failing
                        setProfileImage(defaultProfileImage);
                    }
                  }}
                />
                {/* Uploading Overlay (Adopted Style) */}
                {uploading && (
                    <View style={styles.uploadingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                )}
                {/* Change Button (Adopted Style) */}
                {!uploading && (
                    <View style={styles.changeButton}>
                        <Icon name="edit" size={16} color={THEME_RED} style={styles.changeButtonIcon} />
                        <Text style={styles.changeText}>Change</Text>
                    </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Details Section (Adopted Structure & Style) */}
          <View style={styles.detailsContainer}>
            {/* Field Mapping (Adjusted for Admin fields) */}
            {[
              { key: 'name', icon: 'person', label: 'Full Name' },
              { key: 'contact', icon: 'phone', label: 'Contact Number', keyboard: 'numeric', maxLength: 11 }, // Specify keyboard & length
              { key: 'email', icon: 'email', label: 'Email Address', nonEditable: true }, // Mark email as non-editable
            ].map((item) => (
              <View key={item.key} style={styles.detailItem}>
                {/* Icon (Adopted Style) */}
                <Icon name={item.icon} size={30} color={THEME_RED} style={styles.detailIcon} />
                {/* Text Container (Adopted Style) */}
                <View style={styles.detailTextContainer}>
                  {/* Label (Adopted Style) */}
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  {/* Conditional Rendering: Input or Text (Adopted Logic) */}
                  {editingField === item.key ? (
                    <TextInput
                      style={styles.inputField}
                      value={tempValue}
                      // Use specific handler for contact, general for others
                      onChangeText={item.key === 'contact' ? handleContactChange : setTempValue}
                      keyboardType={item.keyboard || "default"}
                      maxLength={item.maxLength} // Use maxLength from mapping
                      onBlur={handleSaveEdit} // Save on blur
                      autoFocus={true}        // Focus when editing starts
                      onSubmitEditing={handleSaveEdit} // Save on submit (keyboard done)
                      returnKeyType="done"
                      editable={!item.nonEditable && !updatingField} // Disable if non-editable or another field is saving
                      selectTextOnFocus={!item.nonEditable} // Allow selecting text easily
                      placeholder={item.nonEditable ? '(Cannot be changed)' : `Enter ${item.label}`}
                      placeholderTextColor="#BBB"
                    />
                  ) : (
                    // Display Text (Touchable to edit)
                    <TouchableOpacity
                      onPress={() => !item.nonEditable && !updatingField && handleEditField(item.key)}
                      disabled={item.nonEditable || !!updatingField} // Disable if non-editable or saving
                      activeOpacity={item.nonEditable ? 1 : 0.7} // No visual feedback if non-editable
                    >
                      <Text style={[
                          styles.detailValue,
                          item.nonEditable && styles.nonEditableText, // Style for non-editable
                          !adminData[item.key] && !item.nonEditable && styles.placeholderText // Style for empty editable fields
                      ]}>
                        {/* Show value, or placeholder */}
                        {item.nonEditable
                            ? (adminData[item.key] || '(Not Set)') // Show '(Not Set)' for empty non-editable
                            : (adminData[item.key] || 'Tap to enter') // Show 'Tap to enter' for empty editable
                        }
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* Saving Indicator (Adopted Style) */}
                  {updatingField === item.key && (
                      <ActivityIndicator size="small" color={THEME_RED} style={styles.savingIndicator} />
                  )}
                </View>
                {/* Edit Icon (Adopted Structure & Style) */}
                {!item.nonEditable && editingField !== item.key && (
                    <TouchableOpacity
                        onPress={() => !updatingField && handleEditField(item.key)}
                        style={styles.editIconTouchable}
                        disabled={!!updatingField} // Disable if saving
                    >
                        <Icon name="edit" size={20} color={updatingField ? "#DDD" : "#AAA"} />
                    </TouchableOpacity>
                )}
              </View>
            ))}
             {/* Add Verification Status Row here if needed for Admins, following the UserProfileScreen pattern */}
          </View>
        </ScrollView>
      )}
      {/* Ensure ToastContainer is rendered at the root of your app */}
    </SafeAreaView>
  );
}

// --- Styles (Adopted from UserProfileScreen, merged/replaced old ones) ---
const styles = StyleSheet.create({
    container: { // From UserProfileScreen
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: 1,
    },
    loaderContainer: { // From UserProfileScreen
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: { // From UserProfileScreen
        marginTop: 15,
        fontSize: 16,
        color: '#666',
    },
    scrollContainer: { // From UserProfileScreen
        flexGrow: 1,
        paddingBottom: 30, // Added more padding at bottom
        backgroundColor: '#FFFFFF',
    },
    headerContainer: { // From UserProfileScreen
        paddingTop: Platform.OS === 'ios' ? 50 : 20, // Adjust top padding
        height: 240,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: THEME_RED,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        marginBottom: 25, // Space below header
    },
    imageWrapper: { // From UserProfileScreen
        position: 'relative',
        alignItems: 'center',
    },
    profileImage: { // From UserProfileScreen
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        backgroundColor: '#E0E0E0', // Placeholder bg color while loading
    },
    uploadingOverlay: { // From UserProfileScreen
        ...StyleSheet.absoluteFillObject, // Covers the image area
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 65, // Match image border radius
    },
    changeButton: { // From UserProfileScreen
        position: 'absolute',
        bottom: -15, // Positioned below the image circle
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 6,
        paddingHorizontal: 18,
        borderRadius: 15,
        elevation: 4, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        flexDirection: 'row', // Icon and text side-by-side
        alignItems: 'center',
    },
    changeButtonIcon: { // From UserProfileScreen
        marginRight: 5,
    },
    changeText: { // From UserProfileScreen
        color: THEME_RED,
        fontSize: 14,
        fontWeight: 'bold',
    },
    detailsContainer: { // From UserProfileScreen
        paddingHorizontal: 20, // Horizontal padding for details section
        backgroundColor: '#FFFFFF', // Ensure background is white
    },
    detailItem: { // From UserProfileScreen
        flexDirection: 'row', // Icon, text container, edit icon in a row
        alignItems: 'center', // Vertically align items in the center
        paddingVertical: 15, // Vertical padding for each item
        borderBottomWidth: 1, // Separator line
        borderBottomColor: '#EEE', // Light grey separator
    },
    detailIcon: { // From UserProfileScreen
        width: 30, // Fixed width for alignment
        textAlign: 'center', // Center icon if needed (less relevant for MaterialIcons)
        marginRight: 20, // Space between icon and text
    },
    detailTextContainer: { // From UserProfileScreen
        flex: 1, // Take remaining horizontal space
        justifyContent: 'center', // Vertically center label and value
        position: 'relative', // Needed for absolute positioning of saving indicator
    },
    detailLabel: { // From UserProfileScreen
        fontSize: 14, // Slightly smaller label text
        color: '#666', // Grey color for label
        marginBottom: 4, // Space between label and value/input
    },
    detailValue: { // From UserProfileScreen
        fontSize: 17, // Larger text for the value
        fontWeight: '500', // Medium weight
        color: '#333', // Darker text for value
        marginTop: 2, // Minor spacing adjustment
        paddingVertical: 4, // Ensure consistent height with input field
    },
    placeholderText: { // From UserProfileScreen
        color: '#999', // Lighter color for placeholders
        fontStyle: 'italic',
        fontWeight: 'normal', // Reset weight
    },
    nonEditableText: { // From UserProfileScreen
        color: '#888', // Distinct color for non-editable fields
        fontWeight: 'normal', // Reset weight
    },
    inputField: { // From UserProfileScreen
        fontSize: 17, // Match detailValue size
        paddingVertical: 4, // Match detailValue padding
        color: '#000', // Black text for input
        borderBottomWidth: 1, // Underline effect
        borderBottomColor: THEME_RED, // Theme color for underline
        marginRight: 25, // Space to avoid overlapping saving indicator/edit icon
    },
    savingIndicator: { // From UserProfileScreen
        position: 'absolute', // Position relative to detailTextContainer
        right: 0, // Align to the right
        top: 0,
        bottom: 0,
        justifyContent: 'center', // Center vertically
        paddingLeft: 5, // Small space from the text/input edge
    },
    editIconTouchable: { // From UserProfileScreen
        paddingLeft: 15, // Tappable area to the left of the icon
        paddingVertical: 10, // Vertical tappable area
    },
    // Removed verificationButton and status styles - add back if needed
});