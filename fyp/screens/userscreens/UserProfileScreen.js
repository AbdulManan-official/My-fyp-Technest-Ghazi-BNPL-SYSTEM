// Ensure Toast is imported if you are using it for success messages
import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useCallback } from 'react';
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
  Platform,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { uploadImage } from '../../Components/UploadImage'; // Verify path

// --- Constants ---
const THEME_RED = '#FF0000';
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';

// --- Component ---
const UserProfileScreen = ({ navigation, route }) => {
  // --- Hooks ---
  const auth = getAuth();
  const db = getFirestore();

  // --- State --- (Same as before)
  const [profileImage, setProfileImage] = useState(defaultProfileImage);
  const [localImage, setLocalImage] = useState(null);
  const [userData, setUserData] = useState({ name: '', phone: '', email: '', address: '', profileImage: '', verificationStatus: 'Not Applied' });
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updatingField, setUpdatingField] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('Not Applied');
  const [refreshing, setRefreshing] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [isDataFetched, setIsDataFetched] = useState(false);

  // --- Route Params ---
  const cameFromSignup = route?.params?.cameFromSignup ?? false;

  // --- Effects --- (Same as before)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); setIsDataFetched(true); return; }
    const userDocRef = doc(db, 'Users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setUserData(prev => ({ ...prev, ...data }));
        setProfileImage(data.profileImage || defaultProfileImage);
        const status = data.verificationStatus || 'Not Applied';
        setVerificationStatus(status);
        if (status === 'Verified' && !hasNavigated && cameFromSignup) { navigation.navigate('UserBottomNavigation'); setHasNavigated(true); }
      } else {
        setUserData({ name: '', phone: '', email: user.email || '', address: '', profileImage: '', verificationStatus: 'Not Applied' });
        setProfileImage(defaultProfileImage); setVerificationStatus('Not Applied');
      }
      setIsDataFetched(true); setLoading(false);
    }, (error) => { console.error("Listener error:", error); Alert.alert("Sync Error", "Could not sync profile data."); setLoading(false); setIsDataFetched(true); });
    return () => unsubscribe();
  }, [auth.currentUser?.uid, hasNavigated, cameFromSignup, navigation, db]);

  useEffect(() => {
    if (isDataFetched && !loading && verificationStatus !== 'Verified' && verificationStatus !== 'Pending') {
      if (!userData.name || !userData.phone || !userData.address) {
           setTimeout(() => { Alert.alert('Profile Incomplete', 'Please complete Name, Phone, and Address.', [{ text: 'OK' }], { cancelable: true }); }, 500);
      }
    }
  }, [verificationStatus, isDataFetched, loading, userData.name, userData.phone, userData.address]);

  // --- Callbacks --- (Same logic, ensure Alerts/Toasts are correct)
  const fetchUserData = useCallback(async () => {
    const user = auth.currentUser; if (!user) { Alert.alert("Error", "Not logged in."); return; }
    setRefreshing(true); // Show refresh indicator immediately
    try {
      const userRef = doc(db, "Users", user.uid); const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const fetchedData = userSnap.data(); setUserData(prev => ({ ...prev, ...fetchedData })); setProfileImage(fetchedData.profileImage || defaultProfileImage); setVerificationStatus(fetchedData.verificationStatus || "Not Applied");
      } else { setVerificationStatus("Not Applied"); }
    } catch (error) { console.error("Refresh error:", error); Alert.alert("Refresh Failed", "Could not refresh data."); }
    finally { setRefreshing(false); } // Hide indicator
  }, [auth.currentUser?.uid, db]);

  const updateUserData = useCallback(async (updatedFields) => {
    const user = auth.currentUser; if (!user) { Alert.alert("Auth Error", "Not logged in."); return Promise.reject(new Error("Not logged in")); }
    const userRef = doc(db, "Users", user.uid);
    try { await setDoc(userRef, updatedFields, { merge: true }); }
    catch (error) { console.error("Update error:", error); Alert.alert("Save Error", `Could not save ${Object.keys(updatedFields).join(', ')}.`); throw error; }
  }, [auth.currentUser?.uid, db]);

  const uploadAndSaveImage = useCallback(async (imageAsset) => {
    if (!imageAsset?.uri) { Alert.alert("Error", "Invalid image."); return; }
    setUploading(true); setLocalImage(imageAsset.uri);
    try {
      const uploadResponse = await uploadImage(imageAsset);
      if (!uploadResponse?.cloudinaryUrl) { throw new Error("Upload failed or no URL returned."); }
      await updateUserData({ profileImage: uploadResponse.cloudinaryUrl });
      setProfileImage(uploadResponse.cloudinaryUrl); setLocalImage(null);
      Toast.show({ type: 'success', text1: 'Profile Picture Updated', position: 'bottom', visibilityTime: 3000 });
    } catch (error) {
      console.error("Upload/Save error:", error);
      if (!error.message?.includes("Could not save")) { Alert.alert("Upload Failed", error.message || "Could not update picture."); }
      setLocalImage(null); setProfileImage(userData.profileImage || defaultProfileImage);
    } finally { setUploading(false); }
  }, [userData.profileImage, updateUserData]);

  const handleVerificationStatus = () => {
    switch (verificationStatus) {
      case 'Not Applied': case 'Rejected': navigation.navigate('RequestVerificationScreen'); break;
      case 'Pending': Alert.alert("Verification Pending", "Request is under review."); break;
      case 'Verified': Alert.alert("Account Verified", "Already verified."); break;
      default: Alert.alert("Verification Info", `Status: ${verificationStatus}`);
    }
  };

  const handleChangePicture = () => { Alert.alert("Change Profile Picture", "Choose an option:", [ { text: "Take Photo", onPress: takePicture }, { text: "Choose from Gallery", onPress: pickImage }, { text: "Cancel", style: "cancel" } ]); };
  const pickImage = async () => { const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) { Alert.alert("Permission Required", "Allow library access."); return; } try { let r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!r.canceled && r.assets?.length > 0) { await uploadAndSaveImage(r.assets[0]); } } catch (e) { Alert.alert("Error", "Could not open gallery."); } };
  const takePicture = async () => { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { Alert.alert("Permission Required", "Allow camera access."); return; } try { let r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!r.canceled && r.assets?.length > 0) { await uploadAndSaveImage(r.assets[0]); } } catch (e) { Alert.alert("Error", "Could not open camera."); } };

  const handleEditField = (fieldKey) => { if (updatingField) return; setEditingField(fieldKey); setTempValue(userData[fieldKey] || ''); };
  const handleSaveEdit = async () => {
    if (!editingField) return;
    const fieldKey = editingField; const originalValue = userData[fieldKey] || ''; const newValue = tempValue.trim();
    const fieldConfig = [ { key: 'name', label: 'Full Name' }, { key: 'phone', label: 'Phone Number' }, { key: 'address', label: 'Home Address' } ].find(f => f.key === fieldKey);
    const fieldLabel = fieldConfig ? fieldConfig.label : fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);

    if (newValue === '' && fieldKey !== 'address') { Alert.alert("Invalid Input", `${fieldLabel} cannot be empty.`); return; }
    if (fieldKey === 'phone' && !/^\d{11}$/.test(newValue)) { Alert.alert("Invalid Phone", "Enter 11 digits."); return; }
    if (newValue === originalValue) { setEditingField(null); setTempValue(''); return; }

    setUpdatingField(fieldKey);
    try { await updateUserData({ [fieldKey]: newValue }); Toast.show({ type: 'success', text1: `${fieldLabel} Updated`, position: 'bottom', visibilityTime: 3000 }); setEditingField(null); setTempValue(''); }
    catch (error) { /* Error alert shown in updateUserData */ }
    finally { setUpdatingField(null); }
  };
  const handlePhoneChange = (text) => { const v = text.replace(/[^0-9]/g, ''); if (v.length <= 11) setTempValue(v); };
  const onRefresh = useCallback(() => { fetchUserData(); }, [fetchUserData]);

  // --- Render ---
  // Critically review all JSX parts to ensure no stray text exists
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />

      {/* Initial Loading */}
      {loading && !isDataFetched ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={THEME_RED} />
          {/* Ensure loading text is wrapped */}
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      ) : (
        // Main Content
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME_RED} colors={[THEME_RED]} />}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            {/* Image Area */}
            <TouchableOpacity onPress={handleChangePicture} activeOpacity={0.8}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: localImage || profileImage || defaultProfileImage }} style={styles.profileImage} onError={(e) => { if (!localImage) setProfileImage(defaultProfileImage); }} />
                {/* Uploading overlay content */}
                {uploading && (<View style={styles.uploadingOverlay}><ActivityIndicator size="large" color="#FFFFFF" /></View>)}
                {/* Change button content */}
                {!uploading && (<View style={styles.changeButton}><Icon name="edit" size={16} color={THEME_RED} style={styles.changeButtonIcon} /><Text style={styles.changeText}>Change</Text></View>)}
              </View>
            </TouchableOpacity>
            {/* No stray text here */}
          </View>

          {/* Details */}
          <View style={styles.detailsContainer}>
            {/* Field Mapping */}
            {[ { key: 'name', icon: 'person', label: 'Full Name' }, { key: 'phone', icon: 'phone', label: 'Phone Number', keyboard: 'numeric', maxLength: 11 }, { key: 'email', icon: 'email', label: 'Email Address', nonEditable: true }, { key: 'address', icon: 'home', label: 'Home Address' }, ].map((item) => (
              <View key={item.key} style={styles.detailItem}>
                 {/* Icon is not text */}
                <Icon name={item.icon} size={30} color={THEME_RED} style={styles.detailIcon} />
                 {/* Space between Icon and View is handled by margin, not stray text */}
                <View style={styles.detailTextContainer}>
                  {/* Label is wrapped */}
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  {/* Conditional Rendering for Input/Text */}
                  {editingField === item.key ? (
                    <TextInput style={styles.inputField} value={tempValue} onChangeText={item.key === 'phone' ? handlePhoneChange : setTempValue} keyboardType={item.keyboard || "default"} maxLength={item.maxLength || 100} onBlur={handleSaveEdit} autoFocus={true} onSubmitEditing={handleSaveEdit} returnKeyType="done" editable={!item.nonEditable && !updatingField} selectTextOnFocus={!item.nonEditable} placeholder={item.nonEditable ? '(Cannot be changed)' : `Enter ${item.label}`} placeholderTextColor="#BBB" />
                   ) : (
                    <TouchableOpacity onPress={() => !item.nonEditable && !updatingField && handleEditField(item.key)} disabled={item.nonEditable || !!updatingField} activeOpacity={item.nonEditable ? 1 : 0.7} >
                      {/* Display value is wrapped, uses || for string fallback */}
                      <Text style={[ styles.detailValue, item.nonEditable && styles.nonEditableText, !userData[item.key] && !item.nonEditable && styles.placeholderText ]}>
                        {item.nonEditable ? (userData[item.key] || '(Not Set)') : (userData[item.key] || 'Tap to enter')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* Saving indicator is ActivityIndicator, not text */}
                  {updatingField === item.key && <ActivityIndicator size="small" color={THEME_RED} style={styles.savingIndicator} />}
                   {/* No stray text here */}
                </View>
                {/* Edit icon is not text */}
                {!item.nonEditable && editingField !== item.key && (<TouchableOpacity onPress={() => !updatingField && handleEditField(item.key)} style={styles.editIconTouchable} disabled={!!updatingField}><Icon name="edit" size={20} color={updatingField ? "#DDD" : "#AAA"} /></TouchableOpacity>)}
                 {/* No stray text here */}
              </View>
            ))}

            {/* Verification Status Row */}
            <TouchableOpacity style={[styles.detailItem, styles.verificationButton]} disabled={verificationStatus === "Pending" || verificationStatus === "Verified"} onPress={handleVerificationStatus} activeOpacity={ (verificationStatus === "Pending" || verificationStatus === "Verified") ? 1 : 0.7 } >
               {/* Icon is not text */}
              <Icon name={ verificationStatus === 'Verified' ? 'check-circle' : verificationStatus === 'Pending' ? 'hourglass-empty' : verificationStatus === 'Rejected' ? 'error' : 'help-outline' } size={30} color={ verificationStatus === "Verified" ? "#4CAF50" : verificationStatus === "Pending" ? "#FFA000" : THEME_RED } style={styles.detailIcon} />
              {/* Space handled by margin */}
              <View style={styles.detailTextContainer}>
                {/* Label is wrapped */}
                <Text style={styles.detailLabel}>Verification Status</Text>
                {/* Status value is wrapped, and state guarantees it's a string */}
                <Text style={[ styles.detailValue, verificationStatus === "Verified" ? styles.statusVerified : verificationStatus === "Pending" ? styles.statusPending : styles.statusRejectedOrNotApplied ]}>
                  {verificationStatus}
                </Text>
                 {/* No stray text here */}
              </View>
              {/* Chevron icon is not text */}
              {(verificationStatus === "Not Applied" || verificationStatus === "Rejected") && (<Icon name="chevron-right" size={24} color="#AAA" />)}
               {/* No stray text here */}
            </TouchableOpacity>
             {/* No stray text here */}
          </View>
           {/* No stray text here */}
        </ScrollView>
      )}
       {/* No stray text here */}
    </SafeAreaView>
  );
};

// --- Styles --- (Same as before, ensure no text-like properties are misused)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF',    paddingTop: 1,
    },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', },
    loadingText: { marginTop: 15, fontSize: 16, color: '#666', }, // OK
    scrollContainer: { flexGrow: 1, paddingBottom: 10, backgroundColor: '#FFFFFF', },
    headerContainer: { paddingTop: Platform.OS === 'ios' ? 50 : 20, height: 240, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME_RED, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, marginBottom: 25, },
    imageWrapper: { position: 'relative', alignItems: 'center', },
    profileImage: { width: 130, height: 130, borderRadius: 65, borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.8)', backgroundColor: '#E0E0E0', },
    uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 65, },
    changeButton: { position: 'absolute', bottom: -15, alignSelf: 'center', backgroundColor: '#FFFFFF', paddingVertical: 6, paddingHorizontal: 18, borderRadius: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, flexDirection: 'row', alignItems: 'center', },
    changeButtonIcon: { marginRight: 5, },
    changeText: { color: THEME_RED, fontSize: 14, fontWeight: 'bold', }, // OK
    detailsContainer: { paddingHorizontal: 20, backgroundColor: '#FFFFFF', },
    detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', },
    detailIcon: { width: 30, textAlign: 'center', marginRight: 20, },
    detailTextContainer: { flex: 1, justifyContent: 'center', position: 'relative', },
    detailLabel: { fontSize: 14, color: '#666', marginBottom: 4, }, // OK
    detailValue: { fontSize: 17, fontWeight: '500', color: '#333', marginTop: 2, paddingVertical: 4, }, // OK
    placeholderText: { color: '#999', fontStyle: 'italic', fontWeight: 'normal', }, // OK
    nonEditableText: { color: '#888', fontWeight: 'normal', }, // OK
    inputField: { fontSize: 17, paddingVertical: 4, color: '#000', borderBottomWidth: 1, borderBottomColor: THEME_RED, marginRight: 25, },
    savingIndicator: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', paddingLeft: 5, },
    editIconTouchable: { paddingLeft: 15, paddingVertical: 10, },
    verificationButton: { },
    statusVerified: { color: "#4CAF50", fontWeight: 'bold', }, // OK
    statusPending: { color: "#FFA000", fontWeight: 'bold', }, // OK
    statusRejectedOrNotApplied: { color: THEME_RED, fontWeight: 'bold', }, // OK
});

export default UserProfileScreen;