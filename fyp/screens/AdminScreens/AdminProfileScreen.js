import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { uploadImage } from '../../Components/UploadImage';

export default function AdminProfileScreen() {
  const auth = getAuth();
  const firestore = getFirestore();

  const [profileImage, setProfileImage] = useState(null);
  const [localImage, setLocalImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageFetched, setImageFetched] = useState(false);
  const [adminData, setAdminData] = useState({ name: '', email: '', contact: '', profileImage: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [updatingField, setUpdatingField] = useState(null);

  const fetchAdminData = async (uid) => {
    const ref = doc(firestore, 'Admin', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setAdminData(data);
      if (data.profileImage) setProfileImage(data.profileImage);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchAdminData(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  const handleChangePicture = () => {
    Alert.alert("Change Profile Picture", "Choose an option", [
      { text: "Take Photo", onPress: takePicture },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const uploadAndSaveImage = async (image) => {
    try {
      setUploading(true);
      const uploadResponse = await uploadImage(image);
      const cloudinaryUrl = uploadResponse.cloudinaryUrl;

      setProfileImage(cloudinaryUrl);
      setLocalImage(null);
      await updateUserData({ profileImage: cloudinaryUrl });
    } catch (err) {
      console.error("Image upload failed", err);
      Alert.alert("Upload Failed", "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      await uploadAndSaveImage(result.assets[0]);
    }
  };

  const takePicture = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      await uploadAndSaveImage(result.assets[0]);
    }
  };

  const updateUserData = async (updatedFields) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(firestore, 'Admin', user.uid);
    const updated = { ...adminData, ...updatedFields };
    await setDoc(ref, updated, { merge: true });
    setAdminData(updated);
  };

  const handleEditField = (field) => {
    setEditingField(field);
    setTempValue(adminData[field]);
  };

  const handleSaveEdit = async () => {
    if (!tempValue.trim()) {
      Alert.alert("Invalid input", "Field cannot be empty");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    setUpdatingField(editingField);
    await updateUserData({ [editingField]: tempValue });
    setEditingField(null);
    setUpdatingField(null);
  };

  const onRefresh = async () => {
    const user = auth.currentUser;
    if (user) {
      setRefreshing(true);
      await fetchAdminData(user.uid);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF0000" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerContainer}>
        <View style={styles.imageWrapper}>
          {(!profileImage && !localImage) ? (
            <View style={styles.imageLoaderCircle}>
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          ) : (
            <Image
              source={{ uri: localImage || profileImage || 'https://www.w3schools.com/w3images/avatar2.png' }}
              style={styles.profileImage}
              onLoadEnd={() => setImageFetched(true)}
            />
          )}
          <TouchableOpacity onPress={handleChangePicture} style={styles.changeButton} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FF4500" />
            ) : (
              <Text style={styles.changeText}>Change</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        {[ 
          { key: 'name', icon: 'person', label: 'Full Name' },
          { key: 'contact', icon: 'phone', label: 'Contact Number' },
          { key: 'email', icon: 'email', label: 'Email Address', nonEditable: true },
        ].map((item, index) => (
          <View key={index} style={styles.detailItem}>
            <Icon name={item.icon} size={30} color="#FF4500" style={styles.detailIcon} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              {editingField === item.key ? (
                item.key === 'email' ? (
                  <Text style={[styles.detailValue, { color: 'grey' }]}>{adminData[item.key]}</Text>
                ) : (
                  <TextInput
                    style={styles.inputField}
                    value={tempValue}
                    onChangeText={item.key === 'contact' ? (text) => (/^\d{0,11}$/.test(text) && setTempValue(text)) : setTempValue}
                    keyboardType={item.key === 'contact' ? 'numeric' : 'default'}
                    maxLength={item.key === 'contact' ? 11 : undefined}
                    onBlur={handleSaveEdit}
                    autoFocus
                  />
                )
              ) : item.key === 'email' ? (
                <Text style={[styles.detailValue, { color: 'grey' }]}>{adminData[item.key]}</Text>
              ) : (
                <TouchableOpacity onPress={() => handleEditField(item.key)}>
                  <Text style={styles.detailValue}>{adminData[item.key] || 'Tap to enter'}</Text>
                </TouchableOpacity>
              )}
              {updatingField === item.key && <ActivityIndicator size="small" color="#FF4500" />}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 1,
  },
  headerContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#FF0000',
  },
  imageWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  imageLoaderCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ccc',
  },
  changeButton: {
    position: 'absolute',
    bottom: -15,
    backgroundColor: '#FFF',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 15,
    elevation: 3,
  },
  changeText: {
    color: '#FF4500',
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  detailIcon: {
    width: 30,
    textAlign: 'center',
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  detailLabel: {
    fontSize: 16,
    color: '#555',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF4500',
    marginTop: 2,
  },
  inputField: {
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#FF4500',
    color: '#000',
    paddingVertical: 5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});