import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar // Added for explicit status bar control
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Keep if used elsewhere, otherwise removable
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore'; // Added updateDoc for semantic clarity if needed, though setDoc({merge:true}) works
import { uploadImage } from '../../Components/UploadImage'; // Ensure this path is correct

// --- Constants ---
const THEME_RED = '#FF0000'; // Theme color
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png'; // Default avatar

// --- Component ---
const UserProfileScreen = ({ navigation, route }) => {
  // --- Hooks ---
  const auth = getAuth();
  const db = getFirestore();

  // --- State ---
  const [profileImage, setProfileImage] = useState(defaultProfileImage); // URL for display
  const [localImage, setLocalImage] = useState(null); // Temporary local URI during upload
  const [userData, setUserData] = useState({ // User data from Firestore
    name: '',
    phone: '',
    email: '',
    address: '',
    profileImage: '',
    verificationStatus: 'Not Applied'
  });
  const [loading, setLoading] = useState(true); // Initial data load state
  const [editingField, setEditingField] = useState(null); // Key of the field being edited ('name', 'phone', etc.)
  const [tempValue, setTempValue] = useState(''); // Temporary value while editing a field
  const [uploading, setUploading] = useState(false); // Image upload in progress
  const [updatingField, setUpdatingField] = useState(null); // Key of the field currently being saved to Firestore
  const [verificationStatus, setVerificationStatus] = useState('Not Applied'); // Local copy for easier access
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state
  const [hasNavigated, setHasNavigated] = useState(false); // Flag to prevent multiple navigations after signup/verification
  const [isDataFetched, setIsDataFetched] = useState(false); // Flag indicates if initial data fetch attempt completed

  // --- Route Params ---
  const cameFromSignup = route?.params?.cameFromSignup ?? false;

  // --- Effects ---

  // Effect: Firestore Realtime Listener for User Data
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      // Handle case where user is not logged in on component mount
      console.log("UserProfileScreen: No authenticated user found.");
      setLoading(false);
      setIsDataFetched(true); // Mark fetch attempt as complete
      // Optionally navigate to login screen or show message
      // Alert.alert("Authentication Error", "You are not logged in.");
      // navigation.navigate('Login');
      return;
    }

    const userDocRef = doc(db, 'Users', user.uid);

    // Set up the real-time listener
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      console.log("UserProfileScreen: Firestore snapshot received.");
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        // Update state with fetched data
        setUserData(prevData => ({ ...prevData, ...data })); // Merge new data
        setProfileImage(data.profileImage || defaultProfileImage); // Use Firestore image or default
        const status = data.verificationStatus || 'Not Applied';
        setVerificationStatus(status); // Update local verification status

        // Navigate away if verified after signup (and haven't already)
        if (status === 'Verified' && !hasNavigated && cameFromSignup) {
          console.log("UserProfileScreen: Verified user from signup, navigating to main app.");
          navigation.navigate('UserBottomNavigation'); // Or your main app screen
          setHasNavigated(true); // Prevent re-navigation
        }
      } else {
        // Document doesn't exist (e.g., new user, Firestore issue)
        console.log("UserProfileScreen: User document does not exist for UID:", user.uid);
        setUserData({ name: '', phone: '', email: user.email || '', address: '', profileImage: '', verificationStatus: 'Not Applied' }); // Reset to defaults, keep email if available
        setProfileImage(defaultProfileImage);
        setVerificationStatus('Not Applied');
        // Consider creating the document here if necessary
      }
      setIsDataFetched(true); // Mark data fetch attempt as complete
      setLoading(false); // Stop initial loading indicator
    }, (error) => {
      // Handle listener errors
      console.error("UserProfileScreen: Firestore listener error:", error);
      Alert.alert("Sync Error", "Could not sync your profile data. Please check your connection.");
      setLoading(false);
      setIsDataFetched(true); // Mark fetch attempt as complete even on error
    });

    // Cleanup function: Unsubscribe the listener when the component unmounts or dependencies change
    return () => {
      console.log("UserProfileScreen: Unsubscribing Firestore listener.");
      unsubscribe();
    };

  }, [auth.currentUser?.uid, hasNavigated, cameFromSignup, navigation, db]); // Dependencies for the listener effect

  // Effect: Show Incomplete Profile Alert (runs after data fetch attempt)
  useEffect(() => {
    // Only show alert if data fetch is done, not currently loading, and profile is not verified or pending
    if (isDataFetched && !loading && verificationStatus !== 'Verified' && verificationStatus !== 'Pending') {
      // Check if essential fields are missing
      const isProfileIncomplete = !userData.name || !userData.phone || !userData.address; // Adjust required fields as needed
      if (isProfileIncomplete) {
          // Delay slightly to avoid clashing with other mount logic/alerts
           setTimeout(() => {
                Alert.alert(
                    'Profile Incomplete',
                    'Please complete your profile information (Name, Phone, Address) to ensure full app functionality.',
                    [{ text: 'OK' }],
                    { cancelable: true }
                );
           }, 500); // 500ms delay
      }
    }
  }, [verificationStatus, isDataFetched, loading, userData.name, userData.phone, userData.address]); // Dependencies for the alert effect

  // --- Callbacks ---

  // Function: Fetch user data manually (for pull-to-refresh)
  const fetchUserData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      console.log("fetchUserData: No user logged in.");
      Alert.alert("Error", "You are not logged in.");
      return;
    }
    console.log("fetchUserData: Attempting to refresh data...");
    try {
      const userRef = doc(db, "Users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const fetchedData = userSnap.data();
        setUserData(prevData => ({ ...prevData, ...fetchedData })); // Merge updated data
        setProfileImage(fetchedData.profileImage || defaultProfileImage);
        setVerificationStatus(fetchedData.verificationStatus || "Not Applied");
        console.log("fetchUserData: Data refreshed successfully.");
      } else {
        console.log("fetchUserData: User document not found during refresh.");
        // Handle case where doc might have been deleted unexpectedly
         setVerificationStatus("Not Applied");
      }
    } catch (error) {
      console.error("fetchUserData: Error refreshing user data:", error);
      Alert.alert("Refresh Failed", "Could not refresh your profile data. Please check your connection.");
    }
  }, [auth.currentUser?.uid, db]); // Dependencies for fetchUserData

  // Function: Upload selected image and save URL to Firestore
  const uploadAndSaveImage = useCallback(async (imageAsset) => {
    if (!imageAsset?.uri) {
      Alert.alert("Error", "Invalid image selected.");
      return;
    }

    setUploading(true); // Show upload indicator on image
    setLocalImage(imageAsset.uri); // Display local image immediately

    try {
      console.log("uploadAndSaveImage: Starting image upload...");
      // Assume uploadImage returns { success: true, cloudinaryUrl: '...' } or throws error
      const uploadResponse = await uploadImage(imageAsset); // Call your upload utility

      if (!uploadResponse?.cloudinaryUrl) {
          throw new Error("Image upload failed or did not return a valid URL.");
      }

      const newImageUrl = uploadResponse.cloudinaryUrl;
      console.log("uploadAndSaveImage: Upload successful, URL:", newImageUrl);

      // Update Firestore with the new image URL
      await updateUserData({ profileImage: newImageUrl });

      // Update local state after successful Firestore update
      setProfileImage(newImageUrl); // Update displayed image to the new URL
      setLocalImage(null); // Clear temporary local image URI
      Alert.alert("Success", "Profile picture updated successfully.");
      console.log("uploadAndSaveImage: Firestore updated and local state set.");

    } catch (error) {
      console.error("uploadAndSaveImage: Error during image upload or save:", error);
      Alert.alert("Upload Failed", error.message || "Could not update profile picture. Please try again.");
      // Revert UI optimistically shown image if upload/save fails
      setLocalImage(null);
      setProfileImage(userData.profileImage || defaultProfileImage); // Revert to last known good URL
    } finally {
      setUploading(false); // Hide upload indicator
    }
  }, [userData.profileImage, updateUserData]); // Dependency: updateUserData function, and potentially userData.profileImage to revert

  // Function: Update user data in Firestore
  const updateUserData = useCallback(async (updatedFields) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Authentication Error", "You must be logged in to update your profile.");
      return; // Exit if not logged in
    }
    const userRef = doc(db, "Users", user.uid);
    console.log("updateUserData: Attempting to update Firestore with:", updatedFields);
    try {
      // Use setDoc with merge: true - safer as it creates doc if missing, updates if exists
      await setDoc(userRef, updatedFields, { merge: true });
      // Note: The onSnapshot listener will automatically update the local 'userData' state
      console.log("updateUserData: Firestore update successful for fields:", Object.keys(updatedFields).join(', '));
    } catch (error) {
      console.error("updateUserData: Error updating Firestore:", error);
      Alert.alert("Save Error", `Could not save changes for ${Object.keys(updatedFields).join(', ')}. Please try again.`);
      throw error; // Re-throw error so calling function (handleSaveEdit) knows it failed
    }
  }, [auth.currentUser?.uid, db]); // Dependencies: user ID and db instance

  // Function: Handle tap on Verification Status row
  const handleVerificationStatus = () => {
    console.log("handleVerificationStatus: Current status -", verificationStatus);
    switch (verificationStatus) {
      case 'Not Applied':
      case 'Rejected':
        navigation.navigate('UserSecurityVerificationScreen'); // Navigate to verification screen
        break;
      case 'Pending':
        Alert.alert("Verification Pending", "Your verification request is currently under review. Please check back later.");
        break;
      case 'Verified':
        Alert.alert("Account Verified", "Your account has already been successfully verified.");
        break;
      default:
        Alert.alert("Verification Info", `Your current verification status is: ${verificationStatus}`);
    }
  };

  // --- Image Picker Functions ---
  const handleChangePicture = () => {
    Alert.alert(
      "Change Profile Picture",
      "Choose an option:",
      [
        { text: "Take Photo", onPress: takePicture },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const pickImage = async () => {
    console.log("pickImage: Requesting media library permissions...");
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to choose a picture.");
      return;
    }

    console.log("pickImage: Launching image library...");
    try {
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1], // Square aspect ratio
          quality: 0.8, // Compress image slightly
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            console.log("pickImage: Image selected from gallery:", result.assets[0].uri);
            await uploadAndSaveImage(result.assets[0]); // Pass the selected asset
        } else {
            console.log("pickImage: Image selection cancelled or failed.");
        }
    } catch (error) {
        console.error("pickImage: Error launching library or processing result:", error);
        Alert.alert("Error", "Could not open image library.");
    }
  };

  const takePicture = async () => {
    console.log("takePicture: Requesting camera permissions...");
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your camera to take a picture.");
      return;
    }

    console.log("takePicture: Launching camera...");
     try {
        let result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            console.log("takePicture: Photo taken:", result.assets[0].uri);
            await uploadAndSaveImage(result.assets[0]); // Pass the captured asset
        } else {
            console.log("takePicture: Camera action cancelled or failed.");
        }
    } catch (error) {
        console.error("takePicture: Error launching camera or processing result:", error);
        Alert.alert("Error", "Could not open camera.");
    }
  };

  // --- Field Editing Functions ---
  const handleEditField = (fieldKey) => {
    // Prevent starting a new edit while another field is saving
    if (updatingField) {
      console.log(`handleEditField: Cannot edit '${fieldKey}' while '${updatingField}' is saving.`);
      return;
    }
    console.log(`handleEditField: Starting edit for field '${fieldKey}'.`);
    setEditingField(fieldKey);
    setTempValue(userData[fieldKey] || ''); // Set input value to current data or empty string
  };

  const handleSaveEdit = async () => {
    if (!editingField) return; // No field is being edited

    const fieldKey = editingField; // Store locally in case state changes
    const originalValue = userData[fieldKey] || '';
    const newValue = tempValue.trim(); // Trim whitespace

    console.log(`handleSaveEdit: Attempting to save field '${fieldKey}'. Original: '${originalValue}', New: '${newValue}'`);

    // --- Validation ---
    if (newValue === '' && fieldKey !== 'address') { // Address can be empty, others cannot
      Alert.alert("Invalid Input", `${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)} cannot be empty.`);
      // Optionally keep the input focused: setEditingField(fieldKey);
      return; // Stop save process
    }
    if (fieldKey === 'phone' && !/^\d{11}$/.test(newValue)) { // Basic 11-digit phone validation
      Alert.alert("Invalid Phone Number", "Please enter a valid 11-digit phone number.");
      return; // Stop save process
    }
    // Add other validations (e.g., email format, name length) if needed

    // --- Check if Value Changed ---
    if (newValue === originalValue) {
      console.log(`handleSaveEdit: Value for '${fieldKey}' hasn't changed. Cancelling edit.`);
      setEditingField(null); // Exit edit mode
      setTempValue(''); // Clear temp value
      return; // No need to save
    }

    // --- Proceed with Saving ---
    setUpdatingField(fieldKey); // Show saving indicator for this field
    try {
      await updateUserData({ [fieldKey]: newValue });
      // Success: Firestore updated. The snapshot listener will update `userData`.
      console.log(`handleSaveEdit: Successfully saved '${fieldKey}'.`);
      setEditingField(null); // Exit edit mode
      setTempValue(''); // Clear temp value
    } catch (error) {
      // Error: updateUserData already showed an alert.
      console.log(`handleSaveEdit: Save failed for '${fieldKey}'. Keeping edit mode open.`);
      // Keep the input field active for the user to retry or correct
      // setEditingField(fieldKey); // Already set, no need to reset
    } finally {
      setUpdatingField(null); // Hide saving indicator regardless of success/failure
    }
  };

  // Specific handler for phone input to enforce numeric only and max length
  const handlePhoneChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, ''); // Remove non-digit characters
    if (numericValue.length <= 11) {
      setTempValue(numericValue);
    }
  };

  // --- Refresh Handler ---
  const onRefresh = useCallback(() => {
    console.log("onRefresh: Pull-to-refresh triggered.");
    setRefreshing(true); // Show refresh indicator
    fetchUserData() // Call manual fetch function
      .catch(err => console.error("onRefresh: fetchUserData failed within refresh:", err)) // Catch potential errors from fetchUserData itself
      .finally(() => {
        console.log("onRefresh: Refresh action finished.");
        setRefreshing(false); // Hide refresh indicator
      });
  }, [fetchUserData]); // Dependency: fetchUserData callback

  // --- Render ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Status Bar Configuration */}
      <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />

      {/* Loading State: Show spinner only during initial data fetch */}
      {loading && !isDataFetched ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={THEME_RED} />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      ) : (
        // Main Content Area
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Helps with tapping buttons while keyboard is up
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME_RED} // iOS spinner color
              colors={[THEME_RED]} // Android spinner color(s)
            />
          }
        >
          {/* Header Section (Image, Back Button) */}
          <View style={styles.headerContainer}>
            {/* Conditional Back Button: Show only if verified and NOT coming from signup */}
            {verificationStatus === 'Verified' && !cameFromSignup && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Easier to tap
              >
                <Icon name="arrow-back" size={28} color="#FFF" />
              </TouchableOpacity>
            )}

            {/* Profile Image Area */}
            <TouchableOpacity onPress={handleChangePicture} activeOpacity={0.8}>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: localImage || profileImage || defaultProfileImage }} // Show local temp image, then Firestore image, then default
                  style={styles.profileImage}
                  onError={(e) => {
                      console.warn("Image Load Error:", e.nativeEvent.error);
                      // Fallback to default if the profileImage URL fails
                      if (!localImage && profileImage !== defaultProfileImage) {
                         setProfileImage(defaultProfileImage);
                      }
                  }}
                />
                {/* Uploading Overlay */}
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                )}
                {/* Change Button (Show when not uploading) */}
                {!uploading && (
                  <View style={styles.changeButton}>
                    <Icon name="edit" size={16} color={THEME_RED} style={styles.changeButtonIcon} />
                    <Text style={styles.changeText}>Change</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Details Section (User Info Fields) */}
          <View style={styles.detailsContainer}>
            {/* Map through user detail fields */}
            {[
              { key: 'name', icon: 'person', label: 'Full Name' },
              { key: 'phone', icon: 'phone', label: 'Phone Number', keyboard: 'numeric', maxLength: 11 },
              { key: 'email', icon: 'email', label: 'Email Address', nonEditable: true }, // Email usually not editable
              { key: 'address', icon: 'home', label: 'Home Address' },
            ].map((item) => (
              <View key={item.key} style={styles.detailItem}>
                {/* Icon */}
                <Icon name={item.icon} size={26} color={THEME_RED} style={styles.detailIcon} />

                {/* Text/Input Area */}
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>{item.label}</Text>

                  {/* Conditional Rendering: Input field or Text display */}
                  {editingField === item.key ? (
                    // --- Editing State ---
                    <TextInput
                      style={styles.inputField}
                      value={tempValue}
                      onChangeText={item.key === 'phone' ? handlePhoneChange : setTempValue}
                      keyboardType={item.keyboard || "default"}
                      maxLength={item.maxLength || 100} // Default max length
                      onBlur={handleSaveEdit} // Save when input loses focus
                      autoFocus={true} // Focus automatically when edit starts
                      onSubmitEditing={handleSaveEdit} // Save when return key is pressed
                      returnKeyType="done"
                      editable={!item.nonEditable && !updatingField} // Disable while saving
                      selectTextOnFocus={!item.nonEditable}
                      placeholder={item.nonEditable ? '(Cannot be changed)' : `Enter ${item.label}`}
                      placeholderTextColor="#BBB"
                    />
                  ) : (
                    // --- Display State ---
                    <TouchableOpacity
                      onPress={() => !item.nonEditable && !updatingField && handleEditField(item.key)} // Allow edit only if editable and not saving
                      disabled={item.nonEditable || !!updatingField} // Disable button if non-editable or any field is updating
                      activeOpacity={item.nonEditable ? 1 : 0.7} // No visual feedback if non-editable
                    >
                      {/* Text Display - Handles empty values gracefully */}
                      <Text style={[
                          styles.detailValue,
                          item.nonEditable && styles.nonEditableText, // Style for non-editable fields
                          !userData[item.key] && !item.nonEditable && styles.placeholderText // Style for empty, editable fields
                      ]}>
                        {/* *** This is the key part for avoiding string warnings *** */}
                        {/* Display the value or a placeholder string */}
                        {item.nonEditable
                            ? (userData[item.key] || '(Not Set)') // Show '(Not Set)' for empty non-editable fields
                            : (userData[item.key] || 'Tap to enter') // Show 'Tap to enter' for empty editable fields
                        }
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* Saving Indicator (Small spinner next to the field being saved) */}
                  {updatingField === item.key && (
                    <ActivityIndicator size="small" color={THEME_RED} style={styles.savingIndicator}/>
                  )}
                </View>

                {/* Edit Icon (Show only if editable and not currently editing this field) */}
                {!item.nonEditable && editingField !== item.key && (
                  <TouchableOpacity
                    onPress={() => !updatingField && handleEditField(item.key)} // Allow edit only if not saving
                    style={styles.editIconTouchable}
                    disabled={!!updatingField} // Disable if any field is updating
                  >
                    <Icon name="edit" size={20} color={updatingField ? "#DDD" : "#AAA"} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* --- Verification Status Row --- */}
            <TouchableOpacity
              style={[styles.detailItem, styles.verificationButton]}
              // Disable button if status is Pending or Verified (no action needed)
              disabled={verificationStatus === "Pending" || verificationStatus === "Verified"}
              onPress={handleVerificationStatus}
              activeOpacity={ (verificationStatus === "Pending" || verificationStatus === "Verified") ? 1 : 0.7 } // Adjust visual feedback
            >
              {/* Status Icon */}
              <Icon
                name={
                  verificationStatus === 'Verified' ? 'check-circle' :
                  verificationStatus === 'Pending' ? 'hourglass-empty' : // Or 'history'
                  verificationStatus === 'Rejected' ? 'error' : // Or 'cancel'
                  'help-outline' // Default for 'Not Applied'
                }
                size={26}
                color={
                  verificationStatus === "Verified" ? "#4CAF50" : // Green
                  verificationStatus === "Pending" ? "#FFA000" : // Amber
                  THEME_RED // Red for Rejected or Not Applied
                }
                style={styles.detailIcon}
              />
              {/* Status Text */}
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Verification Status</Text>
                <Text style={[
                  styles.detailValue,
                  verificationStatus === "Verified" ? styles.statusVerified :
                  verificationStatus === "Pending" ? styles.statusPending :
                  styles.statusRejectedOrNotApplied // Same style for Rejected/Not Applied
                ]}>
                  {verificationStatus} {/* Already guaranteed to be a string */}
                </Text>
              </View>
              {/* Chevron Icon (Show only if action is possible) */}
              {(verificationStatus === "Not Applied" || verificationStatus === "Rejected") && (
                <Icon name="chevron-right" size={24} color="#AAA" />
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flexGrow: 1, // Ensure content can scroll if it exceeds screen height
    paddingBottom: 40, // Add space at the bottom
    backgroundColor: '#FFFFFF', // Ensure background consistency
  },
  headerContainer: {
    paddingTop: 40, // Space from status bar
    height: 240, // Fixed height for the header area
    justifyContent: 'center', // Center image vertically
    alignItems: 'center', // Center image horizontally
    backgroundColor: THEME_RED,
    borderBottomLeftRadius: 40, // Curved bottom edge
    borderBottomRightRadius: 40,
    marginBottom: 25, // Space between header and details
    position: 'relative', // Needed for absolute positioning of back button
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40, // Adjust top position based on OS status bar height
    left: 15,
    zIndex: 10, // Ensure it's above other elements
    padding: 10, // Increase tappable area
    borderRadius: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)', // Optional subtle background
  },
  imageWrapper: {
    position: 'relative', // Needed for absolute positioning of overlay/button
    alignItems: 'center',
  },
  profileImage: {
    width: 130,
    height: 130,
    borderRadius: 65, // Make it circular
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white border
    backgroundColor: '#E0E0E0', // Background color while image loads or if none
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, // Cover the image exactly
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dark overlay
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 65, // Match image shape
  },
  changeButton: {
    position: 'absolute',
    bottom: -15, // Position slightly below the image
    alignSelf: 'center', // Center horizontally
    backgroundColor: '#FFFFFF', // White background
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 15, // Rounded corners
    elevation: 4, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    flexDirection: 'row', // Align icon and text horizontally
    alignItems: 'center', // Center items vertically
  },
  changeButtonIcon: {
      marginRight: 5, // Space between icon and text
  },
  changeText: {
    color: THEME_RED,
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsContainer: {
    // marginTop: 20, // Removed as header marginBottom covers this
    paddingHorizontal: 20, // Side padding for details
    backgroundColor: '#FFFFFF', // Ensure background
  },
  detailItem: {
    flexDirection: 'row', // Align icon, text, edit-icon horizontally
    alignItems: 'center', // Align items vertically in the center
    paddingVertical: 18, // Vertical spacing for each item
    borderBottomWidth: 1,
    borderBottomColor: '#EEE', // Light separator line
  },
  detailIcon: {
    width: 30, // Fixed width for icon alignment
    textAlign: 'center', // Center icon within its width
    marginRight: 20, // Space between icon and text block
  },
  detailTextContainer: {
    flex: 1, // Take remaining horizontal space
    justifyContent: 'center', // Center label/value vertically
  },
  detailLabel: {
    fontSize: 14,
    color: '#666', // Grey color for labels
    marginBottom: 4, // Space between label and value/input
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '500', // Medium weight for values
    color: '#333', // Dark grey for values
    marginTop: 2, // Align baseline better with label
    paddingVertical: 4, // Match input field padding for consistent height
  },
  placeholderText: {
    color: '#999', // Lighter grey for placeholders
    fontStyle: 'italic',
    fontWeight: 'normal', // Normal weight for placeholders
  },
  nonEditableText: {
    color: '#888', // Slightly darker grey for non-editable fields
    fontWeight: 'normal',
    // fontStyle: 'italic', // Optional: make non-editable italic
  },
  inputField: {
    fontSize: 17,
    paddingVertical: 4, // Small vertical padding
    color: '#000', // Black text input
    borderBottomWidth: 1, // Underline effect
    borderBottomColor: THEME_RED, // Use theme color for underline
    // No fixed height, let it grow naturally
  },
  savingIndicator: {
    position: 'absolute', // Position relative to detailTextContainer
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center', // Center vertically
  },
  editIconTouchable: {
    paddingLeft: 15, // Space before the icon
    paddingVertical: 10, // Increase vertical tap area
  },
  verificationButton: {
    // Add specific styles if needed, otherwise inherits from detailItem
  },
  statusVerified: {
    color: "#4CAF50", // Green
    fontWeight: 'bold',
  },
  statusPending: {
    color: "#FFA000", // Amber
    fontWeight: 'bold',
  },
  statusRejectedOrNotApplied: {
    color: THEME_RED, // Red
    fontWeight: 'bold',
  },
});

export default UserProfileScreen;