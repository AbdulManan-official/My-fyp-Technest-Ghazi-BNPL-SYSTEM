import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  SafeAreaView,
  StatusBar,
   // Import Platform for conditional styling
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import Icon from "react-native-vector-icons/MaterialIcons";
import { uploadImage } from '../../Components/UploadImage'; // Ensure path is correct
import { useFocusEffect } from "@react-navigation/native";
import Toast from 'react-native-toast-message';
// OPTIONAL: Import for gradient button
// import { LinearGradient } from 'expo-linear-gradient'; // For Expo
// import LinearGradient from 'react-native-linear-gradient'; // For bare RN

// --- Constants ---
const THEME_RED = 'red';         // Main Red (used for icons now)
const THEME_RED_LIGHT = '#FFCDD2';   // Lighter red for disabled/accents
const THEME_RED_DARK = '#B71C1C';    // Darker Red for Button Gradient (Optional)
const THEME_WHITE = '#FFFFFF';
const THEME_BACKGROUND = '#F9FAFB'; // Very light gray background
const THEME_TEXT_PRIMARY = '#111827'; // Slightly darker primary text
const THEME_TEXT_SECONDARY = '#6B7280'; // Lighter gray for subtitles/placeholders
const THEME_BORDER = '#E5E7EB';     // Light border color
const THEME_SUCCESS = '#10B981';    // Green for success indication

// --- Component ---
const RequestVerificationScreen = ({ navigation }) => {
  const auth = getAuth();
  const db = getFirestore();

  const [images, setImages] = useState({ idFront: null, idBack: null, selfie: null });
  const [loading, setLoading] = useState(false);

  // Clear images when the user navigates away
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log("RequestVerificationScreen blurred - clearing images");
        setImages({ idFront: null, idBack: null, selfie: null });
        AsyncStorage.removeItem("verificationImages");
      };
    }, [])
  );

  // Function to present Camera/Gallery choice
  const openCameraOrGallery = async (type) => {
    let typeLabel = "Image";
    if (type === 'idFront') typeLabel = "Front of ID";
    else if (type === 'idBack') typeLabel = "Back of ID";
    else if (type === 'selfie') typeLabel = "Selfie";

    Alert.alert( `Upload ${typeLabel}`, "Choose source", [
        { text: "Camera", onPress: () => pickImage(type, true) },
        { text: "Gallery", onPress: () => pickImage(type, false) },
        { text: "Cancel", style: "cancel" }
      ], { cancelable: true }
    );
  };

  // Pick image (common logic)
  const pickImage = async (type, fromCamera) => {
    let result;
    const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: type === 'selfie' ? [1, 1] : undefined,
    };

    try {
      if (fromCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) { Alert.alert("Permission Required", "Gallery access needed."); return; }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets?.length > 0) {
        const imageUri = result.assets[0].uri;
        setImages(prevImages => ({ ...prevImages, [type]: imageUri }));
      }
    } catch (error) {
        console.error(`Error picking image (${fromCamera ? 'Camera' : 'Gallery'}):`, error);
        Alert.alert("Error", `Could not ${fromCamera ? 'open camera' : 'access gallery'}.`);
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!images.idFront || !images.idBack || !images.selfie) {
      Alert.alert("Missing Images", "Please upload all three required images.");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) { throw new Error("User not authenticated."); }

      const uploadPromises = Object.keys(images).map(async (key) => {
          if (images[key]) {
              console.log(`Uploading ${key}...`);
              const uploadResponse = await uploadImage({ uri: images[key] });
              if (!uploadResponse?.cloudinaryUrl) { throw new Error(`Failed to upload ${key}.`); }
              return { [key]: uploadResponse.cloudinaryUrl };
          }
          return {};
      });

      const uploadedUrlObjects = await Promise.all(uploadPromises);
      const cloudinaryUrls = uploadedUrlObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});

      if (Object.keys(cloudinaryUrls).length !== 3) { throw new Error("One or more image uploads failed."); }

      console.log("Uploads complete. Updating Firestore...");
      const userRef = doc(db, "Users", user.uid);
      await setDoc(userRef, {
        verificationImages: cloudinaryUrls,
        verificationStatus: "Pending",
        verificationRequestTimestamp: new Date(),
      }, { merge: true });

      console.log("Firestore updated.");
      setLoading(false);
      Toast.show({ type: 'success', text1: 'Verification Submitted', text2: 'Your request is under review.', position: 'bottom' });

      if (navigation.canGoBack()) { navigation.goBack(); }

    } catch (error) {
      setLoading(false);
      console.error("Verification Submission Error:", error);
      Alert.alert("Submission Failed", error.message || "An unexpected error occurred.");
    }
  };

  // Helper component for the upload box (enhanced)
  const UploadBox = ({ type, label, iconName, imageUri, onPress }) => (
    <View style={styles.uploadSection}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <TouchableOpacity
        style={styles.uploadBox}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7} // Provide visual feedback on tap
      >
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.checkmarkOverlay}>
              <Icon name="check-circle" size={30} color={THEME_SUCCESS} />
            </View>
          </>
        ) : (
          <View style={styles.placeholderContent}>
            {/* Using THEME_RED for placeholder icons */}
            <Icon name={iconName} size={45} color={THEME_RED} />
            <Text style={styles.placeholderText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_BACKGROUND} />
      <ScrollView contentContainerStyle={styles.scrollContentContainer} keyboardShouldDismissTaps="handled">
        {/* Header Text */}
        <View style={styles.header}>
            <Text style={styles.title}>Identity Verification</Text>
            <Text style={styles.subtitle}>Please provide clear images for verification.</Text>
        </View>

        {/* Upload Sections */}
        <UploadBox
            type="idFront"
            label="Government ID (Front)"
            iconName="badge" // More specific ID icon
            imageUri={images.idFront}
            onPress={() => openCameraOrGallery("idFront")}
        />
        <UploadBox
            type="idBack"
            label="Government ID (Back)"
            iconName="badge"
            imageUri={images.idBack}
            onPress={() => openCameraOrGallery("idBack")}
        />
        <UploadBox
            type="selfie"
            label="Selfie"
            iconName="camera-alt" // Camera icon might be clearer for selfie
            imageUri={images.selfie}
            onPress={() => openCameraOrGallery("selfie")}
        />

        {/* Separator */}
        <View style={styles.separator} />

        {/* Submit Button - Optionally wrapped in LinearGradient */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!images.idFront || !images.idBack || !images.selfie || loading}
          activeOpacity={0.8}
          style={styles.touchableButtonWrapper} // Use a wrapper for complex styling if needed
        >
          {/* OPTIONAL: Gradient Background */}
          {/* <LinearGradient
             colors={(!images.idFront || !images.idBack || !images.selfie || loading) ? [THEME_RED_LIGHT, THEME_RED_LIGHT] : [THEME_RED, THEME_RED_DARK]}
             start={{ x: 0, y: 0 }}
             end={{ x: 1, y: 1 }}
             style={styles.submitButtonGradient}
          > */}
          <View style={[ styles.submitButton, (!images.idFront || !images.idBack || !images.selfie || loading) && styles.disabledButton ]}>
            {loading
              ? <ActivityIndicator color={THEME_WHITE} size="small" />
              : <Text style={styles.submitText}>Submit Verification</Text>
            }
          </View>
          {/* </LinearGradient> */}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_BACKGROUND,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40, // Ensure space at bottom
    paddingTop: 30,
  },
  header: {
    marginBottom: 35, // Increased space below header
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: THEME_TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: THEME_TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 23, // Slightly more line height
  },
  // Upload Section Styles
  uploadSection: {
    width: '100%',
    marginBottom: 30, // Increased space between sections
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME_TEXT_PRIMARY,
    marginBottom: 12,
  },
  uploadBox: {
    width: '100%',
    height: 190, // Slightly taller
    backgroundColor: THEME_WHITE,
    borderRadius: 16, // More pronounced rounding
    borderWidth: 1,
    borderColor: THEME_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    // Adding subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  placeholderContent: {
    alignItems: 'center',
    opacity: 0.8, // Make placeholder slightly less prominent
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16, // Slightly larger placeholder text
    fontWeight: '500',
    color: THEME_TEXT_SECONDARY,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Keep contain for IDs, maybe 'cover' for selfie?
  },
  checkmarkOverlay: {
      position: 'absolute',
      top: 12, // Adjust position
      right: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.9)', // More opaque white background
      borderRadius: 18, // Circular background for checkmark
      padding: 3, // Padding around checkmark
      // Add small shadow to checkmark background
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1, },
      shadowOpacity: 0.15,
      shadowRadius: 2.00,
      elevation: 3,
  },
  separator: {
      height: 1,
      backgroundColor: THEME_BORDER,
      width: '100%',
      marginVertical: 20, // Adjust spacing around separator
  },
  // Submit Button Styles
  touchableButtonWrapper: { // Needed if using LinearGradient for borderRadius
      width: '100%',
      borderRadius: 12, // Match gradient style if using
      marginTop: 15,
  },
  submitButtonGradient: { // Style for the gradient itself
      paddingVertical: 16,
      width: "100%",
      alignItems: "center",
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
  },
  submitButton: {
    // If NOT using gradient, apply these directly to TouchableOpacity
    backgroundColor: THEME_RED,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    // If using gradient, these might not be needed here
    // marginTop: 15,
  },
  submitText: {
    color: THEME_WHITE,
    fontSize: 18,
    fontWeight: "600",
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: THEME_RED_LIGHT, // Use light red for disabled state background
    opacity: 0.7, // Apply opacity to the whole button view if not using gradient bg color change
  },
});

export default RequestVerificationScreen;