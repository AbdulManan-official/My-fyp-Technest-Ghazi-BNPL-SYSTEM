// UserVerificationDetailScreen.js (Original UI + Notification Logic Added - Corrected Image Loaders)

import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Modal,
  Alert, ScrollView, ActivityIndicator, Platform // Added Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
// Import Firestore functions and db
import { getFirestore, doc, updateDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'; // Added necessary imports
import { db } from "../../firebaseConfig"; // Adjusted path to original assumption
// Import Axios for notifications
import axios from 'axios';
// Import navigation hook
import { useNavigation } from '@react-navigation/native';

// --- Constants ---
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
// const placeholderAvatar = 'https://via.placeholder.com/50'; // Not used in this original version's render
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png'; // Default used if user.profileImage is null

// --- Helper Function to Fetch Single User Token ---
async function getUserExpoToken(userId) {
    // ... (Keep the exact same getUserExpoToken function from the previous response) ...
    if (!userId) { console.error("[getUserExpoToken] userId missing."); return null; }
    console.log(`[getUserExpoToken] Fetching token for userId: ${userId}`);
    let token = null;
    try {
        const userDocRef = doc(db, "Users", userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
            if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) { return token; }
            else if (token) { console.warn(`[getUserExpoToken] Invalid token format: ${userId}`, token); return null; }
            else { console.warn(`[getUserExpoToken] expoPushToken missing: ${userId}.`); return null; }
        } else { console.warn(`[getUserExpoToken] User doc not found: ${userId}`); return null; }
    } catch (error) { console.error(`[getUserExpoToken] Error fetching token: ${userId}`, error); return null; }
}


// --- Main Component ---
const UserVerificationDetailScreen = ({ route }) => {
  const navigation = useNavigation(); // Use hook for navigation
  const { user } = route.params;

  // --- State ---
  const [status, setStatus] = useState(user?.verificationStatus || 'Unknown');
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // *** Reverted to individual loading states ***
  const [idFrontLoading, setIdFrontLoading] = useState(!!user?.verificationImages?.idFront);
  const [idBackLoading, setIdBackLoading] = useState(!!user?.verificationImages?.idBack);
  const [selfieLoading, setSelfieLoading] = useState(!!user?.verificationImages?.selfie);

  // --- Effect to Log Data & Initialize State ---
  useEffect(() => {
    console.log('UserVerificationDetailScreen received user:', user);
    setStatus(user?.verificationStatus || 'Unknown');
    // Initialize individual loaders based on image presence
    setIdFrontLoading(!!user?.verificationImages?.idFront);
    setIdBackLoading(!!user?.verificationImages?.idBack);
    setSelfieLoading(!!user?.verificationImages?.selfie);
  }, [user]);

  // --- Function to Send Notification ---
  const sendVerificationNotification = async (userId, title, body) => {
      console.log(`Attempting notification to user ${userId} Title: ${title}`);
      const userToken = await getUserExpoToken(userId);
      if (userToken) {
          const message = { to: userToken, sound: 'default', title: title, body: body, data: { type: 'verification_status' } };
          console.log("Sending notification payload:", JSON.stringify(message, null, 2));
          try {
              await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate'}, timeout: 10000 });
              console.log(`Notification request sent successfully for user ${userId}.`);
          } catch (error) { console.error(`Failed to send notification: ${userId}:`, error.response?.data || error.message); }
      } else { console.warn(`No valid push token for user ${userId}. Skipping notification.`); }
  };

  // --- Handle Approve (with Notification) ---
  const handleApprove = async () => {
    if (!user || !user.id || loadingApprove || loadingReject) return;
    setLoadingApprove(true);
    try {
      const db = getFirestore(); // Get db instance inside handler
      const userRef = doc(db, 'Users', user.id);
      await updateDoc(userRef, { verificationStatus: 'Verified', verifiedAt: serverTimestamp() });
      console.log(`User ${user.id} approved.`);
      setStatus('Verified');
      // Send Notification
      await sendVerificationNotification(user.id, '✅ Verification Approved!', 'Congratulations! Your account verification has been approved.');
      // Show Alert
      Alert.alert('Approved', 'User verification has been approved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) { console.error("Error approving user:", error); Alert.alert('Error', 'Failed to approve verification.'); setStatus(user.verificationStatus); }
    finally { setLoadingApprove(false); }
  };

  // --- Handle Reject (with Notification) ---
  const handleReject = async () => {
     if (!user || !user.id || loadingApprove || loadingReject) return;
     setLoadingReject(true);
     try {
       const db = getFirestore(); // Get db instance
       const userRef = doc(db, 'Users', user.id);
       await updateDoc(userRef, { verificationStatus: 'Rejected', rejectedAt: serverTimestamp() });
       console.log(`User ${user.id} rejected.`);
       setStatus('Rejected');
       // Send Notification
       await sendVerificationNotification( user.id, '❌ Verification Request Update', 'Your verification request was not approved. Please re-apply with clear documents or contact support.');
       // Show Alert
       Alert.alert('Rejected', 'User verification has been rejected.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
     } catch (error) { console.error("Error rejecting user:", error); Alert.alert('Error', 'Failed to reject verification.'); setStatus(user.verificationStatus); }
     finally { setLoadingReject(false); }
  };

  // Original openImagePreview function
  const openImagePreview = (imageUri) => {
    if (!imageUri) return;
    setSelectedImage(imageUri);
    setModalVisible(true);
  };

  // --- Render ---
  // Handle case where user data might be missing
  if (!user) { return ( <View style={styles.loadingContainer}><Text>User data not available.</Text></View> ); }

  return (
    // ScrollView as root per original structure
    <ScrollView contentContainerStyle={styles.scrollViewContainer}>
      {/* User Info */}
      <View style={styles.userInfo}>
        {/* Use user.profileImage OR show default icon View */}
        {user.profileImage ? (
          <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.defaultProfileImage}>
            <Icon name="user" size={30} color="red" />
          </View>
        )}
        {/* Wrap text details in a View */}
        <View style={styles.detailsContainer}>
          <Text style={styles.userName}>{user.name || 'N/A'}</Text>
          <Text style={styles.userEmail}>Email: {user.email || 'N/A'}</Text>
          <Text style={styles.userPhone}>Phone: {user.phone || 'N/A'}</Text>
          <Text style={styles.userAddress}>Address: {user.address || "N/A"}</Text>
          <Text style={[ styles.status, status === 'Verified' ? styles.approved : status === 'Rejected' ? styles.rejected : styles.pending ]}>
            Status: {status || 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Verification Images */}
      {/* Front ID */}
      {user.verificationImages?.idFront ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.idFront)}>
          <View style={styles.imageContainer}>
            {/* Use individual loader state */}
            {idFrontLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.idFront }}
              style={[styles.documentImage, idFrontLoading && { opacity: 0.3 }]}
              // Use individual state setter
              onLoadEnd={() => setIdFrontLoading(false)}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      ) : ( <Text style={styles.noImageText}>Front ID not uploaded</Text> )}

      {/* Back ID */}
       {user.verificationImages?.idBack ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.idBack)}>
          <View style={styles.imageContainer}>
            {/* Use individual loader state */}
            {idBackLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.idBack }}
              style={[styles.documentImage, idBackLoading && { opacity: 0.3 }]}
              // Use individual state setter
              onLoadEnd={() => setIdBackLoading(false)}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      ) : ( <Text style={styles.noImageText}>Back ID not uploaded</Text> )}

      {/* Selfie */}
       {user.verificationImages?.selfie ? (
        <TouchableOpacity onPress={() => openImagePreview(user.verificationImages.selfie)}>
          <View style={styles.imageContainer}>
             {/* Use individual loader state */}
            {selfieLoading && <ActivityIndicator style={styles.imageLoader} size="large" color="#888" />}
            <Image
              source={{ uri: user.verificationImages.selfie }}
              style={[styles.documentImage, selfieLoading && { opacity: 0.3 }]}
              // Use individual state setter
              onLoadEnd={() => setSelfieLoading(false)}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      ) : ( <Text style={styles.noImageText}>Selfie not uploaded</Text> )}

      {/* Action Buttons */}
      {status === 'Pending' && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleApprove} style={[styles.button, styles.approveButton]} disabled={loadingApprove || loadingReject} >
            {loadingApprove ? (<ActivityIndicator size="small" color="#FFF" />) : (<><Icon name="check" size={16} color="#FFF" style={styles.buttonIcon} /><Text style={styles.buttonText}>Approve</Text></>)}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReject} style={[styles.button, styles.rejectButton]} disabled={loadingApprove || loadingReject} >
            {loadingReject ? (<ActivityIndicator size="small" color="#FFF" />) : (<><Icon name="times" size={16} color="#FFF" style={styles.buttonIcon}/><Text style={styles.buttonText}>Reject</Text></>)}
          </TouchableOpacity>
        </View>
      )}

      {/* Image Preview Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
            <Icon name="times-circle" size={30} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode='contain'/>}
        </View>
      </Modal>
    </ScrollView>
  );
};

// --- Original Styles Provided by User (with minor additions for consistency) ---
const styles = StyleSheet.create({
  scrollViewContainer: { flexGrow: 1, padding: 20, paddingBottom: 60, backgroundColor: '#FFF' }, // Added white background to match overall feel
  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', },
  profileImage: { width: 80, height: 80, borderRadius: 40, marginRight: 15, backgroundColor: '#e0e0e0', },
  defaultProfileImage: { width: 80, height: 80, borderRadius: 40, marginRight: 15, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', },
  detailsContainer: { flex: 1, }, // Ensure text container takes space
  userName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  userEmail: { fontSize: 16, color: '#555', marginBottom: 2 },
  userPhone: { fontSize: 16, color: '#555', marginBottom: 2 },
  userAddress: { fontSize: 16, color: '#555' },
  status: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  approved: { color: 'green' },
  rejected: { color: 'red' },
  pending: { color: 'orange' }, // Changed pending back to orange
  imageContainer: { position: 'relative', width: '100%', height: 220, borderRadius: 10, marginVertical: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#ddd', },
  documentImage: { width: '100%', height: '100%', },
  imageLoading: { opacity: 0.3, }, // Opacity while loading
  imageLoader: { position: 'absolute', zIndex: 1 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20, },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, flex: 0.48, marginHorizontal: 5, minHeight: 45, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, },
  approveButton: { backgroundColor: 'green' },
  rejectButton: { backgroundColor: 'red' },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  buttonIcon: { marginRight: 0 }, // Reset potentially conflicting style
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', },
  previewImage: { width: '90%', height: '80%', resizeMode: 'contain', borderRadius: 5 },
  modalClose: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 5 },
  noImageText: { color: 'gray', fontStyle: 'italic', textAlign: 'center', marginVertical: 15, fontSize: 14, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' } // Added for potential root loading
});

export default UserVerificationDetailScreen;