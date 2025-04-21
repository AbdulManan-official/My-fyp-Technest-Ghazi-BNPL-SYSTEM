// RequestVerificationScreen.js (Complete - Image Picking + Firestore + Notification)

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View, Text, Image, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, ScrollView,
    SafeAreaView, StatusBar, Platform
} from "react-native";
import * as ImagePicker from "expo-image-picker"; // Import ImagePicker
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore"; // Added serverTimestamp
import Icon from "react-native-vector-icons/MaterialIcons";
import { uploadImage } from '../../Components/UploadImage'; // Ensure path is correct
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Toast from 'react-native-toast-message';
import axios from 'axios';

// --- Constants ---
const THEME_RED = 'red';
const THEME_RED_LIGHT = '#FFCDD2';
const THEME_RED_DARK = '#B71C1C';
const THEME_WHITE = '#FFFFFF';
const THEME_BACKGROUND = '#F9FAFB';
const THEME_TEXT_PRIMARY = '#111827';
const THEME_TEXT_SECONDARY = '#6B7280';
const THEME_BORDER = '#E5E7EB';
const THEME_SUCCESS = '#10B981';
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// --- Helper Function to Fetch ALL Admin Tokens ---
// (Keep this function as defined in the previous correct response)
async function getAdminExpoTokens() {
    const db = getFirestore(); // Get db instance inside function if not available globally
    const tokens = [];
    console.log("[getAdminExpoTokens] Fetching ALL admin tokens...");
    try {
        const adminQuery = query(collection(db, "Admin"), where("role", "==", "admin"));
        const adminSnapshot = await getDocs(adminQuery);
        if (adminSnapshot.empty) { console.log("[getAdminExpoTokens] No admins found."); return []; }
        adminSnapshot.forEach(adminDoc => {
            const token = adminDoc.data()?.expoPushToken;
            if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) { tokens.push(token); }
            else { console.warn(`[getAdminExpoTokens] Admin ${adminDoc.id} invalid token.`); }
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid token(s).`);
    } catch (error) { console.error("[getAdminExpoTokens] Error fetching tokens:", error); }
    return tokens;
}


// --- Component ---
const RequestVerificationScreen = () => { // Removed navigation prop if not used directly here
    const navigation = useNavigation(); // Get navigation using hook
    const auth = getAuth();
    const db = getFirestore();

    const [images, setImages] = useState({ idFront: null, idBack: null, selfie: null });
    const [loading, setLoading] = useState(false);
    const [userName, setUserName] = useState('User'); // State for user's name

    // --- Fetch User Name on Mount ---
    useEffect(() => {
        const fetchName = async () => {
             const currentUser = auth.currentUser;
             if (currentUser) {
                 let name = currentUser.displayName;
                 try {
                     const userRef = doc(db, "Users", currentUser.uid);
                     const userSnap = await getDoc(userRef);
                     if (userSnap.exists() && userSnap.data()?.name) { name = userSnap.data().name; }
                     setUserName(name || `User ${currentUser.uid.substring(0, 5)}`);
                 } catch (error) { console.error("Error fetching user name:", error); setUserName(name || `User ${currentUser.uid.substring(0, 5)}`); }
             }
        };
        fetchName();
    }, []); // Fetch once

    // --- Clear images on blur ---
    useFocusEffect(
        useCallback(() => {
            return () => {
                console.log("RequestVerificationScreen blurred - clearing images state");
                setImages({ idFront: null, idBack: null, selfie: null });
                // Optionally clear storage if needed: AsyncStorage.removeItem("verificationImages");
            };
        }, [])
    );

    // --- ** RESTORED: Function to present Camera/Gallery choice ** ---
    const openCameraOrGallery = async (type) => {
        let typeLabel = "Image";
        if (type === 'idFront') typeLabel = "Front of ID";
        else if (type === 'idBack') typeLabel = "Back of ID";
        else if (type === 'selfie') typeLabel = "Selfie";

        // Use Alert for choice
        Alert.alert( `Upload ${typeLabel}`, "Choose image source", [
            { text: "Camera", onPress: () => pickImage(type, true) }, // true for camera
            { text: "Gallery", onPress: () => pickImage(type, false) }, // false for gallery
            { text: "Cancel", style: "cancel" }
          ], { cancelable: true }
        );
    };
    // --- ** END RESTORED FUNCTION ** ---

    // --- ** RESTORED: Pick image (common logic) ** ---
    const pickImage = async (type, fromCamera) => {
        let result;
        // Define picker options
        const options = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8, // Reduce quality slightly for faster uploads
            // Set aspect ratio only for selfie
            aspect: type === 'selfie' ? [1, 1] : undefined, // Force square aspect for selfie
        };

        try {
            if (fromCamera) {
                // Request Camera permissions
                const camPerm = await ImagePicker.requestCameraPermissionsAsync();
                if (!camPerm.granted) {
                    Alert.alert("Permission Required", "Camera access is needed to take photos.");
                    return;
                }
                // Launch Camera
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                // Request Media Library permissions
                const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!libPerm.granted) {
                    Alert.alert("Permission Required", "Gallery access is needed to select photos.");
                    return;
                }
                // Launch Image Library
                result = await ImagePicker.launchImageLibraryAsync(options);
            }

            // Process result if not cancelled
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                console.log(`Image selected for ${type}:`, imageUri);
                // Update the specific image type in state
                setImages(prevImages => ({ ...prevImages, [type]: imageUri }));
            } else {
                console.log("Image selection cancelled or failed.");
            }
        } catch (error) {
            console.error(`Error picking image (${fromCamera ? 'Camera' : 'Gallery'}) for ${type}:`, error);
            Alert.alert("Image Error", `Could not ${fromCamera ? 'open camera' : 'access gallery'}. Please try again.`);
        }
    };
    // --- ** END RESTORED FUNCTION ** ---


    // --- Handle final submission (Includes Notification) ---
    const handleSubmit = async () => {
        if (!images.idFront || !images.idBack || !images.selfie) {
            Alert.alert("Missing Images", "Please upload all three required images.");
            return;
        }
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) { throw new Error("User not authenticated."); }

            // --- Image Upload ---
            console.log("Starting image uploads...");
            const uploadPromises = Object.keys(images).map(async (key) => {
                if (images[key]) {
                    console.log(`Uploading ${key}... URI:`, images[key]);
                    // Ensure uploadImage is correctly imported and handles errors
                    const uploadResponse = await uploadImage({ uri: images[key] });
                    if (!uploadResponse?.cloudinaryUrl) { throw new Error(`Failed to upload ${key}. Upload function did not return URL.`); }
                    console.log(`Upload success for ${key}: ${uploadResponse.cloudinaryUrl}`);
                    return { [key]: uploadResponse.cloudinaryUrl };
                } return {};
            });
            const uploadedUrlObjects = await Promise.all(uploadPromises);
            const cloudinaryUrls = uploadedUrlObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
            if (Object.keys(cloudinaryUrls).length !== 3) { throw new Error("One or more image uploads failed during URL collection."); }
            // --- End Image Upload ---

            // --- Firestore Update ---
            console.log("Uploads complete. Updating Firestore for user:", user.uid);
            const userRef = doc(db, "Users", user.uid); // Use USERS_COLLECTION constant if preferred
            await setDoc(userRef, {
                verificationImages: cloudinaryUrls,
                verificationStatus: "Pending",
                verificationRequestTimestamp: serverTimestamp(), // Use server timestamp
            }, { merge: true });
            console.log("Firestore updated successfully.");
            // --- End Firestore Update ---


            // ----- START: SEND NOTIFICATION TO ADMIN -----
            console.log("Attempting to send verification notification to admin(s)...");
            const adminTokens = await getAdminExpoTokens(); // Fetch all admin tokens

            if (adminTokens && adminTokens.length > 0) {
                const messages = adminTokens.map(token => ({
                    to: token,
                    sound: 'default',
                    title: '📄 Verification Request Submitted',
                    body: `${userName || 'A user'} has submitted documents for verification.`, // Use fetched user name
                    data: { userId: user.uid, type: 'verification_request' } // Send user ID for context
                }));

                console.log(`Sending ${messages.length} verification notification(s)...`);
                try {
                    await axios.post(EXPO_PUSH_ENDPOINT, messages, {
                         headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate'},
                         timeout: 10000
                    });
                    console.log("Verification notification request sent to Expo API.");
                } catch (pushError) {
                    // Log error but don't block user flow
                    console.error("Failed to send verification notification:", pushError.response?.data || pushError.message);
                }
            } else {
                console.warn("No admin tokens found to send verification notification.");
            }
            // ----- END: SEND NOTIFICATION TO ADMIN -----


            // --- Success Feedback & Navigation ---
            setLoading(false); // Stop loading *before* alert/nav
            Toast.show({ type: 'success', text1: 'Verification Submitted', text2: 'Your request is under review.', position: 'bottom' });
            // Clear images state after successful submission
             setImages({ idFront: null, idBack: null, selfie: null });
            if (navigation.canGoBack()) {
                // Optional delay before going back to let user see toast
                setTimeout(() => navigation.goBack(), 1500);
             }
            // --- End Success Feedback ---

        } catch (error) {
            setLoading(false); // Stop loading on error
            console.error("Verification Submission Error:", error);
            Alert.alert("Submission Failed", error.message || "An unexpected error occurred. Please check logs or try again.");
        }
    };


    // Helper component for the upload box
    const UploadBox = ({ type, label, iconName, imageUri, onPress }) => (
        <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>{label}</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={onPress} disabled={loading} activeOpacity={0.7}>
                {imageUri ? (
                    <>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        <View style={styles.checkmarkOverlay}><Icon name="check-circle" size={30} color={THEME_SUCCESS} /></View>
                    </>
                ) : (
                    <View style={styles.placeholderContent}>
                        <Icon name={iconName} size={45} color={THEME_RED} />
                        <Text style={styles.placeholderText}>Tap to upload</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );

    // --- Main Render ---
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
                <UploadBox type="idFront" label="Government ID (Front)" iconName="badge" imageUri={images.idFront} onPress={() => openCameraOrGallery("idFront")} />
                <UploadBox type="idBack" label="Government ID (Back)" iconName="badge" imageUri={images.idBack} onPress={() => openCameraOrGallery("idBack")} />
                <UploadBox type="selfie" label="Selfie" iconName="camera-alt" imageUri={images.selfie} onPress={() => openCameraOrGallery("selfie")} />

                <View style={styles.separator} />

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!images.idFront || !images.idBack || !images.selfie || loading}
                  activeOpacity={0.8}
                  style={[ styles.submitButton, (!images.idFront || !images.idBack || !images.selfie || loading) && styles.disabledButton ]}
                >
                  {loading ? (
                      <ActivityIndicator color={THEME_WHITE} size="small" />
                    ) : (
                      <Text style={styles.submitText}>Submit Verification</Text>
                    )
                  }
                </TouchableOpacity>
            </ScrollView>
            {/* Toast component needs to be placed at the root of your app (e.g., App.js) */}
            {/* <Toast ref={(ref) => Toast.setRef(ref)} /> */}
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME_BACKGROUND, },
    scrollContentContainer: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 30, },
    header: { marginBottom: 35, alignItems: 'center', },
    title: { fontSize: 26, fontWeight: "700", color: THEME_TEXT_PRIMARY, marginBottom: 10, textAlign: 'center', },
    subtitle: { fontSize: 16, color: THEME_TEXT_SECONDARY, textAlign: "center", lineHeight: 23, },
    uploadSection: { width: '100%', marginBottom: 30, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: THEME_TEXT_PRIMARY, marginBottom: 12, },
    uploadBox: { width: '100%', height: 190, backgroundColor: THEME_WHITE, borderRadius: 16, borderWidth: 1, borderColor: THEME_BORDER, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2, },
    placeholderContent: { alignItems: 'center', opacity: 0.8, },
    placeholderText: { marginTop: 12, fontSize: 16, fontWeight: '500', color: THEME_TEXT_SECONDARY, },
    previewImage: { width: '100%', height: '100%', resizeMode: 'contain', },
    checkmarkOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 18, padding: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.15, shadowRadius: 2.00, elevation: 3, },
    separator: { height: 1, backgroundColor: THEME_BORDER, width: '100%', marginVertical: 20, },
    submitButton: { backgroundColor: THEME_RED, paddingVertical: 16, width: "100%", alignItems: "center", borderRadius: 12, flexDirection: 'row', justifyContent: 'center', marginTop: 15, minHeight: 50, },
    submitText: { color: THEME_WHITE, fontSize: 18, fontWeight: "600", textAlign: 'center', },
    disabledButton: { backgroundColor: THEME_RED_LIGHT, opacity: 0.7, },
});

export default RequestVerificationScreen;